import { completionRate } from "./streak";

export type StatusCounts = {
  PENDING?: number;
  DONE?: number;
  DONE_LATE?: number;
  NOT_DONE?: number;
  MISSED?: number;
  EXCUSED?: number;
  /** محاسباتی: PENDING با due_at گذشته. در DB ذخیره نمی‌شود. */
  OVERDUE?: number;
  DONE_BY_PEER?: number;
};

/** وقتی مخرج صفر است. نه ۱ و نه ۱۰۰. */
export const EMPTY_RATE_HINT = "کار ارزیابی‌شده‌ای در این بازه نیست";

/**
 * درصد = (DONE + DONE_LATE) / (DONE + DONE_LATE + NOT_DONE + MISSED + OVERDUE)
 * PENDING با مهلت نرسیده، EXCUSED و DONE_BY_PEER از صورت و مخرج حذف می‌شوند.
 * مخرج صفر → null.
 */
export function isExcludedFromRate(status: string): boolean {
  return status === "EXCUSED" || status === "PENDING" || status === "DONE_BY_PEER";
}

export function sumCounts(c: StatusCounts): number {
  return (
    (c.PENDING ?? 0) +
    (c.DONE ?? 0) +
    (c.DONE_LATE ?? 0) +
    (c.NOT_DONE ?? 0) +
    (c.MISSED ?? 0) +
    (c.EXCUSED ?? 0) +
    (c.OVERDUE ?? 0) +
    (c.DONE_BY_PEER ?? 0)
  );
}

export function ratesFromCounts(c: StatusCounts): {
  total: number;
  countable: number;
  done: number;
  doneLate: number;
  notDone: number;
  missed: number;
  pending: number;
  excused: number;
  overdue: number;
  doneByPeer: number;
  /** PENDING با مهلت نرسیده */
  inProgress: number;
  completionRate: number | null;
  onTimeRate: number | null;
} {
  const pending = c.PENDING ?? 0;
  const done = c.DONE ?? 0;
  const doneLate = c.DONE_LATE ?? 0;
  const notDone = c.NOT_DONE ?? 0;
  const missed = c.MISSED ?? 0;
  const excused = c.EXCUSED ?? 0;
  const overdue = c.OVERDUE ?? 0;
  const doneByPeer = c.DONE_BY_PEER ?? 0;
  const total =
    pending + done + doneLate + notDone + missed + excused + overdue + doneByPeer;
  const countable = done + doneLate + notDone + missed + overdue;
  return {
    total,
    countable,
    done,
    doneLate,
    notDone,
    missed,
    pending,
    excused,
    overdue,
    doneByPeer,
    inProgress: pending,
    completionRate: completionRate(done + doneLate, countable),
    onTimeRate: completionRate(done, countable),
  };
}

/** درصد دوره‌های SHARED که حداقل یک نفر DONE/DONE_LATE ثبت کرده. مخرج صفر → null. */
export function sharedPeriodsRate(
  donePeriods: number,
  periods: number,
): number | null {
  if (periods <= 0) return null;
  return Math.round((donePeriods / periods) * 100);
}

export function mergeStatusCounts(...parts: StatusCounts[]): StatusCounts {
  const out: StatusCounts = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p)) {
      const key = k as keyof StatusCounts;
      out[key] = (out[key] ?? 0) + (v ?? 0);
    }
  }
  return out;
}
