import { timingSafeEqual } from "node:crypto";

export function authorizeCronRequest(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();

  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) {
    // مقایسه ساختگی برای نزدیک‌ماندن زمان اجرا
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}
