import { describe, expect, it } from "vitest";
import { bucketDayAggregates } from "./buckets";
import { periodEndInRange, resolveReportRange } from "./range";
import { isExcludedFromRate, ratesFromCounts } from "./rates";
import { fromJalali } from "@/lib/dates";

describe("periodEndInRange", () => {
  it("فقط وقتی period_end داخل بازه است true می‌دهد", () => {
    const from = fromJalali(1404, 1, 1);
    const to = fromJalali(1404, 1, 31);
    expect(periodEndInRange(fromJalali(1404, 1, 15), from, to)).toBe(true);
    expect(periodEndInRange(fromJalali(1404, 1, 1), from, to)).toBe(true);
    expect(periodEndInRange(fromJalali(1404, 1, 31), from, to)).toBe(true);
    expect(periodEndInRange(fromJalali(1403, 12, 29), from, to)).toBe(false);
    expect(periodEndInRange(fromJalali(1404, 2, 1), from, to)).toBe(false);
  });

  it("کار ماهانه با period_end آخر ماه در همان ماه شمرده می‌شود", () => {
    const from = fromJalali(1404, 6, 1);
    const to = fromJalali(1404, 6, 31);
    const monthEnd = fromJalali(1404, 6, 31);
    expect(periodEndInRange(monthEnd, from, to)).toBe(true);
    // شروع ماه بعد — خارج
    expect(periodEndInRange(fromJalali(1404, 7, 1), from, to)).toBe(false);
  });
});

describe("ratesFromCounts", () => {
  it("EXCUSED و PENDING را از مخرج حذف می‌کند", () => {
    const r = ratesFromCounts({
      DONE: 2,
      DONE_LATE: 1,
      NOT_DONE: 1,
      MISSED: 0,
      PENDING: 3,
      EXCUSED: 2,
    });
    // countable = 9 - 2 - 3 = 4; done = 3 → 75%
    expect(r.countable).toBe(4);
    expect(r.completionRate).toBe(75);
    expect(r.onTimeRate).toBe(50); // 2/4
    expect(isExcludedFromRate("PENDING")).toBe(true);
    expect(isExcludedFromRate("EXCUSED")).toBe(true);
    expect(isExcludedFromRate("DONE")).toBe(false);
  });
});

describe("bucketDayAggregates", () => {
  it("روزها را به هفته شمسی (شنبه) و ماه تجمیع می‌کند", () => {
    const d1 = fromJalali(1404, 1, 2); // یکشنبه
    const d2 = fromJalali(1404, 1, 3);
    const days = [
      { day: d1, DONE: 1, PENDING: 0 },
      { day: d2, DONE: 1, NOT_DONE: 1 },
    ];
    const weeks = bucketDayAggregates(days, "week");
    expect(weeks.length).toBe(1);
    expect(weeks[0]!.DONE).toBe(2);
    expect(weeks[0]!.NOT_DONE).toBe(1);

    const months = bucketDayAggregates(days, "month");
    expect(months.length).toBe(1);
    expect(months[0]!.key).toBe(fromJalali(1404, 1, 1));
  });

  it("سری روزانه از قدیم به جدید مرتب است", () => {
    const a = fromJalali(1404, 1, 5);
    const b = fromJalali(1404, 1, 3);
    const pts = bucketDayAggregates(
      [
        { day: a, DONE: 1 },
        { day: b, DONE: 1 },
      ],
      "day",
    );
    expect(pts[0]!.key).toBe(b);
    expect(pts[1]!.key).toBe(a);
  });
});

describe("resolveReportRange", () => {
  it("ماه قبل را برمی‌گرداند", () => {
    const today = fromJalali(1404, 2, 10);
    const r = resolveReportRange("last_month", null, null, today);
    expect(r.from).toBe(fromJalali(1404, 1, 1));
    expect(r.to).toBe(fromJalali(1404, 1, 31));
  });
});

describe("KPI vs detail consistency", () => {
  it("جمع نرخ کارت با جمع ردیف‌های قابل‌شمارش جزئیات یکی است", () => {
    // شبیه‌سازی: فیلتر واحد → شمارش‌های وضعیت یکسان برای KPI و جدول
    const detailStatuses = [
      "DONE",
      "DONE",
      "DONE_LATE",
      "NOT_DONE",
      "PENDING",
      "EXCUSED",
      "MISSED",
    ];
    const counts = {
      DONE: 2,
      DONE_LATE: 1,
      NOT_DONE: 1,
      PENDING: 1,
      EXCUSED: 1,
      MISSED: 1,
    };
    const kpi = ratesFromCounts(counts);
    const detailCountable = detailStatuses.filter(
      (s) => !isExcludedFromRate(s),
    ).length;
    const detailDone = detailStatuses.filter(
      (s) => s === "DONE" || s === "DONE_LATE",
    ).length;
    expect(detailCountable).toBe(kpi.countable);
    expect(detailDone).toBe(kpi.done + kpi.doneLate);
    expect(
      Math.round((detailDone / detailCountable) * 100),
    ).toBe(kpi.completionRate);
  });
});
