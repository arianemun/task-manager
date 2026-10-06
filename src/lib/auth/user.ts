import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  userPermissions,
  users,
  type Permission,
  type Role,
  type User,
} from "@/db/schema";
import { departmentIdsForUser } from "@/lib/departments/membership";
import { resolvePermissions } from "@/lib/permissions";
import { AuthError } from "./errors";
import { getSessionPayload } from "./session";

export type AuthUser = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  departmentId: number | null;
  departmentIds: number[];
  isActive: boolean;
  mustChangePassword: boolean;
  sessionVersion: number;
  permissions: Permission[];
  avatarPath: string | null;
};

function toAuthUser(row: User, permissions: Permission[]): AuthUser {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    departmentId: row.departmentId,
    departmentIds: departmentIdsForUser(row.id),
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    sessionVersion: row.sessionVersion,
    permissions,
    avatarPath: row.avatarPath,
  };
}

export function loadAuthUserById(userId: number): AuthUser | null {
  const row = db.select().from(users).where(eq(users.id, userId)).get();
  if (!row || row.deletedAt) return null;

  const extras = db
    .select({ permission: userPermissions.permission })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId))
    .all()
    .map((r) => r.permission);

  return toAuthUser(row, resolvePermissions(row.role, extras));
}

/**
 * کاربر جاری را از کوکی JWT می‌خواند و نقش/مجوز را از دیتابیس بارگذاری می‌کند.
 * در صورت عدم تطابق session_version یا غیرفعال بودن، null برمی‌گرداند.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSessionPayload();
  if (!session) return null;

  const user = loadAuthUserById(session.userId);
  if (!user) return null;
  if (!user.isActive) return null;
  if (user.sessionVersion !== session.sessionVersion) return null;

  return user;
}

export type RequireUserOptions = {
  roles?: Role[];
  /** اگر true باشد و mustChangePassword، خطا می‌دهد مگر مسیر تغییر رمز */
  allowMustChangePassword?: boolean;
};

/**
 * لایه اصلی امنیت برای Server Action / Route Handler / صفحه سرور.
 * middleware جایگزین این تابع نیست.
 */
export async function requireUser(
  options: RequireUserOptions = {},
): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("UNAUTHENTICATED", "لطفاً وارد حساب کاربری شوید");
  }

  if (!options.allowMustChangePassword && user.mustChangePassword) {
    // برای Server Action / API به‌صورت 403؛ صفحات با requireUserOrRedirect هدایت می‌شوند
    throw new AuthError(
      "FORBIDDEN",
      "برای ادامه باید رمز عبور خود را تغییر دهید",
    );
  }

  if (options.roles && !options.roles.includes(user.role)) {
    throw new AuthError("FORBIDDEN", "شما به این بخش دسترسی ندارید");
  }

  return user;
}

export async function requirePermission(
  permission: Permission,
  options: RequireUserOptions = {},
): Promise<AuthUser> {
  const user = await requireUser(options);
  if (user.role === "ADMIN") return user;
  if (!user.permissions.includes(permission)) {
    throw new AuthError("FORBIDDEN", "مجوز لازم برای این عملیات را ندارید");
  }
  return user;
}

export async function requireAnyPermission(
  permissions: Permission[],
  options: RequireUserOptions = {},
): Promise<AuthUser> {
  const user = await requireUser(options);
  if (user.role === "ADMIN") return user;
  const ok = permissions.some((p) => user.permissions.includes(p));
  if (!ok) {
    throw new AuthError("FORBIDDEN", "مجوز لازم برای این عملیات را ندارید");
  }
  return user;
}

/** افزایش session_version — باطل‌سازی همه سشن‌های قبلی */
export function bumpSessionVersion(userId: number): number {
  const row = db.select().from(users).where(eq(users.id, userId)).get();
  if (!row) {
    throw new AuthError("UNAUTHENTICATED", "کاربر یافت نشد");
  }
  const next = row.sessionVersion + 1;
  db.update(users)
    .set({
      sessionVersion: next,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .run();
  return next;
}
