import { sql, type SQL } from "drizzle-orm";
import { taskOccurrences } from "@/db/schema";

/**
 * تصویر SQL قاعده classifyOccurrence برای ردیف‌هایی که period_end داخل بازه است.
 * PENDING با due_at گذشته → OVERDUE. DONE کپی‌شده روی همکار → DONE_BY_PEER.
 */
export function rateStatusSql(nowMs: number): SQL<string> {
  return sql<string>`CASE
    WHEN ${taskOccurrences.status} IN ('EXCUSED', 'DONE_BY_PEER') THEN ${taskOccurrences.status}
    WHEN ${taskOccurrences.completedByUserId} IS NOT NULL
      AND ${taskOccurrences.completedByUserId} != ${taskOccurrences.userId}
      AND ${taskOccurrences.status} IN ('DONE', 'DONE_LATE', 'NOT_DONE')
      THEN 'DONE_BY_PEER'
    WHEN ${taskOccurrences.status} = 'PENDING'
      AND ${taskOccurrences.dueAt} IS NOT NULL
      AND ${taskOccurrences.dueAt} <= ${nowMs}
      THEN 'OVERDUE'
    ELSE ${taskOccurrences.status}
  END`;
}
