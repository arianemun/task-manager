import { and, count, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { taskOccurrences, taskTemplates } from "@/db/schema";
import type { GDate } from "@/lib/dates";
import {
  ratesFromCounts,
  type StatusCounts,
} from "@/lib/reports";

/**
 * شمارش وضعیت‌ها با قاعده period_end در بازه — منبع مشترک /me/report و گزارش مدیر.
 */
export function statusCountsByPeriodEnd(input: {
  from: GDate;
  to: GDate;
  userId?: number;
  userIds?: number[] | null;
}): StatusCounts {
  const clauses: SQL[] = [
    sql`${taskOccurrences.periodEnd} >= ${input.from}`,
    sql`${taskOccurrences.periodEnd} <= ${input.to}`,
  ];
  if (input.userId != null) {
    clauses.push(eq(taskOccurrences.userId, input.userId));
  } else if (input.userIds) {
    if (input.userIds.length === 0) return {};
    clauses.push(inArray(taskOccurrences.userId, input.userIds));
  }

  const rows = db
    .select({
      status: taskOccurrences.status,
      c: count(),
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(and(...clauses))
    .groupBy(taskOccurrences.status)
    .all();

  const counts: StatusCounts = {};
  for (const r of rows) {
    counts[r.status as keyof StatusCounts] = Number(r.c);
  }
  return counts;
}

export function ratesByPeriodEnd(input: {
  from: GDate;
  to: GDate;
  userId?: number;
  userIds?: number[] | null;
}) {
  return ratesFromCounts(statusCountsByPeriodEnd(input));
}
