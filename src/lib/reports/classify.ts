import { compareGDate, type GDate } from "@/lib/dates";

/**
 * قاعده درصد (منبع واحد برای /me/report، داشبورد، /admin/reports و پروفایل پرسنل):
 *
 * - DONE و DONE_LATE در صورت و مخرج.
 * - NOT_DONE و MISSED و OVERDUE فقط در مخرج. OVERDUE وضعیت ذخیره‌شده نیست:
 *   occurrence با status=PENDING که due_at آن گذشته باشد، در محاسبه OVERDUE است
 *   و در دیتابیس PENDING می‌ماند تا پرسنل هنوز بتواند ثبت کند.
 * - PENDING که مهلتش نرسیده «در جریان» است: از صورت و مخرج حذف، جدا شمرده می‌شود.
 * - EXCUSED و DONE_BY_PEER از صورت و مخرج حذف (نه امتیاز، نه جریمه).
 * - مخرج صفر → null، نه ۰ ساختگی و نه ۱۰۰.
 * - اگر بازه امروز را شامل شود، دوره جاری هفتگی/ماهانه با period_end بعد از بازه
 *   در «در جریان» می‌آید و فقط وقتی مهلتش گذشته در درصد (OVERDUE) حساب می‌شود.
 */
export type ClassifiedOccurrence = {
  status: string;
  dueAtMs: number | null;
  periodStart: GDate;
  periodEnd: GDate;
  periodKey: string;
  userId: number | null;
  completedByUserId: number | null;
};

export type RateContext = {
  nowMs: number;
  from: GDate;
  to: GDate;
  today: GDate;
};

export type RateClass =
  | { kind: "out_of_range" }
  | { kind: "excluded" }
  | { kind: "in_progress" }
  | { kind: "counted"; status: "DONE" | "DONE_LATE" | "NOT_DONE" | "MISSED" | "OVERDUE" };

function rangeIncludesToday(ctx: RateContext): boolean {
  return compareGDate(ctx.from, ctx.today) <= 0 && compareGDate(ctx.to, ctx.today) >= 0;
}

function periodEndInside(row: ClassifiedOccurrence, ctx: RateContext): boolean {
  return (
    compareGDate(row.periodEnd, ctx.from) >= 0 &&
    compareGDate(row.periodEnd, ctx.to) <= 0
  );
}

/** دوره هفتگی/ماهانه که امروز داخل آن است ولی period_end بعد از انتهای بازه است. */
export function isOpenCurrentPeriod(row: ClassifiedOccurrence, ctx: RateContext): boolean {
  if (!rangeIncludesToday(ctx)) return false;
  const weeklyOrMonthly =
    row.periodKey.startsWith("W:") || row.periodKey.startsWith("M:");
  if (!weeklyOrMonthly) return false;
  return (
    compareGDate(row.periodEnd, ctx.to) > 0 &&
    compareGDate(row.periodStart, ctx.today) <= 0 &&
    compareGDate(row.periodEnd, ctx.today) >= 0
  );
}

function deadlinePassed(row: ClassifiedOccurrence, nowMs: number): boolean {
  return row.dueAtMs != null && row.dueAtMs <= nowMs;
}

export function classifyOccurrence(
  row: ClassifiedOccurrence,
  ctx: RateContext,
): RateClass {
  const inside = periodEndInside(row, ctx);
  const open = isOpenCurrentPeriod(row, ctx);
  if (!inside && !open) return { kind: "out_of_range" };

  if (row.status === "EXCUSED" || row.status === "DONE_BY_PEER") {
    return inside ? { kind: "excluded" } : { kind: "out_of_range" };
  }

  if (row.status === "PENDING") {
    if (deadlinePassed(row, ctx.nowMs)) {
      return { kind: "counted", status: "OVERDUE" };
    }
    return { kind: "in_progress" };
  }

  if (!inside) return { kind: "out_of_range" };

  if (
    row.status === "DONE" ||
    row.status === "DONE_LATE" ||
    row.status === "NOT_DONE" ||
    row.status === "MISSED"
  ) {
    return { kind: "counted", status: row.status };
  }

  return { kind: "excluded" };
}
