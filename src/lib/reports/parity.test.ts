import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { fromZonedTime } from "date-fns-tz";
import {
  endOfJalaliMonth,
  endOfJalaliWeek,
  fromJalali,
  resetNowProvider,
  setNowProvider,
  startOfJalaliMonth,
  startOfJalaliWeek,
} from "@/lib/dates";
import { ratesFromStatusList } from "./status-counts";
import { ratesFromCounts } from "./rates";
import { countableCompletion } from "./streak";

describe("parity me ↔ admin rates", () => {
  beforeEach(() => {
    setNowProvider(() =>
      fromZonedTime("2025-06-15T08:00:00", "Asia/Tehran"),
    );
  });
  afterEach(() => {
    resetNowProvider();
  });

  it("ratesFromStatusList با countableCompletion و ratesFromCounts یکی است", () => {
    const statuses = [
      "DONE",
      "DONE_LATE",
      "NOT_DONE",
      "PENDING",
      "EXCUSED",
      "MISSED",
    ];
    const a = ratesFromStatusList(statuses);
    const b = countableCompletion(statuses);
    expect(a.countable).toBe(b.total);
    expect(a.done + a.doneLate).toBe(b.done);
    expect(a.completionRate).toBe(b.rate);
    expect(a.completionRate).toBe(
      ratesFromCounts({
        DONE: 1,
        DONE_LATE: 1,
        NOT_DONE: 1,
        PENDING: 1,
        EXCUSED: 1,
        MISSED: 1,
      }).completionRate,
    );
  });

  it("ratesByPeriodEnd برای یک کاربر با فیلتر مدیر یکی است", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("x", 4);
    const today = fromJalali(1404, 3, 25);
    setNowProvider(() => fromZonedTime(`${today}T08:00:00`, "Asia/Tehran"));

    const admin = db
      .insert(schema.users)
      .values({
        username: `parity_a_${Date.now()}`,
        passwordHash: hash,
        role: "ADMIN",
        fullName: "ا",
        fullNameNormalized: "ا",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();

    const staff = db
      .insert(schema.users)
      .values({
        username: `parity_s_${Date.now()}`,
        passwordHash: hash,
        role: "STAFF",
        fullName: "پ",
        fullNameNormalized: "پ",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();

    const tpl = db
      .insert(schema.taskTemplates)
      .values({
        title: "parity",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        startDate: fromJalali(1404, 3, 1),
        skipHolidays: false,
        isActive: true,
        createdBy: admin.id,
      })
      .returning({ id: schema.taskTemplates.id })
      .get();

    const weekStart = startOfJalaliWeek(today);
    const weekEnd = endOfJalaliWeek(today);
    const monthStart = startOfJalaliMonth(today);
    const monthEnd = endOfJalaliMonth(today);

    // چند occurrence با period_end داخل هفته/ماه
    const rows = [
      { end: weekStart, status: "DONE" as const },
      { end: today, status: "DONE_LATE" as const },
      { end: today, status: "PENDING" as const },
      { end: today, status: "EXCUSED" as const },
      { end: monthStart, status: "NOT_DONE" as const },
    ];
    let i = 0;
    for (const r of rows) {
      db.insert(schema.taskOccurrences)
        .values({
          templateId: tpl.id,
          userId: staff.id,
          periodKey: `D:parity-${i++}`,
          periodStart: r.end,
          periodEnd: r.end,
          status: r.status,
        })
        .run();
    }

    const { ratesByPeriodEnd } = await import("@/server/queries/report-core");
    const { loadMeReport } = await import("@/server/queries/me-report");
    const { aggregateStatusDonut } = await import(
      "@/server/queries/admin-reports"
    );
    const { parseReportFilters } = await import("@/lib/reports");

    const me = loadMeReport(staff.id);
    const weekCore = ratesByPeriodEnd({
      userId: staff.id,
      from: weekStart,
      to: weekEnd,
    });
    const monthCore = ratesByPeriodEnd({
      userId: staff.id,
      from: monthStart,
      to: monthEnd,
    });

    expect(me.weekRates.completionRate).toBe(weekCore.completionRate);
    expect(me.monthRates.completionRate).toBe(monthCore.completionRate);
    expect(me.weekStats.rate).toBe(weekCore.completionRate);
    expect(me.monthStats.rate).toBe(monthCore.completionRate);

    const actor = {
      id: admin.id,
      username: "a",
      fullName: "ا",
      role: "ADMIN" as const,
      departmentId: null,
      departmentIds: [],
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      permissions: [],
      avatarPath: null,
    };

    const weekF = parseReportFilters({ range: "week" });
    weekF.userId = staff.id;
    const monthF = parseReportFilters({ range: "month" });
    monthF.userId = staff.id;

    const adminWeek = aggregateStatusDonut(actor, weekF).rates;
    const adminMonth = aggregateStatusDonut(actor, monthF).rates;

    expect(adminWeek.completionRate).toBe(me.weekRates.completionRate);
    expect(adminWeek.countable).toBe(me.weekRates.countable);
    expect(adminMonth.completionRate).toBe(me.monthRates.completionRate);
    expect(adminMonth.countable).toBe(me.monthRates.countable);

    // cleanup
    db.delete(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.templateId, tpl.id))
      .run();
    db.delete(schema.taskTemplates)
      .where(eq(schema.taskTemplates.id, tpl.id))
      .run();
    db.delete(schema.users)
      .where(
        and(
          eq(schema.users.id, staff.id),
        ),
      )
      .run();
    db.delete(schema.users).where(eq(schema.users.id, admin.id)).run();
  });
});
