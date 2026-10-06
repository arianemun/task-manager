/** secure بودن کوکی سشن — با COOKIE_SECURE قابل تنظیم؛ پیش‌فرض true در production */
export function isCookieSecure(): boolean {
  const raw = process.env.COOKIE_SECURE;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return process.env.NODE_ENV === "production";
}
