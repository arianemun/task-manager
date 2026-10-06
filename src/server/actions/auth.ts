"use server";

import { eq } from "drizzle-orm";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  INVALID_CREDENTIALS_MESSAGE,
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
} from "@/lib/auth/constants";
import { isAuthError } from "@/lib/auth/errors";
import { getClientIp } from "@/lib/auth/client-ip";
import {
  checkLoginIpRateLimit,
  checkLoginRateLimit,
} from "@/lib/auth/login-rate-limit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { bumpSessionVersion, requireUser } from "@/lib/auth/user";
import { fa } from "@/lib/i18n/fa";

export type ActionResult =
  | { ok: true; redirectTo?: string; generatedPassword?: string }
  | { ok: false; error: string };

const loginSchema = z.object({
  username: z.string().trim().min(1, "نام کاربری الزامی است"),
  password: z.string().min(1, "رمز عبور الزامی است"),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "رمز فعلی الزامی است"),
    newPassword: z
      .string()
      .min(8, "رمز جدید باید حداقل ۸ کاراکتر باشد")
      .max(128),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "تکرار رمز با رمز جدید یکسان نیست",
    path: ["confirmPassword"],
  });

function homeForRole(role: string): string {
  if (role === "ADMIN" || role === "MANAGER") return "/admin";
  return "/me";
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = loginSchema.safeParse({
      username: formData.get("username"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر",
      };
    }

    const { username, password } = parsed.data;
    const ip = await getClientIp();
    const ipRate = checkLoginIpRateLimit(ip);
    if (!ipRate.allowed) {
      return {
        ok: false,
        error:
          "تعداد تلاش‌ها از این آدرس زیاد است. لطفاً کمی بعد دوباره تلاش کنید",
      };
    }
    const rateKey = `login:${ip}:${username.toLowerCase()}`;
    const rate = checkLoginRateLimit(rateKey);
    if (!rate.allowed) {
      return {
        ok: false,
        error: "تعداد تلاش‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید",
      };
    }

    const user = db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .get();

    const fail = (): ActionResult => {
      if (user) {
        const nextCount = user.failedLoginCount + 1;
        const lockedUntil =
          nextCount >= MAX_FAILED_LOGINS
            ? new Date(Date.now() + LOCK_DURATION_MS)
            : user.lockedUntil;

        db.update(users)
          .set({
            failedLoginCount: nextCount >= MAX_FAILED_LOGINS ? 0 : nextCount,
            lockedUntil: lockedUntil ?? null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .run();

        if (nextCount >= MAX_FAILED_LOGINS) {
          return { ok: false, error: fa.auth.accountLocked };
        }
      }
      return { ok: false, error: INVALID_CREDENTIALS_MESSAGE };
    };

    if (!user) {
      return fail();
    }

    if (!user.isActive) {
      return { ok: false, error: fa.auth.accountDisabled };
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return { ok: false, error: fa.auth.accountLocked };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return fail();
    }

    db.update(users)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .run();

    const token = await createSessionToken(user.id, user.sessionVersion);
    await setSessionCookie(token);

    // هدایت سمت سرور — قابل‌اطمینان‌تر از router سمت کلاینت
    if (user.mustChangePassword) {
      redirect("/change-password");
    }
    redirect(homeForRole(user.role));
  } catch (e) {
    unstable_rethrow(e);
    console.error("loginAction:", e);
    const msg =
      e instanceof Error && e.message
        ? e.message
        : "ورود ناموفق بود. دوباره تلاش کنید.";
    return { ok: false, error: msg };
  }
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser({ allowMustChangePassword: true });

    const parsed = changePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر",
      };
    }

    const row = db.select().from(users).where(eq(users.id, user.id)).get();
    if (!row) {
      return { ok: false, error: "کاربر یافت نشد" };
    }

    const ok = await verifyPassword(
      parsed.data.currentPassword,
      row.passwordHash,
    );
    if (!ok) {
      return { ok: false, error: "رمز فعلی نادرست است" };
    }

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return {
        ok: false,
        error: "رمز جدید باید با رمز فعلی متفاوت باشد",
      };
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const nextVersion = bumpSessionVersion(user.id);

    db.update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .run();

    const token = await createSessionToken(user.id, nextVersion);
    await setSessionCookie(token);

    return { ok: true, redirectTo: homeForRole(user.role) };
  } catch (error) {
    if (isAuthError(error)) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/** برای استفاده داخلی فازهای بعد: ریست رمز توسط مدیر */
export async function adminResetPasswordInternal(
  targetUserId: number,
  newPassword: string,
): Promise<void> {
  await requireUser({ roles: ["ADMIN", "MANAGER"] });
  const passwordHash = await hashPassword(newPassword);
  const nextVersion = bumpSessionVersion(targetUserId);
  db.update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      sessionVersion: nextVersion,
      failedLoginCount: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId))
    .run();
}

/** برای استفاده داخلی فازهای بعد: غیرفعال‌سازی + باطل سشن */
export async function setUserActiveInternal(
  targetUserId: number,
  isActive: boolean,
): Promise<void> {
  await requireUser({ roles: ["ADMIN", "MANAGER"] });
  bumpSessionVersion(targetUserId);
  db.update(users)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId))
    .run();
}
