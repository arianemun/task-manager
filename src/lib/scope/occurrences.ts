import { eq, inArray, sql, type SQL } from "drizzle-orm";
import { taskOccurrences } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import type { AuthUser } from "@/lib/auth/user";

/** محدوده occurrence برای گزارش، بورد و خروجی. ادمین فیلتر اختیاری دارد؛ سرپرست فقط دپارتمان‌های خودش. */
export function occurrenceSourceScope(
  actor: AuthUser,
  requestedDepartmentId: number | null,
): SQL | undefined {
  if (actor.role === "MANAGER") {
    const ids =
      requestedDepartmentId != null &&
      actor.departmentIds.includes(requestedDepartmentId)
        ? [requestedDepartmentId]
        : actor.departmentIds;
    if (ids.length === 0) return sql`1 = 0`;
    return inArray(taskOccurrences.sourceDepartmentId, ids);
  }
  if (requestedDepartmentId != null) {
    return eq(taskOccurrences.sourceDepartmentId, requestedDepartmentId);
  }
  return undefined;
}

export function assertOccurrenceSourceInScope(
  actor: AuthUser,
  sourceDepartmentId: number,
): void {
  if (actor.role === "ADMIN") return;
  if (
    actor.role === "MANAGER" &&
    actor.departmentIds.includes(sourceDepartmentId)
  ) {
    return;
  }
  throw new AuthError("FORBIDDEN", "این کار خارج از دپارتمان شماست");
}
