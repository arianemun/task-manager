import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * بازتولید باگ ۱: ثبت یک عضو، وضعیت DONE را روی occurrence بقیه کپی می‌کند
 * و فرمول درصد آن DONE را اعتبار کامل می‌شمارد.
 */
describe("کار گروهی — اثر روی درصد", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-grp-"));
    dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    vi.resetModules();
    execSync("npx drizzle-kit migrate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function seedPair(mode: "INDIVIDUAL" | "SHARED" = "SHARED") {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("x", 4);
    const day = "2026-10-01";

    const admin = db
      .insert(schema.users)
      .values({
        username: `gadmin_${Math.random()}`,
        passwordHash: hash,
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
      .values({ name: `دپ_${Math.random()}`, managerId: admin.id })
      .returning({ id: schema.departments.id })
      .get();

    function staff(name: string) {
      return db
        .insert(schema.users)
        .values({
          username: `${name}_${Math.random()}`,
          passwordHash: hash,
          role: "STAFF",
          fullName: name,
          fullNameNormalized: name,
          mustChangePassword: false,
          isActive: true,
          departmentId: dept.id,
          departmentJoinedAt: day,
        })
        .returning({ id: schema.users.id })
        .get();
    }

    const a = staff("الف");
    const b = staff("ب");

    const values: Record<string, unknown> = {
      title: "کار دپارتمان",
      recurrenceType: "DAILY",
      recurrenceConfig: { interval: 1 },
      startDate: day,
      skipHolidays: false,
      isActive: true,
      createdBy: admin.id,
      dueTime: "18:00",
    };
    if (mode) values.completionMode = mode;

    const template = db
      .insert(schema.taskTemplates)
      .values(values as never)
      .returning({ id: schema.taskTemplates.id })
      .get();

    db.insert(schema.taskAssignments)
      .values({
        templateId: template.id,
        assigneeType: "DEPARTMENT",
        departmentId: dept.id,
      })
      .run();

    function occ(userId: number, status: "PENDING" | "NOT_DONE" = "PENDING") {
      return db
        .insert(schema.taskOccurrences)
        .values({
          templateId: template.id,
          userId,
          periodKey: "D:2026-10-01",
          periodStart: day,
          periodEnd: day,
          dueAt: new Date("2026-10-01T14:30:00.000Z"),
          sourceDepartmentId: dept.id,
          status,
        })
        .returning({ id: schema.taskOccurrences.id })
        .get();
    }

    return { db, schema, a, b, template, dept, occA: occ(a.id), occB: occ(b.id), day };
  }

  it("SHARED: DONE یک نفر بقیه را DONE_BY_PEER می‌کند و درصدشان را بالا نمی‌برد", async () => {
    const { db, schema, a, b, template, dept, occA, occB } = await seedPair("SHARED");
    const { recordGroupOutcome } = await import("./group-completion");
    const { ratesFromStatusList } = await import("@/lib/reports");

    db.insert(schema.taskOccurrences)
      .values({
        templateId: template.id,
        userId: b.id,
        periodKey: "D:other",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-01",
        sourceDepartmentId: dept.id,
        status: "NOT_DONE",
      })
      .run();

    const result = recordGroupOutcome({
      templateId: template.id,
      periodKey: "D:2026-10-01",
      completerUserId: a.id,
      sourceOccurrenceId: occA.id,
      status: "DONE",
      completedAt: new Date("2026-10-01T10:00:00.000Z"),
      note: null,
      reasonCode: null,
      attachmentPath: null,
      editedAt: null,
    });
    expect(result.mode).toBe("closed");

    const peer = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.id, occB.id))
      .get()!;
    const self = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.id, occA.id))
      .get()!;

    expect(self.status).toBe("DONE");
    expect(peer.status).toBe("DONE_BY_PEER");
    expect(peer.doneByOccurrenceId).toBe(occA.id);

    const peerRate = ratesFromStatusList([peer.status, "NOT_DONE"]);
    expect(peerRate.completionRate).toBe(0);
    expect(peerRate.countable).toBe(1);

    const { ratesByPeriodEnd } = await import("@/server/queries/report-core");
    const { aggregateStatusDonut } = await import("@/server/queries/admin-reports");
    const { parseReportFilters } = await import("@/lib/reports");
    const me = ratesByPeriodEnd({
      userId: b.id,
      from: "2026-10-01",
      to: "2026-10-01",
    });
    const filters = parseReportFilters({
      range: "custom",
      from: "2026-10-01",
      to: "2026-10-01",
    });
    filters.userId = b.id;
    const admin = aggregateStatusDonut(
      {
        id: a.id,
        username: "a",
        fullName: "الف",
        role: "ADMIN",
        departmentId: null,
        departmentIds: [],
        isActive: true,
        mustChangePassword: false,
        sessionVersion: 1,
        permissions: [],
        avatarPath: null,
      },
      filters,
    ).rates;
    expect(admin.completionRate).toBe(me.completionRate);
    expect(admin.countable).toBe(me.countable);
    expect(me.completionRate).toBe(0);
  });

  it("پس گرفتن پاسخ SHARED، DONE_BY_PEER را به PENDING برمی‌گرداند", async () => {
    const { db, schema, a, template, occA, occB } = await seedPair("SHARED");
    const { recordGroupOutcome } = await import("./group-completion");
    recordGroupOutcome({
      templateId: template.id,
      periodKey: "D:2026-10-01",
      completerUserId: a.id,
      sourceOccurrenceId: occA.id,
      status: "DONE",
      completedAt: new Date(),
      note: null,
      reasonCode: null,
      attachmentPath: null,
      editedAt: null,
    });
    recordGroupOutcome({
      templateId: template.id,
      periodKey: "D:2026-10-01",
      completerUserId: a.id,
      sourceOccurrenceId: occA.id,
      status: "NOT_DONE",
      completedAt: new Date(),
      note: "نشد",
      reasonCode: null,
      attachmentPath: null,
      editedAt: new Date(),
    });
    const peer = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.id, occB.id))
      .get()!;
    const self = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.id, occA.id))
      .get()!;
    expect(self.status).toBe("NOT_DONE");
    expect(peer.status).toBe("PENDING");
    expect(peer.doneByOccurrenceId).toBeNull();
  });

  it("INDIVIDUAL: پاسخ یک نفر روی بقیه اثری ندارد", async () => {
    const { db, schema, a, template, occA, occB } = await seedPair("INDIVIDUAL");
    const { recordGroupOutcome } = await import("./group-completion");
    const result = recordGroupOutcome({
      templateId: template.id,
      periodKey: "D:2026-10-01",
      completerUserId: a.id,
      sourceOccurrenceId: occA.id,
      status: "DONE",
      completedAt: new Date(),
      note: null,
      reasonCode: null,
      attachmentPath: null,
      editedAt: null,
    });
    expect(result.mode).toBe("personal");
    const peer = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.id, occB.id))
      .get()!;
    expect(peer.status).toBe("PENDING");
    expect(peer.completedByUserId).toBeNull();
  });

  it("SHARED بدون هیچ انجام‌دهنده‌ای، همه MISSED می‌شوند", async () => {
    const { db, schema, template, occA, occB } = await seedPair("SHARED");
    const { closeMissedPeriods } = await import("./occurrence-generate");
    closeMissedPeriods();
    const rows = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.templateId, template.id))
      .all()
      .filter((row) => row.id === occA.id || row.id === occB.id);
    expect(rows.map((row) => row.status).sort()).toEqual(["MISSED", "MISSED"]);
  });

  it("SHARED روی دو دپارتمان فقط همکاران همان منبع را می‌بندد", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("x", 4);
    const day = "2026-10-06";

    const admin = db
      .insert(schema.users)
      .values({
        username: `ga_${Math.random()}`,
        passwordHash: hash,
        role: "ADMIN",
        fullName: "ا",
        fullNameNormalized: "ا",
        mustChangePassword: false,
        isActive: true,
      })
      .returning()
      .get();
    const deptA = db
      .insert(schema.departments)
      .values({ name: "گروه-الف", managerId: admin.id })
      .returning()
      .get();
    const deptB = db
      .insert(schema.departments)
      .values({ name: "گروه-ب", managerId: admin.id })
      .returning()
      .get();
    const person = (name: string, departmentId: number) =>
      db
        .insert(schema.users)
        .values({
          username: `${name}_${Math.random()}`,
          passwordHash: hash,
          role: "STAFF",
          fullName: name,
          fullNameNormalized: name,
          departmentId,
          departmentJoinedAt: day,
          mustChangePassword: false,
          isActive: true,
        })
        .returning()
        .get();
    const a1 = person("الف۱", deptA.id);
    const a2 = person("الف۲", deptA.id);
    const b1 = person("ب۱", deptB.id);
    const shared = person("مشترک", deptA.id);
    db.insert(schema.userDepartments)
      .values([
        { userId: a1.id, departmentId: deptA.id, joinedAt: day },
        { userId: a2.id, departmentId: deptA.id, joinedAt: day },
        { userId: b1.id, departmentId: deptB.id, joinedAt: day },
        { userId: shared.id, departmentId: deptA.id, joinedAt: day },
        { userId: shared.id, departmentId: deptB.id, joinedAt: "2026-06-01" },
      ])
      .run();
    const template = db
      .insert(schema.taskTemplates)
      .values({
        title: "مشترک دو دپارتمان",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        startDate: day,
        completionMode: "SHARED",
        isActive: true,
        createdBy: admin.id,
      })
      .returning()
      .get();
    for (const departmentId of [deptA.id, deptB.id]) {
      db.insert(schema.taskAssignments)
        .values({
          templateId: template.id,
          assigneeType: "DEPARTMENT",
          departmentId,
        })
        .run();
    }
    const occ = (userId: number, sourceDepartmentId: number) =>
      db
        .insert(schema.taskOccurrences)
        .values({
          templateId: template.id,
          userId,
          periodKey: `D:${day}`,
          periodStart: day,
          periodEnd: day,
          status: "PENDING",
          sourceDepartmentId,
        })
        .returning()
        .get();
    const a1Occ = occ(a1.id, deptA.id);
    const a2Occ = occ(a2.id, deptA.id);
    const b1Occ = occ(b1.id, deptB.id);
    const sharedOcc = occ(shared.id, deptA.id);

    const { recordGroupOutcome } = await import("./group-completion");
    recordGroupOutcome({
      templateId: template.id,
      periodKey: `D:${day}`,
      completerUserId: a1.id,
      sourceOccurrenceId: a1Occ.id,
      status: "DONE",
      completedAt: new Date(`${day}T12:00:00+03:30`),
      note: null,
      reasonCode: null,
      attachmentPath: null,
      editedAt: null,
    });

    const statusOf = (id: number) =>
      db
        .select()
        .from(schema.taskOccurrences)
        .where(eq(schema.taskOccurrences.id, id))
        .get()!.status;
    expect(statusOf(a1Occ.id)).toBe("DONE");
    expect(statusOf(a2Occ.id)).toBe("DONE_BY_PEER");
    expect(statusOf(sharedOcc.id)).toBe("DONE_BY_PEER");
    expect(statusOf(b1Occ.id)).toBe("PENDING");
  });
});
