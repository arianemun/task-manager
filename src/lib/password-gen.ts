import { randomBytes } from "node:crypto";

/** رمز تصادفی قابل‌خواندن — فقط یک‌بار به UI برگردانده شود؛ لاگ نشود */
export function generateTempPassword(length = 12): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}
