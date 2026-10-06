import { and, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { users, type Role } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import type { AuthUser } from "@/lib/auth/user";
import {
  departmentIdsForUser,
  sharesDepartment,
  userInDepartmentsSql,
} from "@/lib/departments/membership";

/** شرط‌های محدوده برای لیست کاربران بر اساس نقش actor */
export function scopeUsersQuery(actor: AuthUser): SQL | undefined {
  if (actor.role === "ADMIN") {
    return undefined;
  }
  if (actor.role === "MANAGER") {
    if (actor.departmentIds.length === 0) {
      return eq(users.id, -1);
    }
    return and(userInDepartmentsSql(actor.departmentIds), isNull(users.deletedAt));
  }
  return eq(users.id, actor.id);
}

export function notDeleted(): SQL {
  return isNull(users.deletedAt);
}

/** اطمینان از دسترسی به یک کاربر خاص — دستکاری id در URL را می‌بندد */
export function assertUserInScope(
  actor: AuthUser,
  targetUserId: number,
): typeof users.$inferSelect {
  const row = db.select().from(users).where(eq(users.id, targetUserId)).get();
  if (!row || row.deletedAt) {
    throw new AuthError("FORBIDDEN", "کاربر یافت نشد یا خارج از محدوده دسترسی است");
  }

  if (actor.role === "ADMIN") return row;

  if (actor.role === "MANAGER") {
    if (
      !sharesDepartment(actor.departmentIds, departmentIdsForUser(row.id))
    ) {
      throw new AuthError(
        "FORBIDDEN",
        "به پرسنل این دپارتمان دسترسی ندارید",
      );
    }
    return row;
  }

  if (row.id !== actor.id) {
    throw new AuthError("FORBIDDEN", "دسترسی غیرمجاز");
  }
  return row;
}

export function assertCanAssignRole(
  actor: AuthUser,
  newRole: Role,
  targetUserId?: number,
): void {
  if (actor.role === "MANAGER") {
    if (newRole === "ADMIN") {
      throw new AuthError("FORBIDDEN", "سرپرست نمی‌تواند نقش مدیر کل تعیین کند");
    }
    if (targetUserId === actor.id && newRole !== actor.role) {
      throw new AuthError("FORBIDDEN", "نمی‌توانید نقش خود را تغییر دهید");
    }
  }

  if (actor.role === "ADMIN" && targetUserId === actor.id) {
    throw new AuthError("FORBIDDEN", "نمی‌توانید نقش خود را تغییر دهید");
  }
}

export function assertCanModifyPermissions(
  actor: AuthUser,
  targetUserId: number,
): void {
  if (actor.role === "MANAGER" && targetUserId === actor.id) {
    throw new AuthError(
      "FORBIDDEN",
      "سرپرست نمی‌تواند مجوزهای خودش را تغییر دهد",
    );
  }
}

export function countActiveAdmins(): number {
  return db
    .select()
    .from(users)
    .where(
      and(eq(users.role, "ADMIN"), eq(users.isActive, true), isNull(users.deletedAt)),
    )
    .all().length;
}

export function assertCanDeactivate(
  actor: AuthUser,
  target: typeof users.$inferSelect,
): void {
  if (target.id === actor.id) {
    throw new AuthError("FORBIDDEN", "نمی‌توانید حساب خودتان را غیرفعال کنید");
  }

  if (target.role === "ADMIN" && target.isActive) {
    const activeAdmins = countActiveAdmins();
    if (activeAdmins <= 1) {
      throw new AuthError(
        "FORBIDDEN",
        "آخرین مدیر کل فعال قابل غیرفعال‌سازی نیست",
      );
    }
  }

  if (actor.role === "MANAGER") {
    assertUserInScope(actor, target.id);
    if (target.role === "ADMIN" || target.role === "MANAGER") {
      throw new AuthError(
        "FORBIDDEN",
        "سرپرست فقط می‌تواند پرسنل دپارتمان را مدیریت کند",
      );
    }
  }
}
