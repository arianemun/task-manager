import {
  compareGDate,
  dueAtTehranMs,
  tehranDateFromMs,
  type GDate,
} from "@/lib/dates";

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

/** اگر کار هنوز به ساعت شروع نرسیده، متن خطا؛ در غیر این صورت null. */
export function responseBlockedBeforeStart(
  startTime: string | null | undefined,
  now = Date.now(),
): string | null {
  if (isTaskVisibleAt(startTime, now)) return null;
  return "این کار هنوز شروع نشده";
}

/**
 * فقط وقتی دورهٔ occurrence امروز را در بر می‌گیرد و ساعت شروع امروز نرسیده.
 * روزهای گذشته «هنوز شروع نشده» نیستند.
 */
export function isOccurrenceNotStarted(input: {
  status: string;
  startTime: string | null | undefined;
  periodStart: string;
  periodEnd: string;
  now?: number;
}): boolean {
  if (input.status !== "PENDING") return false;
  const now = input.now ?? Date.now();
  const today = tehranDateFromMs(now);
  if (compareGDate(input.periodStart as GDate, today) > 0) return false;
  if (compareGDate(input.periodEnd as GDate, today) < 0) return false;
  return !isTaskVisibleAt(input.startTime, now);
}
