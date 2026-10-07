import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { compareGDate, type GDate } from "@/lib/dates";

export type MembershipInterval = {
  joinedAt: GDate | null;
  leftAt: GDate | null;
};

const ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * تنها تعریف عضویت فعلی: ردیفی که left_at آن خالی است.
 * alias فقط شناسهٔ جدول است، مثلاً user_departments یا ud.
 */
export function currentMembershipSql(alias = "user_departments"): SQL {
  if (!ALIAS.test(alias)) {
    throw new Error("نام مستعار جدول نامعتبر است");
  }
  return sql`${sql.raw(alias)}.left_at is null`;
}

/** period_start داخل [joined_at, left_at) باشد. joined_at تهی یعنی از ابتدا. */
export function periodInsideMembership(
  periodStart: GDate,
  interval: MembershipInterval,
): boolean {
  if (interval.joinedAt && compareGDate(periodStart, interval.joinedAt) < 0) {
    return false;
  }
  if (interval.leftAt && compareGDate(periodStart, interval.leftAt) >= 0) {
    return false;
  }
  return true;
}

/** همان بازه برای بررسی سلامت، روی ردیف‌های user_departments. */
export function wasMemberAtPeriodSql(input: {
  userId: SQLWrapper;
  departmentId: SQLWrapper;
  periodStart: SQLWrapper;
}): SQL {
  return sql`EXISTS (
    SELECT 1 FROM user_departments AS ud
    WHERE ud.user_id = ${input.userId}
      AND ud.department_id = ${input.departmentId}
      AND ud.joined_at <= ${input.periodStart}
      AND (
        ud.left_at IS NULL
        OR ${input.periodStart} < ud.left_at
      )
  )`;
}
