import { completionRate } from "./streak";

export type StatusCounts = {
  PENDING?: number;
  DONE?: number;
  DONE_LATE?: number;
  NOT_DONE?: number;
  MISSED?: number;
  EXCUSED?: number;
};

/**
 * فرمول سند:
 * - completion_rate = (DONE + DONE_LATE) / (total - EXCUSED - PENDING)
 *   PENDING دوره جاری از درصدها حذف؛ EXCUSED از مخرج حذف.
 * - on_time_rate = DONE / همان مخرج
 *
 * در عمل همه PENDINGها (که در بازهٔ باز مانده‌اند) از درصد کنار گذاشته می‌شوند.
 */
export function isExcludedFromRate(status: string): boolean {
  return status === "EXCUSED" || status === "PENDING";
}

export function sumCounts(c: StatusCounts): number {
  return (
    (c.PENDING ?? 0) +
    (c.DONE ?? 0) +
    (c.DONE_LATE ?? 0) +
    (c.NOT_DONE ?? 0) +
    (c.MISSED ?? 0) +
    (c.EXCUSED ?? 0)
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
  completionRate: number | null;
  onTimeRate: number | null;
} {
  const pending = c.PENDING ?? 0;
  const done = c.DONE ?? 0;
  const doneLate = c.DONE_LATE ?? 0;
  const notDone = c.NOT_DONE ?? 0;
  const missed = c.MISSED ?? 0;
  const excused = c.EXCUSED ?? 0;
  const total = pending + done + doneLate + notDone + missed + excused;
  const countable = total - excused - pending;
  return {
    total,
    countable,
    done,
    doneLate,
    notDone,
    missed,
    pending,
    excused,
    completionRate: completionRate(done + doneLate, countable),
    onTimeRate: completionRate(done, countable),
  };
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
