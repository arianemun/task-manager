/**
 * فقط گزارش. هیچ ردیفی را عوض نمی‌کند.
 * occurrenceهایی که وضعیت بسته‌شان روی شخص دیگری ثبت شده
 * (کپی قدیمی کار گروهی) را فهرست می‌کند.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { taskOccurrences, taskTemplates, users } from "../src/db/schema";

const rows = db
  .select({
    id: taskOccurrences.id,
    status: taskOccurrences.status,
    periodKey: taskOccurrences.periodKey,
    userId: taskOccurrences.userId,
    staff: users.fullName,
    completedByUserId: taskOccurrences.completedByUserId,
    templateId: taskOccurrences.templateId,
    title: taskTemplates.title,
  })
  .from(taskOccurrences)
  .innerJoin(users, eq(taskOccurrences.userId, users.id))
  .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
  .where(
    and(
      isNotNull(taskOccurrences.completedByUserId),
      sql`${taskOccurrences.completedByUserId} != ${taskOccurrences.userId}`,
      inArray(taskOccurrences.status, ["DONE", "DONE_LATE", "NOT_DONE"]),
    ),
  )
  .all();

const completerIds = [
  ...new Set(rows.map((row) => row.completedByUserId).filter((id): id is number => id != null)),
];
const names = new Map<number, string>();
if (completerIds.length > 0) {
  for (const person of db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(inArray(users.id, completerIds))
    .all()) {
    names.set(person.id, person.fullName);
  }
}

console.log(`count=${rows.length}`);
for (const row of rows) {
  console.log(
    [
      `id=${row.id}`,
      `template=${row.templateId}`,
      `title=${row.title}`,
      `period=${row.periodKey}`,
      `staff=${row.userId}:${row.staff}`,
      `status=${row.status}`,
      `completedBy=${row.completedByUserId}:${names.get(row.completedByUserId ?? 0) ?? "?"}`,
    ].join(" | "),
  );
}
