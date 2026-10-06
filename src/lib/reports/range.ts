import {
  addGregorianDays,
  addJalaliMonths,
  compareGDate,
  endOfJalaliMonth,
  endOfJalaliWeek,
  startOfJalaliMonth,
  startOfJalaliWeek,
  todayTehran,
  type GDate,
} from "@/lib/dates";

/**
 * قاعده بازه گزارش (مستند و تست‌شده):
 * occurrence در بازه حساب می‌شود اگر و فقط اگر `period_end` داخل [from, to] باشد.
 * بنابراین کار ماهانه در ماهی که دوره‌اش بسته می‌شود شمرده می‌شود.
 */
export function periodEndInRange(
  periodEnd: GDate,
  from: GDate,
  to: GDate,
): boolean {
  return (
    compareGDate(periodEnd, from) >= 0 && compareGDate(periodEnd, to) <= 0
  );
}

export type RangeShortcut =
  | "today"
  | "week"
  | "month"
  | "last_month"
  | "last_3_months"
  | "custom";

export function resolveReportRange(
  shortcut: RangeShortcut,
  customFrom?: GDate | null,
  customTo?: GDate | null,
  today: GDate = todayTehran(),
): { from: GDate; to: GDate; shortcut: RangeShortcut } {
  switch (shortcut) {
    case "today":
      return { from: today, to: today, shortcut };
    case "week":
      return {
        from: startOfJalaliWeek(today),
        to: endOfJalaliWeek(today),
        shortcut,
      };
    case "month":
      return {
        from: startOfJalaliMonth(today),
        to: endOfJalaliMonth(today),
        shortcut,
      };
    case "last_month": {
      const prev = addJalaliMonths(startOfJalaliMonth(today), -1);
      return {
        from: startOfJalaliMonth(prev),
        to: endOfJalaliMonth(prev),
        shortcut,
      };
    }
    case "last_3_months": {
      const start = startOfJalaliMonth(addJalaliMonths(today, -2));
      return { from: start, to: today, shortcut };
    }
    case "custom": {
      const from = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom)
        ? customFrom
        : addGregorianDays(today, -29);
      const to =
        customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : today;
      if (compareGDate(from, to) > 0) return { from: to, to: from, shortcut };
      return { from, to, shortcut };
    }
    default:
      return {
        from: startOfJalaliMonth(today),
        to: endOfJalaliMonth(today),
        shortcut: "month",
      };
  }
}
