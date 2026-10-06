import {
  formatJDate,
  startOfJalaliWeek,
  toJalali,
  type GDate,
} from "@/lib/dates";
import type { PeriodKind } from "./types";

/** روزانه: D:1405-07-14 */
export function dailyPeriodKey(gDate: GDate): string {
  const { jDate } = toJalali(gDate);
  return `D:${jDate}`;
}

/** هفتگی: W:1405-07-12 — تاریخ جلالی شنبه شروع هفته */
export function weeklyPeriodKey(gDateInWeek: GDate): string {
  const saturday = startOfJalaliWeek(gDateInWeek);
  const { jDate } = toJalali(saturday);
  return `W:${jDate}`;
}

/** ماهانه: M:1405-07 */
export function monthlyPeriodKey(gDate: GDate): string {
  const { jy, jm } = toJalali(gDate);
  return `M:${formatJDate(jy, jm, 1).slice(0, 7)}`;
}

/** یک‌باره: O:1405-07-20 */
export function oncePeriodKey(gDate: GDate): string {
  const { jDate } = toJalali(gDate);
  return `O:${jDate}`;
}

export function periodKeyFor(kind: PeriodKind, gDate: GDate): string {
  switch (kind) {
    case "daily":
      return dailyPeriodKey(gDate);
    case "weekly":
      return weeklyPeriodKey(gDate);
    case "monthly":
      return monthlyPeriodKey(gDate);
    case "once":
      return oncePeriodKey(gDate);
  }
}
