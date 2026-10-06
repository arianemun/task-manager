export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INACTIVE"
  | "LOCKED"
  | "MUST_CHANGE_PASSWORD"
  | "INVALID_CREDENTIALS"
  | "VALIDATION";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
