import { and, count, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { taskOccurrences, taskTemplates } from "@/db/schema";
import { compareGDate, todayTehran, type GDate } from "@/lib/dates";
import { classifyOccurrence } from "@/lib/reports/classify";
import { rateStatusSql } from "@/lib/reports/rate-sql";
import {
  mergeStatusCounts,
  ratesFromCounts,
  type StatusCounts,
} from "@/lib/reports";

/**
 * شمارش وضعیت‌ها با قاعده period_end در بازه — منبع مشترک /me/report و گزارش مدیر.
 */
function userClauses(input: {
  userId?: number;
  userIds?: number[] | null;
}): SQL[] | null {
  if (input.userId != null) return [eq(taskOccurrences.userId, input.userId)];
  if (input.userIds) {
    if (input.userIds.length === 0) return null;
    return [inArray(taskOccurrences.userId, input.userIds)];
  }
  return [];
}

/** دوره‌های جاری هفتگی/ماهانه که period_end بعد از بازه است. منطق در classifyOccurrence. */
export function openPeriodCounts(
  extra: SQL[],
  from: GDate,
  to: GDate,
): { counts: StatusCounts; byUser: Map<number, StatusCounts> } {
  const today = todayTehran();
  const byUser = new Map<number, StatusCounts>();
  if (compareGDate(from, today) > 0 || compareGDate(to, today) < 0) {
    return { counts: {}, byUser };
  }

  const rows = db
    .select({
      status: taskOccurrences.status,
      dueAt: taskOccurrences.dueAt,
      periodStart: taskOccurrences.periodStart,
      periodEnd: taskOccurrences.periodEnd,
      periodKey: taskOccurrences.periodKey,
      userId: taskOccurrences.userId,
      completedByUserId: taskOccurrences.completedByUserId,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        sql`${taskOccurrences.periodEnd} > ${to}`,
        sql`${taskOccurrences.periodStart} <= ${today}`,
        sql`${taskOccurrences.periodEnd} >= ${today}`,
        sql`(${taskOccurrences.periodKey} like 'W:%' OR ${taskOccurrences.periodKey} like 'M:%')`,
        ...extra,
      ),
    )
    .all();

  const counts: StatusCounts = {};
  const nowMs = Date.now();
  for (const row of rows) {
    const klass = classifyOccurrence(
      {
        status: row.status,
        dueAtMs: row.dueAt ? row.dueAt.getTime() : null,
        periodStart: row.periodStart as GDate,
        periodEnd: row.periodEnd as GDate,
        periodKey: row.periodKey,
        userId: row.userId,
        completedByUserId: row.completedByUserId,
      },
      { nowMs, from, to, today },
    );
    let key: keyof StatusCounts | null = null;
    if (klass.kind === "counted") key = klass.status;
    else if (klass.kind === "in_progress") key = "PENDING";
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
    const userCounts = byUser.get(row.userId) ?? {};
    userCounts[key] = (userCounts[key] ?? 0) + 1;
    byUser.set(row.userId, userCounts);
  }
  return { counts, byUser };
}

export function statusCountsByPeriodEnd(input: {
  from: GDate;
  to: GDate;
  userId?: number;
  userIds?: number[] | null;
}): StatusCounts {
  const usersFilter = userClauses(input);
  if (usersFilter == null) return {};

  const statusExpr = rateStatusSql(Date.now());
  const rows = db
    .select({
      status: statusExpr,
      c: count(),
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        sql`${taskOccurrences.periodEnd} >= ${input.from}`,
        sql`${taskOccurrences.periodEnd} <= ${input.to}`,
        ...usersFilter,
      ),
    )
    .groupBy(statusExpr)
    .all();

  const counts: StatusCounts = {};
  for (const r of rows) {
    counts[r.status as keyof StatusCounts] = Number(r.c);
  }
  const open = openPeriodCounts(usersFilter, input.from, input.to);
  return mergeStatusCounts(counts, open.counts);
}

export function ratesByPeriodEnd(input: {
  from: GDate;
  to: GDate;
  userId?: number;
  userIds?: number[] | null;
}) {
  return ratesFromCounts(statusCountsByPeriodEnd(input));
}
