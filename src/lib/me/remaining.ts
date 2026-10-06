import { fa } from "@/lib/i18n/fa";
import { jalaliWeekday, type GDate } from "@/lib/dates";
import { toFaDigits } from "@/lib/utils";

/** زمان باقی‌مانده به زبان طبیعی فارسی */
export function formatRemainingNatural(opts: {
  dueAt: Date | null;
  periodEnd: GDate;
  daysLeft: number;
  group: "today" | "week" | "month";
}): string {
  const { dueAt, periodEnd, daysLeft, group } = opts;

  if (dueAt) {
    const ms = dueAt.getTime() - Date.now();
    if (ms > 0 && ms < 36 * 60 * 60 * 1000) {
      const hours = Math.max(1, Math.ceil(ms / (60 * 60 * 1000)));
      return `${toFaDigits(hours)} ساعت مانده`;
    }
  }

  if (group === "today" || daysLeft <= 0) {
    return "تا پایان امروز";
  }

  if (daysLeft <= 6) {
    const wd = jalaliWeekday(periodEnd);
    return `تا ${fa.weekdays[wd as keyof typeof fa.weekdays]}`;
  }

  return `${toFaDigits(daysLeft)} روز مانده`;
}
