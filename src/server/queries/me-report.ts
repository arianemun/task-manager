import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { holidays, taskOccurrences, taskTemplates } from "@/db/schema";
import {
  addGregorianDays,
  endOfJalaliMonth,
  endOfJalaliWeek,
  startOfJalaliMonth,
  startOfJalaliWeek,
  todayTehran,
  type GDate,
} from "@/lib/dates";
import {
  computeStreaks,
  ratesFromCounts,
  type StreakDay,
} from "@/lib/reports";
import { isUserOnLeave, leaveDatesForUser } from "@/server/queries/me-today";
import { ratesByPeriodEnd } from "@/server/queries/report-core";

/**
 * گزارش پرسنل — درصد هفته/ماه دقیقاً با گزارش مدیر برای همان نفر و بازه
 * (قاعده period_end + ratesFromCounts در lib/reports).
 */
export function loadMeReport(userId: number) {
  const today = todayTehran();
  const weekStart = startOfJalaliWeek(today);
  const weekEnd = endOfJalaliWeek(today);
  const monthStart = startOfJalaliMonth(today);
  const monthEnd = endOfJalaliMonth(today);
  const from30 = addGregorianDays(today, -29);

  const weekRates = ratesByPeriodEnd({
    userId,
    from: weekStart,
    to: weekEnd,
  });
  const monthRates = ratesByPeriodEnd({
    userId,
    from: monthStart,
    to: monthEnd,
  });

  // برای streak و نمودار ۳۰ روز — روزانه با period_end
  const recent = db
    .select({
      id: taskOccurrences.id,
      status: taskOccurrences.status,
      periodKey: taskOccurrences.periodKey,
      periodEnd: taskOccurrences.periodEnd,
      title: taskTemplates.title,
      note: taskOccurrences.note,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        eq(taskOccurrences.userId, userId),
        sql`${taskOccurrences.periodEnd} >= ${addGregorianDays(today, -120)}`,
        sql`${taskOccurrences.periodEnd} <= ${today}`,
      ),
    )
    .all();

  const holidaySet = new Set(
    db
      .select({ date: holidays.date })
      .from(holidays)
      .all()
      .map((h) => h.date),
  );
  const leaveSet = leaveDatesForUser(
    userId,
    addGregorianDays(today, -120),
    today,
  );

  const streakDays: StreakDay[] = [];
  for (let i = 0; i < 120; i++) {
    const date = addGregorianDays(today, -i);
    if (holidaySet.has(date) || leaveSet.has(date) || isUserOnLeave(userId, date)) {
      streakDays.push({ date, kind: "skip" });
      continue;
    }
    const daily = recent.filter(
      (r) =>
        (r.periodKey.startsWith("D:") || r.periodKey.startsWith("O:")) &&
        r.periodEnd === date,
    );
    if (daily.length === 0) {
      streakDays.push({ date, kind: "skip" });
      continue;
    }
    const actionable = daily.filter(
      (r) => r.status !== "EXCUSED" && r.status !== "PENDING",
    );
    if (actionable.length === 0) {
      streakDays.push({ date, kind: "skip" });
      continue;
    }
    const allDone = actionable.every(
      (r) => r.status === "DONE" || r.status === "DONE_LATE",
    );
    streakDays.push({ date, kind: "work", allDone });
  }

  const streaks = computeStreaks(streakDays);

  const bar30: Array<{
    date: GDate;
    rate: number | null;
    done: number;
    total: number;
  }> = [];
  for (let i = 29; i >= 0; i--) {
    const date = addGregorianDays(today, -i);
    const daily = recent.filter(
      (r) =>
        (r.periodKey.startsWith("D:") || r.periodKey.startsWith("O:")) &&
        r.periodEnd === date,
    );
    const counts: Record<string, number> = {};
    for (const r of daily) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    const rates = ratesFromCounts(counts);
    bar30.push({
      date,
      rate: rates.completionRate,
      done: rates.done + rates.doneLate,
      total: rates.countable,
    });
  }

  const recentProblems = recent
    .filter((r) => r.status === "NOT_DONE" || r.status === "MISSED")
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
    .slice(0, 15);

  const rangeCounts = ratesByPeriodEnd({
    userId,
    from: from30,
    to: today,
  });

  return {
    today,
    weekStats: {
      done: weekRates.done + weekRates.doneLate,
      total: weekRates.countable,
      rate: weekRates.completionRate,
    },
    monthStats: {
      done: monthRates.done + monthRates.doneLate,
      total: monthRates.countable,
      rate: monthRates.completionRate,
    },
    /** هم‌تراز با rates مدیر */
    weekRates,
    monthRates,
    counts: {
      done: rangeCounts.done + rangeCounts.doneLate,
      notDone: rangeCounts.notDone,
      missed: rangeCounts.missed,
    },
    streaks,
    bar30,
    recentProblems,
  };
}
