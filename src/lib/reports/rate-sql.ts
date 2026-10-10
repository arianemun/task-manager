import { sql, type SQL } from "drizzle-orm";
import { taskOccurrences, taskTemplates } from "@/db/schema";
import { tehranDateFromMs } from "@/lib/dates";

/**
 * تصویر SQL قاعده classifyOccurrence برای ردیف‌هایی که period_end داخل بازه است.
 * PENDING با due_at گذشته → OVERDUE، مگر ساعت شروع امروز هنوز نرسیده باشد
 * که مثل «در جریان» همان PENDING می‌ماند.
 * کوئری باید task_templates را join کرده باشد.
 */
export function rateStatusSql(nowMs: number): SQL<string> {
  const today = tehranDateFromMs(nowMs);
  const tehranClock = sql`strftime('%H:%M', ${nowMs} / 1000, 'unixepoch', '+3 hours', '+30 minutes')`;
  return sql<string>`CASE
    WHEN ${taskOccurrences.status} IN ('EXCUSED', 'DONE_BY_PEER') THEN ${taskOccurrences.status}
    WHEN ${taskOccurrences.status} = 'PENDING'
      AND ${taskTemplates.startTime} IS NOT NULL
      AND length(${taskTemplates.startTime}) = 5
      AND ${taskTemplates.startTime} >= '00:00'
      AND ${taskTemplates.startTime} <= '23:59'
      AND ${taskOccurrences.periodStart} <= ${today}
      AND ${taskOccurrences.periodEnd} >= ${today}
      AND ${tehranClock} < ${taskTemplates.startTime}
      THEN ${taskOccurrences.status}
    WHEN ${taskOccurrences.status} = 'PENDING'
      AND ${taskOccurrences.dueAt} IS NOT NULL
      AND ${taskOccurrences.dueAt} <= ${nowMs}
      THEN 'OVERDUE'
    ELSE ${taskOccurrences.status}
  END`;
}
