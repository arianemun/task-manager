import { redirect } from "next/navigation";
import { isAuthError } from "./errors";
import { clearSessionCookie } from "./session";
import {
  getCurrentUser,
  requireUser,
  type AuthUser,
  type RequireUserOptions,
} from "./user";

/** برای استفاده در layout/صفحه — در صورت خطا redirect می‌کند */
export async function requireUserOrRedirect(
  options: RequireUserOptions & {
    loginPath?: string;
    forbiddenPath?: string;
    changePasswordPath?: string;
  } = {},
): Promise<AuthUser> {
  const loginPath = options.loginPath ?? "/login";
  const forbiddenPath = options.forbiddenPath ?? "/me";
  const changePasswordPath = options.changePasswordPath ?? "/change-password";

  const current = await getCurrentUser();
  if (!current) {
    await clearSessionCookie();
    redirect(loginPath);
  }

  if (!options.allowMustChangePassword && current.mustChangePassword) {
    redirect(changePasswordPath);
  }

  try {
    return await requireUser(options);
  } catch (error) {
    if (!isAuthError(error)) throw error;

    if (error.code === "UNAUTHENTICATED") {
      await clearSessionCookie();
      redirect(loginPath);
    }
    if (error.code === "FORBIDDEN") {
      redirect(forbiddenPath);
    }
    redirect(loginPath);
  }
}

export async function redirectIfAuthenticated(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  if (user.role === "ADMIN" || user.role === "MANAGER") {
    redirect("/admin");
  }
  redirect("/me");
}
