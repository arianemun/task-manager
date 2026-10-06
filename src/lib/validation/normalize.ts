import { toEnDigits } from "@/lib/utils";

/** نرمال‌سازی متن فارسی برای جستجو و ذخیره */
export function normalizePersianText(input: string): string {
  return toEnDigits(input)
    .replace(/\u064A/g, "\u06CC") // ي → ی
    .replace(/\u0643/g, "\u06A9") // ك → ک
    .replace(/\u200C+/g, "\u200C") // نیم‌فاصله تکراری
    .replace(/\u200C{2,}/g, "\u200C")
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** تبدیل ارقام فارسی/عربی به لاتین و trim */
export function normalizeInputDigits(input: string): string {
  return toEnDigits(input).trim();
}
