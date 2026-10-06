import { NextResponse } from "next/server";
import { AuthError, isAuthError } from "./errors";

/** تبدیل AuthError به پاسخ HTTP (FORBIDDEN / MUST_CHANGE → ۴۰۳) */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (!isAuthError(error)) return null;

  const status =
    error.code === "UNAUTHENTICATED"
      ? 401
      : error.code === "VALIDATION"
        ? 400
        : 403;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export function assertAuthError(error: unknown): asserts error is AuthError {
  if (!isAuthError(error)) throw error;
}
