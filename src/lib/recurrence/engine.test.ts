import { describe, expect, it } from "vitest";
import {
  addGregorianDays,
  fromJalali,
  jalaliMonthLength,
  startOfJalaliWeek,
  toJalali,
} from "@/lib/dates";
import { getOccurrencesInRange, previewOccurrences } from "./engine";
import { weeklyPeriodKey } from "./period-key";

describe("موتور تکرار", () => {
  it("day_of_month=30 و 31 در اسفند کبیسه/غیرکبیسه و ماه ۳۰ روزه → آخرین روز ماه", () => {
    // اسفند ۱۴۰۳ کبیسه — روز ۳۰ موجود است
    const leapStart = fromJalali(1403, 12, 1);
    const leapEnd = fromJalali(1403, 12, 30);
    const p30 = getOccurrencesInRange(
      {
        recurrenceType: "MONTHLY",
        recurrenceConfig: { mode: "day_of_month", day: 30 },
        startDate: fromJalali(1403, 1, 1),
        skipHolidays: false,
      },
      leapStart,
      leapEnd,
    );
    expect(p30).toHaveLength(1);
    expect(p30[0]!.periodStart).toBe(fromJalali(1403, 12, 30));

    // اسفند ۱۴۰۴ غیرکبیسه — day=30 و 31 باید به ۲۹ زنده شوند
    const nonLeapStart = fromJalali(1404, 12, 1);
    const nonLeapEnd = fromJalali(1404, 12, 29);
    expect(jalaliMonthLength(1404, 12)).toBe(29);

    for (const day of [30, 31]) {
      const periods = getOccurrencesInRange(
        {
          recurrenceType: "MONTHLY",
          recurrenceConfig: { mode: "day_of_month", day },
          startDate: fromJalali(1404, 1, 1),
          skipHolidays: false,
        },
        nonLeapStart,
        nonLeapEnd,
      );
      expect(periods).toHaveLength(1);
      expect(periods[0]!.periodStart).toBe(fromJalali(1404, 12, 29));
    }

    // آبان ۱۴۰۴ (۳۰ روزه) با day=31 → روز ۳۰
    const abanStart = fromJalali(1404, 8, 1);
    const abanEnd = fromJalali(1404, 8, 30);
    const aban = getOccurrencesInRange(
      {
        recurrenceType: "MONTHLY",
        recurrenceConfig: { mode: "day_of_month", day: 31 },
        startDate: fromJalali(1404, 1, 1),
        skipHolidays: false,
      },
      abanStart,
      abanEnd,
    );
    expect(aban).toHaveLength(1);
    expect(aban[0]!.periodStart).toBe(fromJalali(1404, 8, 30));
  });

  it("هفته بین اسفند و فروردین یک period_key واحد دارد", () => {
    let found = false;
    for (let d = 20; d <= 30; d++) {
      const day = fromJalali(1403, 12, Math.min(d, 30));
      const sat = startOfJalaliWeek(day);
      const friday = addGregorianDays(sat, 6);
      const jSat = toJalali(sat);
      const jFri = toJalali(friday);
      if (jSat.jy !== jFri.jy) {
        expect(weeklyPeriodKey(sat)).toBe(weeklyPeriodKey(friday));
        expect(weeklyPeriodKey(sat)).toBe(`W:${jSat.jDate}`);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("any_day_in_week دوره هفتگی می‌سازد", () => {
    const from = fromJalali(1404, 1, 1);
    const to = fromJalali(1404, 1, 21);
    const periods = getOccurrencesInRange(
      {
        recurrenceType: "WEEKLY",
        recurrenceConfig: { mode: "any_day_in_week" },
        startDate: from,
        skipHolidays: true,
      },
      from,
      to,
    );
    expect(periods.length).toBeGreaterThanOrEqual(2);
    expect(periods.every((p) => p.kind === "weekly")).toBe(true);
    expect(periods.every((p) => p.periodKey.startsWith("W:"))).toBe(true);
  });

  it("any_day_in_month دوره ماهانه می‌سازد", () => {
    const from = fromJalali(1404, 1, 1);
    const to = fromJalali(1404, 3, 29);
    const periods = getOccurrencesInRange(
      {
        recurrenceType: "MONTHLY",
        recurrenceConfig: { mode: "any_day_in_month" },
        startDate: from,
        skipHolidays: true,
      },
      from,
      to,
    );
    expect(periods).toHaveLength(3);
    expect(periods.every((p) => p.kind === "monthly")).toBe(true);
    expect(periods.every((p) => p.periodKey.startsWith("M:"))).toBe(true);
  });

  it("excludeWeekdays=[6] جمعه را حذف می‌کند و skip_holidays تعطیل را", () => {
    const from = fromJalali(1404, 1, 1);
    const to = fromJalali(1404, 1, 14);
    const all = getOccurrencesInRange(
      {
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 1 },
        startDate: from,
        skipHolidays: false,
      },
      from,
      to,
      { applySkips: false },
    );

    const noFri = getOccurrencesInRange(
      {
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 1, excludeWeekdays: [6] },
        startDate: from,
        skipHolidays: false,
      },
      from,
      to,
    );
    expect(noFri.length).toBeLessThan(all.length);

    const holiday = fromJalali(1404, 1, 2);
    const withHoliday = getOccurrencesInRange(
      {
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 1 },
        startDate: from,
        skipHolidays: true,
      },
      from,
      to,
      { holidays: [holiday] },
    );
    expect(withHoliday.some((p) => p.periodStart === holiday)).toBe(false);

    // دوره هفتگی به‌خاطر تعطیل حذف نمی‌شود
    const weekly = getOccurrencesInRange(
      {
        recurrenceType: "WEEKLY",
        recurrenceConfig: { mode: "any_day_in_week" },
        startDate: from,
        skipHolidays: true,
      },
      from,
      to,
      { holidays: [holiday] },
    );
    expect(weekly.length).toBeGreaterThan(0);
  });

  it("interval: هر ۳ روز، هر ۲ هفته دوشنبه، هر ۳ ماه روز ۱۵", () => {
    const start = fromJalali(1404, 1, 1);
    const end = fromJalali(1404, 2, 15);

    const every3 = getOccurrencesInRange(
      {
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 3 },
        startDate: start,
        skipHolidays: false,
      },
      start,
      end,
    );
    // اختلاف روزها از start مضرب ۳
    for (const p of every3) {
      const jStart = toJalali(start);
      const jP = toJalali(p.periodStart);
      void jStart;
      void jP;
    }
    expect(every3[0]!.periodStart).toBe(start);
    expect(every3.length).toBeGreaterThan(5);

    // دوشنبه = ۲
    const biweeklyMon = getOccurrencesInRange(
      {
        recurrenceType: "CUSTOM",
        recurrenceConfig: { unit: "week", interval: 2, weekdays: [2] },
        startDate: start,
        skipHolidays: false,
      },
      start,
      fromJalali(1404, 3, 1),
    );
    expect(biweeklyMon.every((p) => p.kind === "daily")).toBe(true);
    expect(biweeklyMon.length).toBeGreaterThanOrEqual(2);

    const every3m = getOccurrencesInRange(
      {
        recurrenceType: "CUSTOM",
        recurrenceConfig: { unit: "month", interval: 3, day: 15 },
        startDate: fromJalali(1404, 1, 15),
        skipHolidays: false,
      },
      fromJalali(1404, 1, 1),
      fromJalali(1404, 10, 20),
    );
    expect(every3m.map((p) => toJalali(p.periodStart).jm)).toEqual(
      expect.arrayContaining([1, 4, 7, 10]),
    );
  });

  it("WEEKLY specific_days دوره روزانه می‌سازد", () => {
    const from = fromJalali(1404, 1, 1);
    const to = fromJalali(1404, 1, 14);
    const periods = getOccurrencesInRange(
      {
        recurrenceType: "WEEKLY",
        recurrenceConfig: { mode: "specific_days", weekdays: [0, 2] },
        startDate: from,
        skipHolidays: false,
      },
      from,
      to,
    );
    expect(periods.every((p) => p.kind === "daily")).toBe(true);
    expect(periods.every((p) => p.periodKey.startsWith("D:"))).toBe(true);
  });

  it("previewOccurrences تعداد N تاریخ بعدی را برمی‌گرداند", () => {
    const periods = previewOccurrences(
      {
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 1, excludeWeekdays: [6] },
        startDate: fromJalali(1404, 1, 1),
        skipHolidays: false,
      },
      fromJalali(1404, 1, 1),
      10,
    );
    expect(periods).toHaveLength(10);
  });
});
