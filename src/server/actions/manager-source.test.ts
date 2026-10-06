import { eq } from "drizzle-orm";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import type { AuthUser } from "@/lib/auth/user";

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

describe("ایزوله‌سازی سرپرست با دپارتمان منبع", () => {
  let tmpDir: string;
  let db: Db;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-mgr-source-"));
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

  it("سرپرست الف به occurrence دپارتمان ب دسترسی ندارد", async () => {
    const schema = await import("@/db/schema");
    const { createSessionToken } = await import("@/lib/auth/session");
    const { updateOccurrenceStatusAction } = await import(
      "@/server/actions/board"
    );
    const { getStaffDetailForActor } = await import("@/server/queries/staff");
    const { loadBoardDay } = await import("@/server/queries/board");
    const { AuthError } = await import("@/lib/auth/errors");

    const deptA = db
      .insert(schema.departments)
      .values({ name: "الف" })
      .returning()
      .get();
    const deptB = db
      .insert(schema.departments)
      .values({ name: "ب" })
      .returning()
      .get();
    const manager = db
      .insert(schema.users)
      .values({
        username: `mgr_${Math.random()}`,
        passwordHash: "x",
        role: "MANAGER",
        fullName: "سرپرست الف",
        fullNameNormalized: "سرپرست الف",
        departmentId: deptA.id,
        departmentJoinedAt: "2026-01-01",
        mustChangePassword: false,
        isActive: true,
        sessionVersion: 1,
      })
      .returning()
      .get();
    const shared = db
      .insert(schema.users)
      .values({
        username: `sh_${Math.random()}`,
        passwordHash: "x",
        role: "STAFF",
        fullName: "مشترک",
        fullNameNormalized: "مشترک",
        departmentId: deptA.id,
        departmentJoinedAt: "2026-01-01",
        mustChangePassword: false,
        isActive: true,
        sessionVersion: 1,
      })
      .returning()
      .get();
    const onlyB = db
      .insert(schema.users)
      .values({
        username: `b_${Math.random()}`,
        passwordHash: "x",
        role: "STAFF",
        fullName: "فقط ب",
        fullNameNormalized: "فقط ب",
        departmentId: deptB.id,
        departmentJoinedAt: "2026-01-01",
        mustChangePassword: false,
        isActive: true,
        sessionVersion: 1,
      })
      .returning()
      .get();
    db.insert(schema.userDepartments)
      .values([
        { userId: manager.id, departmentId: deptA.id, joinedAt: "2026-01-01" },
        { userId: shared.id, departmentId: deptA.id, joinedAt: "2026-01-01" },
        { userId: shared.id, departmentId: deptB.id, joinedAt: "2026-02-01" },
        { userId: onlyB.id, departmentId: deptB.id, joinedAt: "2026-01-01" },
      ])
      .run();
    const template = db
      .insert(schema.taskTemplates)
      .values({
        title: "کار ب",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        startDate: "2026-10-01",
        isActive: true,
        createdBy: manager.id,
      })
      .returning()
      .get();
    const hidden = db
      .insert(schema.taskOccurrences)
      .values({
        templateId: template.id,
        userId: shared.id,
        periodKey: "D:2026-10-06",
        periodStart: "2026-10-06",
        periodEnd: "2026-10-06",
        status: "PENDING",
        sourceDepartmentId: deptB.id,
      })
      .returning()
      .get();

    sessionJar.token = await createSessionToken(manager.id, manager.sessionVersion);
    const form = new FormData();
    form.set("occurrenceId", String(hidden.id));
    form.set("status", "DONE");
    form.set("reason", "دستکاری شناسه");
    const result = await updateOccurrenceStatusAction(null, form);
    expect(result.ok).toBe(false);

    const actor: AuthUser = {
      id: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "MANAGER",
      departmentId: deptA.id,
      departmentIds: [deptA.id],
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      permissions: ["tasks.assign", "reports.view_department"],
      avatarPath: null,
    };
    expect(loadBoardDay(actor, "2026-10-06").cells).toHaveLength(0);
    expect(getStaffDetailForActor(actor, shared.id).user.id).toBe(shared.id);
    expect(() => getStaffDetailForActor(actor, onlyB.id)).toThrow(AuthError);

    const still = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.id, hidden.id))
      .get();
    expect(still?.status).toBe("PENDING");
  });
});
