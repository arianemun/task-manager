import { fromZonedTime } from "date-fns-tz";
import {
  gregorianToJalali,
  isJalaliLeapYear,
  jalaliMonthLength,
  jalaliToGregorian,
  type JalaliParts,
} from "./jalali-algo";

export const TEHRAN_TZ = "Asia/Tehran";

export type GDate = string; // YYYY-MM-DD میلادی (تاریخ تقویمی تهران)
export type JDate = string; // YYYY-MM-DD جلالی

let nowProvider: () => Date = () => new Date();

/** فقط برای تست — شبیه‌سازی «الان» */
export function setNowProvider(fn: () => Date): void {
  nowProvider = fn;
}

export function resetNowProvider(): void {
  nowProvider = () => new Date();
}

const GDATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertGDate(value: string): GDate {
  if (!GDATE_RE.test(value)) {
    throw new Error(`تاریخ میلادی نامعتبر: ${value}`);
  }
  return value;
}

/** امروز به وقت Asia/Tehran به‌صورت YYYY-MM-DD میلادی */
export function todayTehran(): GDate {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA → YYYY-MM-DD
  return assertGDate(fmt.format(nowProvider()));
}

export function parseGDate(g: GDate): { gy: number; gm: number; gd: number } {
  assertGDate(g);
  const [gy, gm, gd] = g.split("-").map(Number);
  return { gy: gy!, gm: gm!, gd: gd! };
}

export function formatGDate(gy: number, gm: number, gd: number): GDate {
  return assertGDate(
    `${String(gy).padStart(4, "0")}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`,
  );
}

export function formatJDate(jy: number, jm: number, jd: number): JDate {
  return `${String(jy).padStart(4, "0")}-${String(jm).padStart(2, "0")}-${String(jd).padStart(2, "0")}`;
}

export function toJalali(gDate: GDate): JalaliParts & { jDate: JDate } {
  const { gy, gm, gd } = parseGDate(gDate);
  const j = gregorianToJalali(gy, gm, gd);
  return { ...j, jDate: formatJDate(j.jy, j.jm, j.jd) };
}

export function fromJalali(jy: number, jm: number, jd: number): GDate {
  const daysInMonth = jalaliMonthLength(jy, jm);
  const safeDay = Math.min(jd, daysInMonth);
  const g = jalaliToGregorian(jy, jm, safeDay);
  return formatGDate(g.gy, g.gm, g.gd);
}

/** ارقام فارسی/عربی را به لاتین تبدیل می‌کند */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function fromJalaliString(jDate: string): GDate {
  const normalized = toLatinDigits(jDate.trim()).replace(/\//g, "-");
  const [jy, jm, jd] = normalized.split("-").map(Number);
  if (
    !Number.isInteger(jy) ||
    !Number.isInteger(jm) ||
    !Number.isInteger(jd)
  ) {
    throw new Error(`تاریخ شمسی نامعتبر: ${jDate}`);
  }
  return fromJalali(jy!, jm!, jd!);
}

export function isJalaliLeap(jy: number): boolean {
  return isJalaliLeapYear(jy);
}

/** شنبه = ۰ … جمعه = ۶ برای تاریخ میلادی تقویمی */
export function jalaliWeekday(gDate: GDate): number {
  // ظهر همان روز در تهران → weekday پایدار
  const instant = fromZonedTime(`${gDate}T12:00:00`, TEHRAN_TZ);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN_TZ,
    weekday: "short",
  }).format(instant);
  const map: Record<string, number> = {
    Sat: 0,
    Sun: 1,
    Mon: 2,
    Tue: 3,
    Wed: 4,
    Thu: 5,
    Fri: 6,
  };
  const n = map[wd];
  if (n === undefined) throw new Error(`weekday نامعتبر: ${wd}`);
  return n;
}

export function addGregorianDays(gDate: GDate, days: number): GDate {
  const { gy, gm, gd } = parseGDate(gDate);
  const utc = Date.UTC(gy, gm - 1, gd + days);
  const d = new Date(utc);
  return formatGDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function diffGregorianDays(a: GDate, b: GDate): number {
  const pa = parseGDate(a);
  const pb = parseGDate(b);
  const ms =
    Date.UTC(pb.gy, pb.gm - 1, pb.gd) - Date.UTC(pa.gy, pa.gm - 1, pa.gd);
  return Math.round(ms / 86_400_000);
}

export function compareGDate(a: GDate, b: GDate): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function maxGDate(...dates: GDate[]): GDate {
  return dates.reduce((a, b) => (compareGDate(a, b) >= 0 ? a : b));
}

export function minGDate(...dates: GDate[]): GDate {
  return dates.reduce((a, b) => (compareGDate(a, b) <= 0 ? a : b));
}

/** شروع هفته جلالی (شنبه) برای تاریخی که شامل gDate است */
export function startOfJalaliWeek(gDate: GDate): GDate {
  const wd = jalaliWeekday(gDate);
  return addGregorianDays(gDate, -wd);
}

export function endOfJalaliWeek(gDate: GDate): GDate {
  return addGregorianDays(startOfJalaliWeek(gDate), 6);
}

export function startOfJalaliMonth(gDate: GDate): GDate {
  const { jy, jm } = toJalali(gDate);
  return fromJalali(jy, jm, 1);
}

export function endOfJalaliMonth(gDate: GDate): GDate {
  const { jy, jm } = toJalali(gDate);
  return fromJalali(jy, jm, jalaliMonthLength(jy, jm));
}

export function addJalaliMonths(gDate: GDate, months: number): GDate {
  const { jy, jm, jd } = toJalali(gDate);
  const total = jy * 12 + (jm - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fromJalali(ny, nm, jd);
}

export function jalaliMonthIndex(gDate: GDate): number {
  const { jy, jm } = toJalali(gDate);
  return jy * 12 + (jm - 1);
}

/** timestamp ms برای پایان مهلت: periodEnd + dueTime در تهران */
export function dueAtTehranMs(periodEnd: GDate, dueTime?: string | null): number {
  const time =
    dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : "23:59";
  const [hh, mm] = time.split(":").map(Number);
  const seconds = time === "23:59" ? 59 : 0;
  const instant = fromZonedTime(
    `${periodEnd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    TEHRAN_TZ,
  );
  return instant.getTime();
}

/** تاریخ میلادی تهران از timestamp */
export function tehranDateFromMs(ms: number): GDate {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return assertGDate(fmt.format(new Date(ms)));
}

export function clampDayOfJalaliMonth(jy: number, jm: number, day: number): number {
  return Math.min(day, jalaliMonthLength(jy, jm));
}

export { jalaliMonthLength } from "./jalali-algo";
