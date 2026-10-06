import {
  formatGDate,
  parseGDate,
  type GDate,
} from "@/lib/dates";

/** تبدیل GDate اپ → Date برای DayPicker (ظهر محلی) */
export function gDateToPickerDate(g: GDate): Date {
  const { gy, gm, gd } = parseGDate(g);
  return new Date(gy, gm - 1, gd, 12, 0, 0);
}

/** Date انتخاب‌شده در DayPicker → GDate */
export function pickerDateToGDate(d: Date): GDate {
  return formatGDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
