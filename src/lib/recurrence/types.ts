import type { GDate } from "@/lib/dates";
import type { RecurrenceType } from "@/db/schema";

export type PeriodKind = "daily" | "weekly" | "monthly" | "once";

export type Period = {
  periodKey: string;
  periodStart: GDate;
  periodEnd: GDate;
  kind: PeriodKind;
};

export type OnceConfig = { date: GDate };
export type DailyConfig = {
  interval?: number;
  excludeWeekdays?: number[];
};
export type WeeklySpecificConfig = {
  mode: "specific_days";
  weekdays: number[];
};
export type WeeklyAnyConfig = { mode: "any_day_in_week" };
export type MonthlyDayConfig = { mode: "day_of_month"; day: number };
export type MonthlyLastConfig = { mode: "last_day" };
export type MonthlyAnyConfig = { mode: "any_day_in_month" };
export type CustomConfig = {
  unit: "week" | "month" | "day";
  interval: number;
  weekdays?: number[];
  day?: number;
};

export type RecurrenceConfig =
  | OnceConfig
  | DailyConfig
  | WeeklySpecificConfig
  | WeeklyAnyConfig
  | MonthlyDayConfig
  | MonthlyLastConfig
  | MonthlyAnyConfig
  | CustomConfig
  | Record<string, unknown>;

export type RecurrenceTemplateInput = {
  recurrenceType: RecurrenceType;
  recurrenceConfig: RecurrenceConfig;
  startDate: GDate;
  endDate?: GDate | null;
  skipHolidays?: boolean;
};

export type OccurrenceRangeOptions = {
  /** مجموعه تاریخ‌های تعطیل میلادی YYYY-MM-DD */
  holidays?: ReadonlySet<GDate> | ReadonlyArray<GDate>;
  /** اگر false باشد excludeWeekdays و تعطیلات اعمال نشوند (برای پیش‌نمایش خام) */
  applySkips?: boolean;
};
