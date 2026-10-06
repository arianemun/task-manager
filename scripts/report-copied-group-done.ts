/**
 * سلامت داده: اگر occurrence بسته‌ای completed_by شخص دیگری داشته باشد
 * (به‌جای وضعیت DONE_BY_PEER) با کد خروج ۱ خطا می‌دهد.
 */
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { listCopiedForeignCloses } from "../src/lib/tasks/copied-group-done";

const rows = listCopiedForeignCloses();
const completerIds = [
  ...new Set(
    rows
      .map((row) => row.completedByUserId)
      .filter((id): id is number => id != null),
  ),
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

if (rows.length > 0) {
  console.error("copied foreign close rows found");
  process.exit(1);
}
