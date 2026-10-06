import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";
import type { RecurrenceType } from "@/db/schema";
import type { RecurrenceConfig } from "./types";

const WEEKDAY_NAMES = fa.weekdays;

function weekdayList(days: number[]): string {
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_NAMES[d as keyof typeof WEEKDAY_NAMES] ?? String(d))
    .join("، ");
}

function n(v: number): string {
  return toFaDigits(v);
}

/** خلاصه الگوی تکرار به زبان طبیعی فارسی */
export function describeRecurrence(
  type: RecurrenceType,
  config: RecurrenceConfig = {},
): string {
  const c = config as Record<string, unknown>;

  switch (type) {
    case "ONCE": {
      const date = typeof c.date === "string" ? c.date : "—";
      return `یک‌باره در ${date}`;
    }
    case "DAILY": {
      const interval = Number(c.interval ?? 1);
      const exclude = Array.isArray(c.excludeWeekdays)
        ? (c.excludeWeekdays as number[])
        : [];
      const base =
        interval <= 1 ? "هر روز" : `هر ${n(interval)} روز یک‌بار`;
      if (exclude.length === 0) return base;
      return `${base} به‌جز ${weekdayList(exclude)}`;
    }
    case "WEEKLY": {
      const mode = c.mode ?? "specific_days";
      if (mode === "any_day_in_week") return "یک‌بار در طول هفته";
      const weekdays = Array.isArray(c.weekdays)
        ? (c.weekdays as number[])
        : [];
      if (weekdays.length === 0) return "هفتگی";
      return `هر هفته، ${weekdayList(weekdays)}`;
    }
    case "MONTHLY": {
      const mode = c.mode ?? "day_of_month";
      if (mode === "any_day_in_month") return "یک‌بار در طول ماه";
      if (mode === "last_day") return "آخرین روز هر ماه";
      const day = Number(c.day ?? 1);
      return `روز ${n(day)} هر ماه`;
    }
    case "CUSTOM": {
      const unit = c.unit ?? "week";
      const interval = Number(c.interval ?? 1);
      if (unit === "day") {
        return interval <= 1 ? "هر روز" : `هر ${n(interval)} روز`;
      }
      if (unit === "week") {
        const weekdays = Array.isArray(c.weekdays)
          ? (c.weekdays as number[])
          : [];
        const base =
          interval <= 1 ? "هر هفته" : `هر ${n(interval)} هفته`;
        return weekdays.length
          ? `${base}، ${weekdayList(weekdays)}`
          : base;
      }
      const day = Number(c.day ?? 1);
      const base =
        interval <= 1 ? "هر ماه" : `هر ${n(interval)} ماه`;
      return `${base}، روز ${n(day)}`;
    }
    default:
      return "—";
  }
}
