import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { holidays } from "@/db/schema";
import { authErrorResponse } from "@/lib/auth/http";
import { requirePermission } from "@/lib/auth/user";
import {
  jalaliWeekday,
  toJalali,
  todayTehran,
  type GDate,
} from "@/lib/dates";
import { fa } from "@/lib/i18n/fa";
import { previewOccurrences, type RecurrenceConfig } from "@/lib/recurrence";
import { toFaDigits } from "@/lib/utils";

export const runtime = "nodejs";

const bodySchema = z.object({
  recurrenceType: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"]),
  recurrenceConfig: z.record(z.string(), z.unknown()).default({}),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  skipHolidays: z.boolean().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  count: z.number().int().min(1).max(30).optional(),
});

export async function POST(request: Request) {
  try {
    await requirePermission("tasks.create");
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "ورودی نامعتبر", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const holidayRows = db.select({ date: holidays.date }).from(holidays).all();
    const holidaySet = new Set(holidayRows.map((h) => h.date));

    const periods = previewOccurrences(
      {
        recurrenceType: data.recurrenceType,
        recurrenceConfig: data.recurrenceConfig as RecurrenceConfig,
        startDate: data.startDate as GDate,
        endDate: data.endDate as GDate | null | undefined,
        skipHolidays: data.skipHolidays,
      },
      (data.from as GDate | undefined) ?? todayTehran(),
      data.count ?? 10,
      { holidays: holidaySet },
    );

    const excludeWeekdays = Array.isArray(
      (data.recurrenceConfig as { excludeWeekdays?: number[] }).excludeWeekdays,
    )
      ? ((data.recurrenceConfig as { excludeWeekdays: number[] }).excludeWeekdays)
      : [];

    const enriched = periods.map((p) => {
      const j = toJalali(p.periodStart);
      const wd = jalaliWeekday(p.periodStart);
      return {
        periodKey: p.periodKey,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        jalali: toFaDigits(j.jDate),
        weekday: fa.weekdays[wd as keyof typeof fa.weekdays],
        weekdayIndex: wd,
        isHoliday: holidaySet.has(p.periodStart),
        isExcludedWeekday: excludeWeekdays.includes(wd),
      };
    });

    return NextResponse.json({
      ok: true,
      periods: enriched,
      empty: enriched.length === 0,
      warning:
        enriched.length === 0
          ? "این الگو در بازه قابل پیش‌نمایش هیچ تاریخی تولید نمی‌کند"
          : null,
    });
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
