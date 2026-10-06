import {
  addGregorianDays,
  addJalaliMonths,
  clampDayOfJalaliMonth,
  compareGDate,
  diffGregorianDays,
  endOfJalaliMonth,
  endOfJalaliWeek,
  fromJalali,
  jalaliMonthIndex,
  jalaliMonthLength,
  jalaliWeekday,
  maxGDate,
  minGDate,
  startOfJalaliMonth,
  startOfJalaliWeek,
  toJalali,
  type GDate,
} from "@/lib/dates";
import {
  dailyPeriodKey,
  monthlyPeriodKey,
  oncePeriodKey,
  weeklyPeriodKey,
} from "./period-key";
import type {
  CustomConfig,
  DailyConfig,
  MonthlyDayConfig,
  OccurrenceRangeOptions,
  Period,
  RecurrenceConfig,
  RecurrenceTemplateInput,
  WeeklySpecificConfig,
} from "./types";

function asSet(
  holidays?: ReadonlySet<GDate> | ReadonlyArray<GDate>,
): Set<GDate> {
  if (!holidays) return new Set();
  return holidays instanceof Set ? holidays : new Set(holidays);
}

function isDailySkip(
  gDate: GDate,
  excludeWeekdays: number[] | undefined,
  holidays: Set<GDate>,
  skipHolidays: boolean,
): boolean {
  if (excludeWeekdays?.includes(jalaliWeekday(gDate))) return true;
  if (skipHolidays && holidays.has(gDate)) return true;
  return false;
}

function eachGregorianDay(from: GDate, to: GDate): GDate[] {
  if (compareGDate(from, to) > 0) return [];
  const out: GDate[] = [];
  let cur = from;
  while (compareGDate(cur, to) <= 0) {
    out.push(cur);
    cur = addGregorianDays(cur, 1);
  }
  return out;
}

function resolveRange(
  template: RecurrenceTemplateInput,
  rangeStart: GDate,
  rangeEnd: GDate,
): { from: GDate; to: GDate } | null {
  const start = maxGDate(template.startDate, rangeStart);
  const hardEnd = template.endDate
    ? minGDate(template.endDate, rangeEnd)
    : rangeEnd;
  if (compareGDate(start, hardEnd) > 0) return null;
  return { from: start, to: hardEnd };
}

function periodDaily(gDate: GDate): Period {
  return {
    periodKey: dailyPeriodKey(gDate),
    periodStart: gDate,
    periodEnd: gDate,
    kind: "daily",
  };
}

function periodWeekly(gDateInWeek: GDate): Period {
  const start = startOfJalaliWeek(gDateInWeek);
  return {
    periodKey: weeklyPeriodKey(gDateInWeek),
    periodStart: start,
    periodEnd: endOfJalaliWeek(gDateInWeek),
    kind: "weekly",
  };
}

function periodMonthly(gDate: GDate): Period {
  return {
    periodKey: monthlyPeriodKey(gDate),
    periodStart: startOfJalaliMonth(gDate),
    periodEnd: endOfJalaliMonth(gDate),
    kind: "monthly",
  };
}

function periodOnce(gDate: GDate): Period {
  return {
    periodKey: oncePeriodKey(gDate),
    periodStart: gDate,
    periodEnd: gDate,
    kind: "once",
  };
}

function uniqueByKey(periods: Period[]): Period[] {
  const map = new Map<string, Period>();
  for (const p of periods) map.set(p.periodKey, p);
  return [...map.values()].sort((a, b) =>
    compareGDate(a.periodStart, b.periodStart),
  );
}

function handleOnce(
  config: RecurrenceConfig,
  from: GDate,
  to: GDate,
): Period[] {
  const date = (config as { date?: string }).date;
  if (!date) return [];
  if (compareGDate(date, from) < 0 || compareGDate(date, to) > 0) return [];
  return [periodOnce(date)];
}

function handleDaily(
  template: RecurrenceTemplateInput,
  config: DailyConfig,
  from: GDate,
  to: GDate,
  holidays: Set<GDate>,
  applySkips: boolean,
): Period[] {
  const interval = Math.max(1, config.interval ?? 1);
  const skipHolidays = template.skipHolidays !== false;
  const out: Period[] = [];
  for (const day of eachGregorianDay(from, to)) {
    const delta = diffGregorianDays(template.startDate, day);
    if (delta < 0 || delta % interval !== 0) continue;
    if (
      applySkips &&
      isDailySkip(day, config.excludeWeekdays, holidays, skipHolidays)
    ) {
      continue;
    }
    out.push(periodDaily(day));
  }
  return out;
}

function handleWeekly(
  template: RecurrenceTemplateInput,
  config: RecurrenceConfig,
  from: GDate,
  to: GDate,
  holidays: Set<GDate>,
  applySkips: boolean,
): Period[] {
  const mode = (config as { mode?: string }).mode ?? "specific_days";
  if (mode === "any_day_in_week") {
    const out: Period[] = [];
    let cursor = startOfJalaliWeek(from);
    const last = startOfJalaliWeek(to);
    while (compareGDate(cursor, last) <= 0) {
      const weekEnd = endOfJalaliWeek(cursor);
      // هفته با بازه تلاقی داشته باشد
      if (compareGDate(weekEnd, from) >= 0 && compareGDate(cursor, to) <= 0) {
        out.push(periodWeekly(cursor));
      }
      cursor = addGregorianDays(cursor, 7);
    }
    return uniqueByKey(out);
  }

  const weekdays = (config as WeeklySpecificConfig).weekdays ?? [];
  const skipHolidays = template.skipHolidays !== false;
  const out: Period[] = [];
  for (const day of eachGregorianDay(from, to)) {
    if (!weekdays.includes(jalaliWeekday(day))) continue;
    if (
      applySkips &&
      isDailySkip(day, undefined, holidays, skipHolidays)
    ) {
      continue;
    }
    out.push(periodDaily(day));
  }
  return out;
}

function handleMonthly(
  template: RecurrenceTemplateInput,
  config: RecurrenceConfig,
  from: GDate,
  to: GDate,
  holidays: Set<GDate>,
  applySkips: boolean,
): Period[] {
  const mode = (config as { mode?: string }).mode ?? "day_of_month";
  if (mode === "any_day_in_month") {
    const out: Period[] = [];
    let cursor = startOfJalaliMonth(from);
    const last = startOfJalaliMonth(to);
    while (compareGDate(cursor, last) <= 0) {
      const monthEnd = endOfJalaliMonth(cursor);
      if (compareGDate(monthEnd, from) >= 0 && compareGDate(cursor, to) <= 0) {
        out.push(periodMonthly(cursor));
      }
      cursor = addJalaliMonths(cursor, 1);
      cursor = startOfJalaliMonth(cursor);
    }
    return uniqueByKey(out);
  }

  const skipHolidays = template.skipHolidays !== false;
  const out: Period[] = [];
  let monthCursor = startOfJalaliMonth(from);
  const lastMonth = startOfJalaliMonth(to);

  while (compareGDate(monthCursor, lastMonth) <= 0) {
    const { jy, jm } = toJalali(monthCursor);
    let targetDay: number;
    if (mode === "last_day") {
      targetDay = jalaliMonthLength(jy, jm);
    } else {
      const day = (config as MonthlyDayConfig).day ?? 1;
      targetDay = clampDayOfJalaliMonth(jy, jm, day);
    }
    const gDate = fromJalali(jy, jm, targetDay);
    if (compareGDate(gDate, from) >= 0 && compareGDate(gDate, to) <= 0) {
      if (
        !(
          applySkips &&
          isDailySkip(gDate, undefined, holidays, skipHolidays)
        )
      ) {
        out.push(periodDaily(gDate));
      }
    }
    monthCursor = addJalaliMonths(monthCursor, 1);
    monthCursor = startOfJalaliMonth(monthCursor);
  }
  return out;
}

function handleCustom(
  template: RecurrenceTemplateInput,
  config: CustomConfig,
  from: GDate,
  to: GDate,
  holidays: Set<GDate>,
  applySkips: boolean,
): Period[] {
  const interval = Math.max(1, config.interval ?? 1);
  const skipHolidays = template.skipHolidays !== false;

  if (config.unit === "day") {
    return handleDaily(
      template,
      { interval, excludeWeekdays: undefined },
      from,
      to,
      holidays,
      applySkips,
    );
  }

  if (config.unit === "week") {
    const weekdays = config.weekdays ?? [];
    const startWeek = startOfJalaliWeek(template.startDate);
    const out: Period[] = [];
    for (const day of eachGregorianDay(from, to)) {
      if (weekdays.length && !weekdays.includes(jalaliWeekday(day))) continue;
      const weekStart = startOfJalaliWeek(day);
      const weeks = Math.floor(diffGregorianDays(startWeek, weekStart) / 7);
      if (weeks < 0 || weeks % interval !== 0) continue;
      if (
        applySkips &&
        isDailySkip(day, undefined, holidays, skipHolidays)
      ) {
        continue;
      }
      out.push(periodDaily(day));
    }
    return out;
  }

  // unit === month
  const dayOfMonth = config.day ?? toJalali(template.startDate).jd;
  const startIdx = jalaliMonthIndex(template.startDate);
  const out: Period[] = [];
  let monthCursor = startOfJalaliMonth(from);
  const lastMonth = startOfJalaliMonth(to);
  while (compareGDate(monthCursor, lastMonth) <= 0) {
    const idx = jalaliMonthIndex(monthCursor);
    const delta = idx - startIdx;
    if (delta >= 0 && delta % interval === 0) {
      const { jy, jm } = toJalali(monthCursor);
      const gDate = fromJalali(
        jy,
        jm,
        clampDayOfJalaliMonth(jy, jm, dayOfMonth),
      );
      if (compareGDate(gDate, from) >= 0 && compareGDate(gDate, to) <= 0) {
        if (
          !(
            applySkips &&
            isDailySkip(gDate, undefined, holidays, skipHolidays)
          )
        ) {
          out.push(periodDaily(gDate));
        }
      }
    }
    monthCursor = addJalaliMonths(startOfJalaliMonth(monthCursor), 1);
  }
  return out;
}

/**
 * دوره‌های occurrence در بازه [rangeStart, rangeEnd] بر اساس تقویم جلالی.
 * فقط منطق تقویمی — بدون DB.
 */
export function getOccurrencesInRange(
  template: RecurrenceTemplateInput,
  rangeStart: GDate,
  rangeEnd: GDate,
  options: OccurrenceRangeOptions = {},
): Period[] {
  const resolved = resolveRange(template, rangeStart, rangeEnd);
  if (!resolved) return [];
  const { from, to } = resolved;
  const holidays = asSet(options.holidays);
  const applySkips = options.applySkips !== false;
  const config = template.recurrenceConfig ?? {};

  switch (template.recurrenceType) {
    case "ONCE":
      return handleOnce(config, from, to);
    case "DAILY":
      return handleDaily(
        template,
        config as DailyConfig,
        from,
        to,
        holidays,
        applySkips,
      );
    case "WEEKLY":
      return handleWeekly(template, config, from, to, holidays, applySkips);
    case "MONTHLY":
      return handleMonthly(template, config, from, to, holidays, applySkips);
    case "CUSTOM":
      return handleCustom(
        template,
        config as CustomConfig,
        from,
        to,
        holidays,
        applySkips,
      );
    default:
      return [];
  }
}

/**
 * N تاریخ بعدی (periodStart) از from به‌بعد برای پیش‌نمایش فرم.
 */
export function previewOccurrences(
  template: RecurrenceTemplateInput,
  from: GDate,
  count: number,
  options: OccurrenceRangeOptions = {},
): Period[] {
  const n = Math.max(0, Math.min(100, count));
  if (n === 0) return [];

  const collected: Period[] = [];
  let windowStart = from;
  // پنجره‌های روبه‌جلو تا پیدا شدن N دوره
  for (let guard = 0; guard < 40 && collected.length < n; guard++) {
    const windowEnd = addGregorianDays(windowStart, 120);
    const chunk = getOccurrencesInRange(
      template,
      windowStart,
      windowEnd,
      options,
    ).filter((p) => compareGDate(p.periodStart, from) >= 0);
    for (const p of chunk) {
      if (collected.some((c) => c.periodKey === p.periodKey)) continue;
      collected.push(p);
      if (collected.length >= n) break;
    }
    windowStart = addGregorianDays(windowEnd, 1);
    if (template.endDate && compareGDate(windowStart, template.endDate) > 0) {
      break;
    }
  }
  return collected.slice(0, n);
}

export function effectiveOccurrenceStart(parts: {
  templateStart: GDate;
  assignmentCreatedDate: GDate;
  hireDate?: GDate | null;
  departmentJoinedAt?: GDate | null;
}): GDate {
  const dates = [parts.templateStart, parts.assignmentCreatedDate];
  if (parts.hireDate) dates.push(parts.hireDate);
  if (parts.departmentJoinedAt) dates.push(parts.departmentJoinedAt);
  return maxGDate(...dates);
}

/**
 * اگر کاربر هم مستقیم و هم از دپارتمان اساین شده، زودترین تاریخ واجد شرایط.
 */
export function earliestEligibleStart(paths: Array<{
  templateStart: GDate;
  assignmentCreatedDate: GDate;
  hireDate?: GDate | null;
  departmentJoinedAt?: GDate | null;
}>): GDate {
  const starts = paths.map((p) => effectiveOccurrenceStart(p));
  return minGDate(...starts);
}
