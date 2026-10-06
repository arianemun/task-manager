/**
 * Rate limit در حافظه برای ورود (مکمل قفل حساب در DB).
 * کلیدها: IP و ترکیب IP+username
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
/** محدودیت بر اساس IP */
export const IP_MAX_ATTEMPTS = 20;
/** محدودیت تکمیلی بر اساس IP+username */
export const USER_MAX_ATTEMPTS = 30;

function checkBucket(
  key: string,
  maxAttempts: number,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  return checkBucket(key, USER_MAX_ATTEMPTS);
}

export function checkLoginIpRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  return checkBucket(`ip:${ip}`, IP_MAX_ATTEMPTS);
}
