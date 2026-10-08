import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("دود کوئری صفحات پنل", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-panel-smoke-"));
    const dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    process.env.ADMIN_INITIAL_PASSWORD = "Admin@123456";
    vi.resetModules();
    const env = { ...process.env, DATABASE_URL: `file:${dbPath}`, NODE_ENV: "development" };
    execSync("npx drizzle-kit migrate", { cwd: process.cwd(), env, stdio: "pipe" });
    execSync("npx tsx src/db/seed.ts", { cwd: process.cwd(), env, stdio: "pipe" });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("کوئری اصلی هر صفحه را بدون خطای SQL اجرا می‌کند", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { loadAuthUserById } = await import("@/lib/auth/user");
    const { todayTehran } = await import("@/lib/dates");
    const { parseReportFilters } = await import("@/lib/reports");
    const { getNotDoneReasonsForDepartments } = await import("@/lib/settings/not-done-reasons");
    const staffQueries = await import("./staff");
    const taskQueries = await import("./tasks");
    const announcementQueries = await import("./announcements");
    const auditQueries = await import("./audit");
    const boardQueries = await import("./board");
    const reportQueries = await import("./admin-reports");
    const { loadMeToday } = await import("./me-today");
    const { loadMeReport } = await import("./me-report");
    const { loadLastHealthReport } = await import("@/lib/health/db-check");

    const adminRow = db.select().from(schema.users).where(eq(schema.users.username, "admin")).get();
    const staffRow = db.select().from(schema.users).where(eq(schema.users.username, "staff1")).get();
    const dept = db.select().from(schema.departments).where(eq(schema.departments.name, "عملیات")).get();
    if (!adminRow || !staffRow || !dept) throw new Error("seed ناقص است");
    db.insert(schema.userDepartments)
      .values({ userId: staffRow.id, departmentId: dept.id, joinedAt: "2026-01-01" })
      .run();
    db.insert(schema.holidays).values({ date: "2026-03-21", title: "نوروز" }).run();
    const announcement = db
      .insert(schema.announcements)
      .values({
        title: "اطلاع",
        body: "متن",
        audience: "ALL",
        authorId: adminRow.id,
        isPinned: true,
      })
      .returning({ id: schema.announcements.id })
      .get();
    db.insert(schema.auditLogs)
      .values({ actorId: adminRow.id, action: "auth.login", entity: "user", entityId: String(adminRow.id) })
      .run();

    const admin = loadAuthUserById(adminRow.id);
    const staff = loadAuthUserById(staffRow.id);
    if (!admin || !staff) throw new Error("کاربر بارگذاری نشد");
    const today = todayTehran();
    const filters = parseReportFilters({ range: "month" });

    const steps: Array<[string, () => unknown]> = [
      ["پرسنل", () => staffQueries.listStaffForActor(admin, { status: "all", pageSize: 20 })],
      ["دپارتمان‌ها", () => staffQueries.listAllDepartments()],
      ["کارها", () => taskQueries.listTasksForActor(admin, { status: "all" })],
      ["دسته‌ها", () => taskQueries.listCategories()],
      [
        "تعطیلات",
        () => db.select().from(schema.holidays).orderBy(asc(schema.holidays.date)).all(),
      ],
      ["اطلاعیه‌ها", () => announcementQueries.listAnnouncementsForAdmin(admin)],
      ["شمار خوانده‌شدن اطلاعیه", () => announcementQueries.announcementReadCounts(announcement.id)],
      ["audit", () => auditQueries.listAuditLogs({ page: 1, pageSize: 30 })],
      ["بورد روز", () => boardQueries.loadBoardDay(admin, today, null)],
      ["بورد هفته", () => boardQueries.loadBoardPeriod(admin, "week", today, null)],
      ["گزارش روز", () => reportQueries.aggregateByDay(admin, filters)],
      ["گزارش وضعیت", () => reportQueries.aggregateStatusDonut(admin, filters)],
      ["گزارش پرسنل", () => reportQueries.aggregateByStaff(admin, filters)],
      ["گزارش دپارتمان", () => reportQueries.aggregateByDepartment(admin, filters)],
      ["گزارش کارها", () => reportQueries.aggregateWorstTasks(admin, filters)],
      ["گزارش هفته", () => reportQueries.aggregateWeekdayRates(admin, filters)],
      ["گزارش ساعت", () => reportQueries.aggregateCompletionHours(admin, filters)],
      ["گزارش دلیل", () => reportQueries.aggregateReasons(admin, filters)],
      ["نقشه حرارت", () => reportQueries.staffDayHeatmap(admin, filters)],
      ["جزئیات گزارش", () => reportQueries.listOccurrenceDetails(admin, filters)],
      ["کار مشترک", () => reportQueries.sharedGroupSummary(admin, filters)],
      ["داشبورد", () => reportQueries.loadDashboardKpis(admin)],
      ["سلامت داده", () => loadLastHealthReport()],
      ["امروز من", () => loadMeToday(staff.id)],
      ["گزارش من", () => loadMeReport(staff.id)],
      ["اطلاعیه من", () => announcementQueries.listAnnouncementsForStaff(staff)],
      ["دلایل انجام‌نشدن", () => getNotDoneReasonsForDepartments(staff.departmentIds)],
    ];

    for (const [name, run] of steps) {
      try {
        run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${name}: ${message}`);
      }
    }

    expect(staffQueries.listAllDepartments().some((row) => row.memberCount > 0)).toBe(true);
  });
});
