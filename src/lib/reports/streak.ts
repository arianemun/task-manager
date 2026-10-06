import type { GDate } from "@/lib/dates";

export type DayKind = "work" | "skip";

export type StreakDay = {
  date: GDate;
  /** work = روز کاری با حداقل یک occurrence روزانه؛ skip = بدون کار / تعطیل / مرخصی */
  kind: DayKind;
  /** فقط برای work: آیا همه occurrenceهای روزانه DONE یا DONE_LATE هستند؟ */
  allDone?: boolean;
};

export type StreakResult = {
  current: number;
  best: number;
};

/**
 * streak: روزهای متوالی که همه occurrenceهای روزانه DONE/DONE_LATE هستند.
 * روزهای بدون کار، تعطیل و مرخصی streak را نمی‌شکنند و شمرده هم نمی‌شوند.
 * daysNewestFirst: امروز اول، سپس دیروز، …
 */
export function computeStreaks(daysNewestFirst: StreakDay[]): StreakResult {
  let current = 0;
  for (const d of daysNewestFirst) {
    if (d.kind === "skip") continue;
    if (d.allDone) current += 1;
    else break;
  }

  let best = 0;
  let run = 0;
  for (let i = daysNewestFirst.length - 1; i >= 0; i--) {
    const d = daysNewestFirst[i]!;
    if (d.kind === "skip") continue;
    if (d.allDone) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return { current, best };
}

export function completionRate(
  doneCount: number,
  totalCountable: number,
): number | null {
  if (totalCountable <= 0) return null;
  return Math.round((doneCount / totalCountable) * 100);
}

export function countableCompletion(statuses: string[]): {
  done: number;
  total: number;
  rate: number | null;
} {
  const countable = statuses.filter(
    (s) => s !== "EXCUSED" && s !== "PENDING",
  );
  const done = countable.filter(
    (s) => s === "DONE" || s === "DONE_LATE",
  ).length;
  return {
    done,
    total: countable.length,
    rate: completionRate(done, countable.length),
  };
}
