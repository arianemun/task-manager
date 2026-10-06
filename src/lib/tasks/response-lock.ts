import { compareGDate, type GDate } from "@/lib/dates";

/**
 * قفل پاسخ پرسنل بعد از پایان دوره.
 * period_end گذشته کافی است؛ لازم نیست close-periods وضعیت را MISSED کرده باشد.
 * due_at قفل نمی‌سازد: تا پایان دوره، ثبت بعد از مهلت DONE_LATE می‌شود.
 */
export function isStaffResponseLocked(input: {
  status: string;
  periodEnd: GDate;
  today: GDate;
}): boolean {
  if (compareGDate(input.periodEnd, input.today) < 0) return true;
  return (
    input.status === "MISSED" ||
    input.status === "EXCUSED" ||
    input.status === "DONE_BY_PEER"
  );
}
