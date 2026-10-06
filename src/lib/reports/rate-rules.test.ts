import { describe, expect, it } from "vitest";
import { completionRate } from "./streak";
import { classifyOccurrence } from "./classify";
import { ratesFromCounts } from "./rates";

const today = "2026-10-06" as const;
const now = Date.parse("2026-10-06T12:00:00.000Z");
const ctx = { nowMs: now, from: today, to: today, today };

describe("باگ ۲ — PENDING و مخرج صفر", () => {
  it("PENDING با due_at گذشته OVERDUE و داخل مخرج است؛ مهلت آینده نه", () => {
    const overdue = classifyOccurrence(
      {
        status: "PENDING",
        dueAtMs: now - 60_000,
        periodStart: today,
        periodEnd: today,
        periodKey: "D:1",
        userId: 1,
        completedByUserId: null,
      },
      ctx,
    );
    const waiting = classifyOccurrence(
      {
        status: "PENDING",
        dueAtMs: now + 3_600_000,
        periodStart: today,
        periodEnd: today,
        periodKey: "D:2",
        userId: 1,
        completedByUserId: null,
      },
      ctx,
    );
    expect(overdue).toEqual({ kind: "counted", status: "OVERDUE" });
    expect(waiting).toEqual({ kind: "in_progress" });

    const rates = ratesFromCounts({ OVERDUE: 1, PENDING: 1, DONE: 0 });
    expect(rates.countable).toBe(1);
    expect(rates.inProgress).toBe(1);
    expect(rates.completionRate).toBe(0);
  });

  it("DONE با completed_by شخص دیگر همچنان اعتبار خود ردیف است", () => {
    const klass = classifyOccurrence(
      {
        status: "DONE",
        dueAtMs: null,
        periodStart: today,
        periodEnd: today,
        periodKey: "D:9",
        userId: 9,
        completedByUserId: 16,
      },
      ctx,
    );
    expect(klass).toEqual({ kind: "counted", status: "DONE" });
  });

  it("مخرج صفر null است، نه ۱ و نه ۱۰۰", () => {
    expect(completionRate(0, 0)).toBeNull();
    expect(ratesFromCounts({ PENDING: 4, EXCUSED: 2 }).completionRate).toBeNull();
    expect(ratesFromCounts({}).completionRate).not.toBe(1);
    expect(ratesFromCounts({}).completionRate).not.toBe(100);
  });

  it("دوره جاری هفتگی بعد از انتهای بازه فقط اگر مهلت گذشته در درصد می‌آید", () => {
    const weekEnd = "2026-10-09" as const;
    const base = {
      status: "PENDING" as const,
      periodStart: "2026-10-04",
      periodEnd: weekEnd,
      periodKey: "W:1405-W02",
      userId: 1,
      completedByUserId: null,
    };
    const waiting = classifyOccurrence(
      { ...base, dueAtMs: now + 86_400_000 },
      ctx,
    );
    const late = classifyOccurrence(
      { ...base, dueAtMs: now - 86_400_000 },
      ctx,
    );
    expect(waiting).toEqual({ kind: "in_progress" });
    expect(late).toEqual({ kind: "counted", status: "OVERDUE" });
  });
});
