import { describe, expect, it } from "vitest";
import {
  completionRate,
  computeStreaks,
  countableCompletion,
  type StreakDay,
} from "./streak";

describe("computeStreaks", () => {
  it("روزهای متوالی انجام‌شده را می‌شمارد", () => {
    const days: StreakDay[] = [
      { date: "2026-03-25", kind: "work", allDone: true },
      { date: "2026-03-24", kind: "work", allDone: true },
      { date: "2026-03-23", kind: "work", allDone: true },
      { date: "2026-03-22", kind: "work", allDone: false },
    ];
    expect(computeStreaks(days)).toEqual({ current: 3, best: 3 });
  });

  it("تعطیل/مرخصی/بدون‌کار streak را نمی‌شکند و نمی‌شمارد", () => {
    const days: StreakDay[] = [
      { date: "2026-03-25", kind: "work", allDone: true },
      { date: "2026-03-24", kind: "skip" }, // تعطیل
      { date: "2026-03-23", kind: "skip" }, // مرخصی
      { date: "2026-03-22", kind: "work", allDone: true },
      { date: "2026-03-21", kind: "work", allDone: false },
    ];
    expect(computeStreaks(days)).toEqual({ current: 2, best: 2 });
  });

  it("شکست امروز current را صفر می‌کند ولی best را نگه می‌دارد", () => {
    const days: StreakDay[] = [
      { date: "2026-03-25", kind: "work", allDone: false },
      { date: "2026-03-24", kind: "work", allDone: true },
      { date: "2026-03-23", kind: "work", allDone: true },
    ];
    expect(computeStreaks(days)).toEqual({ current: 0, best: 2 });
  });

  it("اگر امروز skip باشد از دیروز ادامه می‌دهد", () => {
    const days: StreakDay[] = [
      { date: "2026-03-25", kind: "skip" },
      { date: "2026-03-24", kind: "work", allDone: true },
      { date: "2026-03-23", kind: "work", allDone: true },
    ];
    expect(computeStreaks(days)).toEqual({ current: 2, best: 2 });
  });
});

describe("completionRate / countableCompletion", () => {
  it("درصد را گرد می‌کند و EXCUSED/PENDING را از مخرج حذف می‌کند", () => {
    expect(completionRate(1, 2)).toBe(50);
    expect(completionRate(0, 0)).toBeNull();
    const r = countableCompletion([
      "DONE",
      "DONE_LATE",
      "NOT_DONE",
      "PENDING",
      "EXCUSED",
    ]);
    expect(r).toEqual({ done: 2, total: 3, rate: 67 });
  });
});
