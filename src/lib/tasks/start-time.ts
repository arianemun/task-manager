import { dueAtTehranMs, tehranDateFromMs } from "@/lib/dates";

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeStartTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return CLOCK.test(trimmed) ? trimmed : null;
}

/**
 * ساعت شروع خالی است: کار از ابتدای روز دیده می‌شود.
 * اگر ساعت داشته باشد، امروز به وقت تهران تا رسیدن آن ساعت پنهان است.
 * برای کار هفتگی و ماهانه همین مقایسه هر روز تکرار می‌شود.
 */
export function isTaskVisibleAt(startTime: string | null | undefined, now = Date.now()): boolean {
  const clock = normalizeStartTime(startTime);
  if (!clock) return true;
  return now >= dueAtTehranMs(tehranDateFromMs(now), clock);
}
