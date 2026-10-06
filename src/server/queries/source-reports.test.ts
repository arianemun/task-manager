import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth/user";
import type { Db } from "@/db";

describe("گزارش بر اساس دپارتمان منبع", () => {
  let tmpDir: string;
  let db: Db;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-source-report-"));
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

  it("جمع دپارتمان‌ها برابر کل است و فیلتر پرسنل آمار همان منبع را می‌شمارد", async () => {
    const schema = await import("@/db/schema");
    const { parseReportFilters } = await import("@/lib/reports");
    const { aggregateByDepartment, aggregateStatusDonut } = await import(
      "@/server/queries/admin-reports"
    );
    const { listStaffForActor } = await import("@/server/queries/staff");
    const { listTasksForActor } = await import("@/server/queries/tasks");
    const { loadBoardDay } = await import("@/server/queries/board");

    const adminRow = db
      .insert(schema.users)
      .values({
        username: `adm_${Math.random()}`,
        passwordHash: "x",
        role: "ADMIN",
        fullName: "ادمین",
        fullNameNormalized: "ادمین",
        mustChangePassword: false,
        isActive: true,
      })
      .returning()
      .get();
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
      })
      .returning()
      .get();
    db.insert(schema.userDepartments)
      .values([
        { userId: shared.id, departmentId: deptA.id, joinedAt: "2026-01-01" },
        { userId: shared.id, departmentId: deptB.id, joinedAt: "2026-02-01" },
      ])
      .run();
    const templateA = db
      .insert(schema.taskTemplates)
      .values({
        title: "کار الف",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        startDate: "2026-10-01",
        isActive: true,
        createdBy: adminRow.id,
      })
      .returning()
      .get();
    const templateB = db
      .insert(schema.taskTemplates)
      .values({
        title: "کار ب",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        startDate: "2026-10-01",
        isActive: true,
        createdBy: adminRow.id,
      })
      .returning()
      .get();
    db.insert(schema.taskOccurrences)
      .values([
        {
          templateId: templateA.id,
          userId: shared.id,
          periodKey: "D:2026-10-06",
          periodStart: "2026-10-06",
          periodEnd: "2026-10-06",
          status: "DONE",
          completedAt: new Date("2026-10-06T12:00:00+03:30"),
          sourceDepartmentId: deptA.id,
        },
        {
          templateId: templateB.id,
          userId: shared.id,
          periodKey: "D:2026-10-06",
          periodStart: "2026-10-06",
          periodEnd: "2026-10-06",
          status: "MISSED",
          sourceDepartmentId: deptB.id,
        },
      ])
      .run();

    const actor: AuthUser = {
      id: adminRow.id,
      username: adminRow.username,
      fullName: adminRow.fullName,
      role: "ADMIN",
      departmentId: null,
      departmentIds: [],
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      permissions: ["reports.view_all", "tasks.assign"],
      avatarPath: null,
    };
    const filters = parseReportFilters({
      range: "custom",
      from: "2026-10-01",
      to: "2026-10-07",
    });
    const departments = aggregateByDepartment(actor, filters);
    const counted = departments.reduce((sum, row) => {
      return (
        sum +
        Object.values(row.counts).reduce((inner, value) => inner + (value ?? 0), 0)
      );
    }, 0);
    const org = aggregateStatusDonut(actor, filters);
    const orgTotal = Object.values(org.counts).reduce(
      (sum, value) => sum + (value ?? 0),
      0,
    );
    expect(counted).toBe(orgTotal);
    expect(counted).toBe(2);
    expect(departments.map((row) => row.name).sort()).toEqual(["الف", "ب"]);

    const onlyA = aggregateByDepartment(actor, {
      ...filters,
      departmentId: deptA.id,
    });
    expect(onlyA).toHaveLength(1);
    expect(onlyA[0]?.counts.DONE).toBe(1);

    const staffA = listStaffForActor(actor, {
      departmentId: deptA.id,
      status: "all",
      pageSize: 50,
    });
    const staffB = listStaffForActor(actor, {
      departmentId: deptB.id,
      status: "all",
      pageSize: 50,
    });
    const rowA = staffA.rows.find((row) => row.id === shared.id);
    const rowB = staffB.rows.find((row) => row.id === shared.id);
    expect(rowA).toBeTruthy();
    expect(rowB).toBeTruthy();
    expect(rowA?.sourceTaskCount).toBe(1);
    expect(rowB?.sourceTaskCount).toBe(1);

    const tasksA = listTasksForActor(actor, { departmentId: deptA.id });
    expect(tasksA.map((row) => row.id)).toContain(templateA.id);
    expect(tasksA.map((row) => row.id)).not.toContain(templateB.id);

    const board = loadBoardDay(actor, "2026-10-06", deptA.id);
    expect(board.cells.map((cell) => cell.templateId)).toEqual([templateA.id]);
  });
});
