import { format } from "date-fns-jalali";
import { tehranDateFromMs, todayTehran, addGregorianDays } from "@/lib/dates";
import { toFaDigits } from "@/lib/utils";

export function chatTimeLabel(ms: number): string {
  const day = tehranDateFromMs(ms);
  const today = todayTehran();
  const yesterday = addGregorianDays(today, -1);
  const clock = toFaDigits(format(new Date(ms), "HH:mm"));
  if (day === today) return clock;
  if (day === yesterday) return "دیروز";
  return toFaDigits(format(new Date(ms), "yyyy/MM/dd"));
}

export function chatDayLabel(ms: number): string {
  const day = tehranDateFromMs(ms);
  const today = todayTehran();
  const yesterday = addGregorianDays(today, -1);
  if (day === today) return "امروز";
  if (day === yesterday) return "دیروز";
  return toFaDigits(format(new Date(ms), "yyyy/MM/dd"));
}

export function chatClock(ms: number): string {
  return toFaDigits(format(new Date(ms), "HH:mm"));
}
