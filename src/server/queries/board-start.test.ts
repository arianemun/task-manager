import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth/user";

const DAY = "2026-10-10";
const BEFORE = Date.parse("2026-10-10T05:29:00.000Z");

describe("بورد و کار ساعت‌دار", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-board-start-"));
    const dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE);
    execSync("npx drizzle-kit migrate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("کار را با وضعیت هنوز شروع نشده نشان می‌دهد و در درصد مثل در جریان است", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { loadBoardDay } = await import("./board");
    const { aggregateStatusDonut } = await import("./admin-reports");
    const { parseReportFilters } = await import("@/lib/reports");

    const dept = db.insert(schema.departments).values({ name: "کافه" }).returning().get();
    const admin = db
      .insert(schema.users)
      .values({
        username: "admin",
        passwordHash: "x",
        role: "ADMIN",
        fullName: "مدیر",
        fullNameNormalized: "مدیر",
        isActive: true,
      })
      .returning()
      .get();
    const staff = db
      .insert(schema.users)
      .values({
        username: "ali",
        passwordHash: "x",
        role: "STAFF",
        fullName: "علی",
        fullNameNormalized: "علی",
        isActive: true,
      })
      .returning()
      .get();
    const hidden = db
      .insert(schema.taskTemplates)
      .values({
        title: "بعدازظهر",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        startDate: DAY,
        startTime: "14:00",
        dueTime: "18:00",
        createdBy: admin.id,
      })
      .returning()
      .get();
    const done = db
      .insert(schema.taskTemplates)
      .values({
        title: "صبح",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        startDate: DAY,
        createdBy: admin.id,
      })
      .returning()
      .get();
    db.insert(schema.taskOccurrences)
      .values([
        {
          templateId: hidden.id,
          userId: staff.id,
          sourceDepartmentId: dept.id,
          periodKey: `D:${DAY}`,
          periodStart: DAY,
          periodEnd: DAY,
          dueAt: new Date(Date.parse("2026-10-10T04:30:00.000Z")),
          status: "PENDING",
        },
        {
          templateId: done.id,
          userId: staff.id,
          sourceDepartmentId: dept.id,
          periodKey: `D:${DAY}`,
          periodStart: DAY,
          periodEnd: DAY,
          status: "DONE",
        },
      ])
      .run();

    const actor: AuthUser = {
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      role: "ADMIN",
      departmentId: null,
      departmentIds: [],
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      permissions: ["reports.view_all"],
      avatarPath: null,
    };
    const board = loadBoardDay(actor, DAY);
    const cell = board.cells.find((item) => item.templateId === hidden.id);
    expect(cell?.status).toBe("PENDING");
    expect(cell?.notStarted).toBe(true);
    expect(board.summary.completionRate).toBe(100);
    expect(board.summary.unanswered).toBe(0);

    const filters = parseReportFilters({ range: "custom", from: DAY, to: DAY });
    const donut = aggregateStatusDonut(actor, filters);
    expect(donut.rates.overdue).toBe(0);
    expect(donut.rates.inProgress).toBe(1);
    expect(donut.rates.completionRate).toBe(100);
  });
});
