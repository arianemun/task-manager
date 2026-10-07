import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/**
 * فقط هدایت مسیر بر اساس وجود کوکی سشن.
 * اعتبار JWT، session_version، نقش و مجوز در requireUser از دیتابیس بررسی می‌شود.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const isChangePassword =
    pathname === "/change-password" ||
    pathname.startsWith("/change-password/");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isMe = pathname === "/me" || pathname.startsWith("/me/");
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const isProtected = isAdmin || isMe || isChangePassword || isChat;

  // ریشه → ورود (صفحه فرود نداریم)
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isProtected && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // /login را بر اساس صرفِ وجود کوکی هدایت نکن —
  // هدایت کاربرِ واقعاً لاگین‌شده در redirectIfAuthenticated انجام می‌شود.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/change-password",
    "/admin/:path*",
    "/me/:path*",
    "/chat",
    "/chat/:path*",
  ],
};
