import { describe, expect, it } from "vitest";
import {
  fromJalali,
  isJalaliLeap,
  jalaliMonthLength,
  jalaliWeekday,
  setNowProvider,
  startOfJalaliWeek,
  toJalali,
  todayTehran,
} from "./index";

describe("lib/dates — تقویم جلالی و تهران", () => {
  it("isfahani leap: اسفند ۱۴۰۳ کبیسه ۳۰ روزه و ۱۴۰۴ غیرکبیسه ۲۹ روزه", () => {
    expect(isJalaliLeap(1403)).toBe(true);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(isJalaliLeap(1404)).toBe(false);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
  });

  it("toJalali / fromJalali رفت‌وبرگشت برای چند تاریخ", () => {
    const samples = ["2025-03-20", "2025-03-21", "2026-03-21", "2024-03-20"];
    for (const g of samples) {
      const j = toJalali(g);
      expect(fromJalali(j.jy, j.jm, j.jd)).toBe(g);
    }
  });

  it("شروع هفته جلالی همیشه شنبه است (weekday=0)", () => {
    // ۱۴۰۳-۱۲-۲۸ سه‌شنبه تقریبی — فقط چک می‌کنیم شنبه برگشتی weekday=0
    const g = fromJalali(1403, 12, 28);
    const start = startOfJalaliWeek(g);
    expect(jalaliWeekday(start)).toBe(0);
  });

  it("todayTehran وقتی سرور UTC و ساعت ۲۳:۰۰ UTC است → روز بعد در تهران", () => {
    // 23:00 UTC = 02:30 فردا در Asia/Tehran (UTC+3:30)
    setNowProvider(() => new Date("2026-03-20T23:00:00.000Z"));
    expect(todayTehran()).toBe("2026-03-21");
  });

  it("todayTehran قبل از نیمه‌شب تهران همان روز میلادی تهران را می‌دهد", () => {
    // 20:00 UTC = 23:30 همان روز در تهران
    setNowProvider(() => new Date("2026-03-20T20:00:00.000Z"));
    expect(todayTehran()).toBe("2026-03-20");
  });
});
