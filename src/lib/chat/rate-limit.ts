import { ChatError } from "./errors";

const WINDOW_MS = 10_000;
const MAX_SENDS = 20;
const buckets = new Map<number, number[]>();

export function assertSendRate(userId: number, now = Date.now()): void {
  const prev = (buckets.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (prev.length >= MAX_SENDS) {
    throw new ChatError("پیام‌ها خیلی سریع ارسال می‌شوند");
  }
  prev.push(now);
  buckets.set(userId, prev);
}

export function resetSendRate(): void {
  buckets.clear();
}
