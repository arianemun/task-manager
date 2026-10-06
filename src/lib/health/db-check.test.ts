import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import type * as Schema from "@/db/schema";
import type {
  HealthCheckId,
  HealthReport,
} from "@/lib/health/db-check";
import {
  DATA_HEALTH_LAST_RUN_KEY,
  LAST_OCCURRENCE_GENERATED_KEY,
  LAST_PERIOD_CLOSE_KEY,
} from "@/lib/settings/system-keys";

type HealthModule = typeof import("@/lib/health/db-check");

describe("بررسی سلامت داده", () => {
  let tmpDir: string;
  let db: Db;
  let schema: typeof Schema;
  let runHealthChecks: HealthModule["runHealthChecks"];
  let saveHealthReport: HealthModule["saveHealthReport"];
  let loadLastHealthReport: HealthModule["loadLastHealthReport"];
  let healthRunIsStale: HealthModule["healthRunIsStale"];
  let setNowProvider: typeof import("@/lib/dates").setNowProvider;
  let resetNowProvider: typeof import("@/lib/dates").resetNowProvider;
  const today = "2026-10-06";

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-health-"));
    const dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    execSync("npx drizzle-kit migrate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
    vi.resetModules();
    const dates = await import("@/lib/dates");
    setNowProvider = dates.setNowProvider;
    resetNowProvider = dates.resetNowProvider;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const health = await import("@/lib/health/db-check");
    runHealthChecks = health.runHealthChecks;
    saveHealthReport = health.saveHealthReport;
    loadLastHealthReport = health.loadLastHealthReport;
    healthRunIsStale = health.healthRunIsStale;
  });

  afterAll(() => {
    resetNowProvider();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    setNowProvider(() => new Date("2026-10-06T10:00:00+03:30"));
    db.delete(schema.taskOccurrences).run();
    db.delete(schema.taskAssignments).run();
    db.delete(schema.auditLogs).run();
    db.delete(schema.taskTemplates).run();
    db.delete(schema.userDepartments).run();
    db.delete(schema.settings).run();
    db.delete(schema.users).run();
    db.delete(schema.departments).run();
  });

  function finding(id: HealthCheckId) {
    const row = runHealthChecks(db).checks.find((check) => check.id === id);
    if (!row) throw new Error(id);
    return row;
  }

  function seedPeople() {
    const admin = db
      .insert(schema.users)
      .values({
        username: `ha_${Math.random()}`,
        passwordHash: "x",
        role: "ADMIN",
        fullName: "ادمین",
        fullNameNormalized: "ادمین",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();
    const dept = db
      .insert(schema.departments)
      .values({ name: `دپ_${Math.random()}` })
      .returning({ id: schema.departments.id })
      .get();
    const staff = db
      .insert(schema.users)
      .values({
        username: `hs_${Math.random()}`,
        passwordHash: "x",
        role: "STAFF",
        fullName: "پرسنل",
        fullNameNormalized: "پرسنل",
        mustChangePassword: false,
        isActive: true,
        departmentId: dept.id,
        departmentJoinedAt: "2026-06-01",
        hireDate: "2026-03-01",
      })
      .returning({ id: schema.users.id })
      .get();
    const other = db
      .insert(schema.users)
      .values({
        username: `ho_${Math.random()}`,
        passwordHash: "x",
        role: "STAFF",
        fullName: "همکار",
        fullNameNormalized: "همکار",
        mustChangePassword: false,
        isActive: true,
        hireDate: "2026-01-01",
      })
      .returning({ id: schema.users.id })
      .get();
    return { admin, dept, staff, other };
  }

  function seedTemplate(
    adminId: number,
    mode: "INDIVIDUAL" | "SHARED" = "INDIVIDUAL",
  ) {
    return db
      .insert(schema.taskTemplates)
      .values({
        title: "کار سلامت",
        startDate: "2026-01-01",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        completionMode: mode,
        createdBy: adminId,
        isActive: true,
      })
      .returning({ id: schema.taskTemplates.id })
      .get();
  }

  function occ(input: {
    templateId: number;
    userId: number;
    status?: Schema.OccurrenceStatus;
    period?: string;
    completedAt?: Date | null;
    completedByUserId?: number | null;
    doneByOccurrenceId?: number | null;
    createdAt?: Date;
    sourceDepartmentId?: number | null;
  }) {
    const period = input.period ?? "2026-10-01";
    return db
      .insert(schema.taskOccurrences)
      .values({
        templateId: input.templateId,
        userId: input.userId,
        periodKey: `D:${period}`,
        periodStart: period,
        periodEnd: period,
        status: input.status ?? "DONE",
        completedAt:
          input.completedAt === undefined
            ? new Date("2026-10-01T12:00:00+03:30")
            : input.completedAt,
        completedByUserId: input.completedByUserId,
        doneByOccurrenceId: input.doneByOccurrenceId,
        createdAt: input.createdAt,
        sourceDepartmentId: input.sourceDepartmentId,
      })
      .returning({ id: schema.taskOccurrences.id })
      .get();
  }

  it("DONE با completed_by شخص دیگر را پیدا می‌کند و ردیف سالم را نه", () => {
    const { admin, staff, other } = seedPeople();
    const template = seedTemplate(admin.id);
    const row = occ({
      templateId: template.id,
      userId: staff.id,
      status: "DONE",
      completedByUserId: other.id,
    });
    expect(finding("foreign_close").count).toBe(1);
    expect(finding("foreign_close").sampleIds).toContain(row.id);

    db.update(schema.taskOccurrences)
      .set({ completedByUserId: staff.id })
      .where(eq(schema.taskOccurrences.id, row.id))
      .run();
    expect(finding("foreign_close").count).toBe(0);
  });

  it("ارجاع نامعتبر DONE_BY_PEER را پیدا می‌کند و ارجاع درست را نه", () => {
    const { admin, staff, other } = seedPeople();
    const template = seedTemplate(admin.id, "SHARED");
    const source = occ({
      templateId: template.id,
      userId: other.id,
      status: "NOT_DONE",
      completedByUserId: other.id,
    });
    const peer = occ({
      templateId: template.id,
      userId: staff.id,
      status: "DONE_BY_PEER",
      completedAt: null,
      completedByUserId: other.id,
      doneByOccurrenceId: source.id,
    });
    expect(finding("peer_ref").sampleIds).toContain(peer.id);

    db.update(schema.taskOccurrences)
      .set({ doneByOccurrenceId: null })
      .where(eq(schema.taskOccurrences.id, peer.id))
      .run();
    expect(finding("peer_ref").count).toBeGreaterThan(0);

    const sqlite = (db as unknown as { $client: { pragma: (q: string) => void; prepare: (q: string) => { run: (id: number) => void } } }).$client;
    sqlite.pragma("foreign_keys = OFF");
    sqlite
      .prepare(
        "UPDATE task_occurrences SET done_by_occurrence_id = 999999 WHERE id = ?",
      )
      .run(peer.id);
    sqlite.pragma("foreign_keys = ON");
    expect(finding("peer_ref").sampleIds).toContain(peer.id);

    db.update(schema.taskOccurrences)
      .set({ status: "DONE", completedAt: new Date("2026-10-01T12:00:00+03:30") })
      .where(eq(schema.taskOccurrences.id, source.id))
      .run();
    db.update(schema.taskOccurrences)
      .set({ doneByOccurrenceId: source.id, periodKey: "D:2026-10-02", periodStart: "2026-10-02", periodEnd: "2026-10-02" })
      .where(eq(schema.taskOccurrences.id, peer.id))
      .run();
    expect(finding("peer_ref").sampleIds).toContain(peer.id);

    db.update(schema.taskOccurrences)
      .set({
        periodKey: "D:2026-10-01",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-01",
        doneByOccurrenceId: source.id,
      })
      .where(eq(schema.taskOccurrences.id, peer.id))
      .run();
    expect(finding("peer_ref").count).toBe(0);
  });

  it("DONE_BY_PEER روی کار فردی را پیدا می‌کند و روی کار مشترک نه", () => {
    const { admin, staff, other } = seedPeople();
    const template = seedTemplate(admin.id, "INDIVIDUAL");
    const source = occ({
      templateId: template.id,
      userId: other.id,
      status: "DONE",
      completedByUserId: other.id,
    });
    const peer = occ({
      templateId: template.id,
      userId: staff.id,
      status: "DONE_BY_PEER",
      completedAt: null,
      doneByOccurrenceId: source.id,
    });
    expect(finding("peer_on_individual").sampleIds).toContain(peer.id);

    db.update(schema.taskTemplates)
      .set({ completionMode: "SHARED" })
      .where(eq(schema.taskTemplates.id, template.id))
      .run();
    expect(finding("peer_on_individual").count).toBe(0);
  });

  it("PENDING قبل از دیروز را پیدا می‌کند و PENDING دیروز را نه", () => {
    const { admin, staff } = seedPeople();
    const template = seedTemplate(admin.id);
    const row = occ({
      templateId: template.id,
      userId: staff.id,
      status: "PENDING",
      period: "2026-10-04",
      completedAt: null,
    });
    expect(finding("stale_pending").sampleIds).toContain(row.id);

    db.update(schema.taskOccurrences)
      .set({
        periodKey: "D:2026-10-05",
        periodStart: "2026-10-05",
        periodEnd: "2026-10-05",
      })
      .where(eq(schema.taskOccurrences.id, row.id))
      .run();
    expect(finding("stale_pending").count).toBe(0);
  });

  it("DONE بدون completed_at را پیدا می‌کند و با زمان ثبت نه", () => {
    const { admin, staff } = seedPeople();
    const template = seedTemplate(admin.id);
    const row = occ({
      templateId: template.id,
      userId: staff.id,
      status: "DONE_LATE",
      completedAt: null,
      completedByUserId: staff.id,
    });
    expect(finding("done_without_time").sampleIds).toContain(row.id);

    db.update(schema.taskOccurrences)
      .set({ completedAt: new Date("2026-10-01T18:00:00+03:30") })
      .where(eq(schema.taskOccurrences.id, row.id))
      .run();
    expect(finding("done_without_time").count).toBe(0);
  });

  it("MISSED دورهٔ باز را پیدا می‌کند و دورهٔ تمام‌شده را نه", () => {
    const { admin, staff } = seedPeople();
    const template = seedTemplate(admin.id);
    const row = occ({
      templateId: template.id,
      userId: staff.id,
      status: "MISSED",
      period: today,
      completedAt: null,
    });
    expect(finding("missed_open").sampleIds).toContain(row.id);

    db.update(schema.taskOccurrences)
      .set({
        periodKey: "D:2026-10-01",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-01",
      })
      .where(eq(schema.taskOccurrences.id, row.id))
      .run();
    expect(finding("missed_open").count).toBe(0);
  });

  it("period_start قبل از max شروع، assignment، استخدام و پیوستن را پیدا می‌کند", () => {
    const { admin, dept, staff } = seedPeople();
    const template = seedTemplate(admin.id);
    db.insert(schema.userDepartments)
      .values({
        userId: staff.id,
        departmentId: dept.id,
        joinedAt: "2026-06-01",
      })
      .run();
    db.insert(schema.taskAssignments)
      .values({
        templateId: template.id,
        assigneeType: "DEPARTMENT",
        departmentId: dept.id,
        createdAt: new Date("2026-01-01T08:00:00+03:30"),
      })
      .run();
    const row = occ({
      templateId: template.id,
      userId: staff.id,
      status: "PENDING",
      period: "2026-05-15",
      completedAt: null,
    });
    expect(finding("early_period").sampleIds).toContain(row.id);

    db.update(schema.taskOccurrences)
      .set({
        periodKey: "D:2026-06-01",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-01",
      })
      .where(eq(schema.taskOccurrences.id, row.id))
      .run();
    expect(finding("early_period").count).toBe(0);
  });

  it("occurrence بعد از حذف کاربر را پیدا می‌کند و کاربر فعال را نه", () => {
    const { admin, staff } = seedPeople();
    const template = seedTemplate(admin.id);
    const removedAt = new Date("2026-10-01T08:00:00+03:30");
    db.update(schema.users)
      .set({ isActive: false, deletedAt: removedAt, updatedAt: removedAt })
      .where(eq(schema.users.id, staff.id))
      .run();
    const row = occ({
      templateId: template.id,
      userId: staff.id,
      status: "PENDING",
      period: "2026-10-02",
      completedAt: null,
      createdAt: new Date("2026-10-03T08:00:00+03:30"),
    });
    expect(finding("after_deactivation").sampleIds).toContain(row.id);

    db.update(schema.users)
      .set({ isActive: true, deletedAt: null })
      .where(eq(schema.users.id, staff.id))
      .run();
    expect(finding("after_deactivation").count).toBe(0);
  });

  it("generate قدیمی یا غایب را پیدا می‌کند و تاریخ داخل ۲ روز را نه", () => {
    expect(finding("generate_stale").count).toBe(1);

    db.insert(schema.settings)
      .values({ key: LAST_OCCURRENCE_GENERATED_KEY, value: "2026-10-03" })
      .run();
    expect(finding("generate_stale").count).toBe(1);

    db.update(schema.settings)
      .set({ value: "2026-10-04" })
      .where(eq(schema.settings.key, LAST_OCCURRENCE_GENERATED_KEY))
      .run();
    expect(finding("generate_stale").count).toBe(0);
  });

  it("close-periods قدیمی یا غایب را پیدا می‌کند و تاریخ داخل ۲ روز را نه", () => {
    expect(finding("close_stale").count).toBe(1);

    db.insert(schema.settings)
      .values({ key: LAST_PERIOD_CLOSE_KEY, value: "2026-10-03" })
      .run();
    expect(finding("close_stale").count).toBe(1);
    expect(finding("close_stale").detail).toContain("2026-10-03");

    db.update(schema.settings)
      .set({ value: "2026-10-04" })
      .where(eq(schema.settings.key, LAST_PERIOD_CLOSE_KEY))
      .run();
    expect(finding("close_stale").count).toBe(0);
  });

  it("بکاپ قدیمی را پیدا می‌کند و بکاپ تازه را نه", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-bak-"));
    const oldFile = path.join(dir, "app_old.db");
    fs.writeFileSync(oldFile, "x");
    fs.utimesSync(oldFile, new Date("2026-10-03T12:00:00+03:30"), new Date("2026-10-03T12:00:00+03:30"));
    expect(
      runHealthChecks(db, { backupDir: dir }).checks.find(
        (check) => check.id === "backup_stale",
      )?.count,
    ).toBe(1);

    const fresh = path.join(dir, "app_fresh.db");
    fs.writeFileSync(fresh, "x");
    fs.utimesSync(fresh, new Date("2026-10-06T12:00:00+03:30"), new Date("2026-10-06T12:00:00+03:30"));
    expect(
      runHealthChecks(db, { backupDir: dir }).checks.find(
        (check) => check.id === "backup_stale",
      )?.count,
    ).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("اجرای بررسی دادهٔ کاری را عوض نمی‌کند و فقط خلاصه را ذخیره می‌کند", () => {
    const { admin, staff } = seedPeople();
    const template = seedTemplate(admin.id);
    const row = occ({
      templateId: template.id,
      userId: staff.id,
      status: "PENDING",
      period: "2026-10-04",
      completedAt: null,
    });
    const report = runHealthChecks(db);
    const after = db
      .select({ status: schema.taskOccurrences.status })
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.id, row.id))
      .get();
    expect(after?.status).toBe("PENDING");
    expect(loadLastHealthReport(db)).toBeNull();

    saveHealthReport(report, db);
    const stored = loadLastHealthReport(db);
    expect(stored?.ok).toBe(report.ok);
    expect(stored?.checks.map((check) => check.id)).toEqual(
      report.checks.map((check) => check.id),
    );
    const setting = db
      .select({ key: schema.settings.key })
      .from(schema.settings)
      .where(eq(schema.settings.key, DATA_HEALTH_LAST_RUN_KEY))
      .get();
    expect(setting?.key).toBe(DATA_HEALTH_LAST_RUN_KEY);
  });

  it("نبود اجرا و اجرای کهنه‌تر از ۲ روز کهنه است", () => {
    expect(healthRunIsStale(null, Date.parse("2026-10-06T12:00:00Z"))).toBe(
      true,
    );
    const fresh = {
      ranAt: "2026-10-06T10:00:00.000Z",
    };
    expect(
      healthRunIsStale(fresh, Date.parse("2026-10-07T10:00:00.000Z")),
    ).toBe(false);
    const old: Pick<HealthReport, "ranAt"> = {
      ranAt: "2026-10-01T10:00:00.000Z",
    };
    expect(
      healthRunIsStale(old, Date.parse("2026-10-06T10:00:00.000Z")),
    ).toBe(true);
  });

  it("منبع تهی یا دپارتمانی که در period_start عضو آن نبوده را پیدا می‌کند", () => {
    const { admin, dept, staff } = seedPeople();
    const later = db
      .insert(schema.departments)
      .values({ name: "دیر" })
      .returning({ id: schema.departments.id })
      .get();
    db.insert(schema.userDepartments)
      .values([
        { userId: staff.id, departmentId: dept.id, joinedAt: "2026-06-01" },
        { userId: staff.id, departmentId: later.id, joinedAt: "2026-10-05" },
      ])
      .run();
    const template = seedTemplate(admin.id);
    const missing = occ({
      templateId: template.id,
      userId: staff.id,
      period: "2026-09-01",
    });
    const late = occ({
      templateId: template.id,
      userId: staff.id,
      period: "2026-10-01",
      sourceDepartmentId: later.id,
    });
    occ({
      templateId: template.id,
      userId: staff.id,
      period: "2026-10-06",
      sourceDepartmentId: dept.id,
    });

    const found = finding("source_department");
    expect(found.count).toBe(2);
    expect(found.sampleIds).toEqual([missing.id, late.id]);
  });
});
