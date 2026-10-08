import { eq } from "drizzle-orm";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";

const sessionJar = vi.hoisted(() => ({
  token: null as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (sessionJar.token ? { value: sessionJar.token } : undefined),
    set: () => undefined,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

describe("ساخت چند کار و diff لاگ", () => {
  let tmpDir: string;
  let db: Db;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-bulk-"));
    const dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    execSync("npx drizzle-kit migrate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
    vi.resetModules();
    db = (await import("@/db")).db;
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("پنج خط با یکی خالی و یکی تکراری چهار کار می‌سازد و ویرایش عنوان و گیرنده diff درست می‌نویسد", async () => {
    const schema = await import("@/db/schema");
    const { createSessionToken } = await import("@/lib/auth/session");
    const { todayTehran } = await import("@/lib/dates");
    const { bulkCreateTasksAction, updateTaskAction } = await import(
      "@/server/actions/tasks"
    );

    const dept = db
      .insert(schema.departments)
      .values({ name: "کافه" })
      .returning()
      .get();
    const other = db
      .insert(schema.departments)
      .values({ name: "آشپزخانه" })
      .returning()
      .get();
    const admin = db
      .insert(schema.users)
      .values({
        username: "admin_bulk",
        passwordHash: "x",
        role: "ADMIN",
        fullName: "مدیر",
        fullNameNormalized: "مدیر",
        mustChangePassword: false,
        isActive: true,
        sessionVersion: 1,
      })
      .returning()
      .get();
    const staff = db
      .insert(schema.users)
      .values({
        username: "staff_bulk",
        passwordHash: "x",
        role: "STAFF",
        fullName: "پرسنل",
        fullNameNormalized: "پرسنل",
        departmentId: other.id,
        departmentJoinedAt: "2026-01-01",
        mustChangePassword: false,
        isActive: true,
        sessionVersion: 1,
      })
      .returning()
      .get();
    db.insert(schema.userDepartments)
      .values({ userId: staff.id, departmentId: other.id, joinedAt: "2026-01-01" })
      .run();

    sessionJar.token = await createSessionToken(admin.id, admin.sessionVersion);

    const form = new FormData();
    form.set("titles", "نظافت\n\nنظافت\nجارو\nپولیش\nشستشو");
    form.set("startDate", todayTehran());
    form.set("recurrenceType", "DAILY");
    form.set("recurrenceConfig", JSON.stringify({ interval: 1, excludeWeekdays: [] }));
    form.set("priority", "MEDIUM");
    form.set("completionMode", "INDIVIDUAL");
    form.set("skipHolidays", "true");
    form.set("userIds", "[]");
    form.set("departmentIds", JSON.stringify([dept.id]));

    const created = await bulkCreateTasksAction(null, form);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.taskIds).toHaveLength(4);

    const rows = db.select().from(schema.taskTemplates).all();
    expect(rows.map((row) => row.title).sort()).toEqual(
      ["جارو", "شستشو", "نظافت", "پولیش"].sort(),
    );

    const bulk = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "task.bulk_create"))
      .all();
    expect(bulk).toHaveLength(1);
    expect(bulk[0]?.meta).toMatchObject({ ids: created.taskIds });

    const creates = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "task.create"))
      .all();
    expect(creates).toHaveLength(4);
    expect(creates[0]?.meta).toMatchObject({
      snapshot: { title: expect.any(String), departmentIds: [dept.id] },
    });

    const targetId = created.taskIds![0]!;
    const update = new FormData();
    update.set("id", String(targetId));
    update.set("title", "عنوان تازه");
    update.set("startDate", todayTehran());
    update.set("recurrenceType", "DAILY");
    update.set("recurrenceConfig", JSON.stringify({ interval: 1, excludeWeekdays: [] }));
    update.set("priority", "MEDIUM");
    update.set("completionMode", "INDIVIDUAL");
    update.set("skipHolidays", "true");
    update.set("userIds", JSON.stringify([staff.id]));
    update.set("departmentIds", "[]");
    const updated = await updateTaskAction(null, update);
    expect(updated.ok).toBe(true);

    const logs = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "task.update"))
      .all();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.meta).toMatchObject({
      title: { from: rows.find((row) => row.id === targetId)?.title, to: "عنوان تازه" },
      departmentIds: { from: [dept.id], to: [] },
      userIds: { from: [], to: [staff.id] },
    });
  });
});
