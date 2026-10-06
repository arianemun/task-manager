import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { holidays, taskOccurrences, taskTemplates, users } from "@/db/schema";
import {
  addGregorianDays,
  compareGDate,
  endOfJalaliMonth,
  fromJalali,
  jalaliMonthLength,
  jalaliWeekday,
  startOfJalaliMonth,
  toJalali,
  type GDate,
} from "@/lib/dates";
import { countableCompletion } from "@/lib/reports";
import { leaveDatesForUser } from "@/server/queries/me-today";

export type CalendarDayCell = {
  gDate: GDate;
  jDay: number;
  inMonth: boolean;
  isFuture: boolean;
  isHoliday: boolean;
  isLeave: boolean;
  rate: number | null;
  statuses: string[];
};

export function loadMeCalendarMonth(userId: number, anchor: GDate) {
  const { jy, jm } = toJalali(anchor);
  const monthStart = startOfJalaliMonth(anchor);
  const monthEnd = endOfJalaliMonth(anchor);
  const daysInMonth = jalaliMonthLength(jy, jm);
  const startWd = jalaliWeekday(monthStart);

  const holidaySet = new Set(
    db
      .select({ date: holidays.date })
      .from(holidays)
      .all()
      .map((h) => h.date),
  );
  const leaveSet = leaveDatesForUser(userId, monthStart, monthEnd);

  const rows = db
    .select({
      status: taskOccurrences.status,
      periodKey: taskOccurrences.periodKey,
      periodStart: taskOccurrences.periodStart,
      periodEnd: taskOccurrences.periodEnd,
      title: taskTemplates.title,
      id: taskOccurrences.id,
      completedByUserId: taskOccurrences.completedByUserId,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        eq(taskOccurrences.userId, userId),
        sql`${taskOccurrences.periodStart} <= ${monthEnd}`,
        sql`${taskOccurrences.periodEnd} >= ${monthStart}`,
      ),
    )
    .all();

  const today = anchor; // caller passes today or selected month anchor for "future" — use real today from caller
  void today;

  const cells: CalendarDayCell[] = [];
  // leading padding (شنبه اول)
  for (let i = 0; i < startWd; i++) {
    const g = addGregorianDays(monthStart, -(startWd - i));
    const j = toJalali(g);
    cells.push({
      gDate: g,
      jDay: j.jd,
      inMonth: false,
      isFuture: false,
      isHoliday: holidaySet.has(g),
      isLeave: leaveSet.has(g),
      rate: null,
      statuses: [],
    });
  }

  for (let jd = 1; jd <= daysInMonth; jd++) {
    const g = fromJalali(jy, jm, jd);
    const daily = rows.filter(
      (r) =>
        (r.periodKey.startsWith("D:") || r.periodKey.startsWith("O:")) &&
        compareGDate(r.periodStart, g) <= 0 &&
        compareGDate(r.periodEnd, g) >= 0,
    );
    const own = daily.filter(
      (r) => r.completedByUserId == null || r.completedByUserId === userId,
    );
    const c = countableCompletion(own.map((r) => r.status));
    cells.push({
      gDate: g,
      jDay: jd,
      inMonth: true,
      isFuture: false, // set by page with todayTehran
      isHoliday: holidaySet.has(g),
      isLeave: leaveSet.has(g),
      rate: c.rate,
      statuses: own.map((r) => r.status),
    });
  }

  // trailing to complete weeks
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!.gDate;
    const g = addGregorianDays(last, 1);
    const j = toJalali(g);
    cells.push({
      gDate: g,
      jDay: j.jd,
      inMonth: false,
      isFuture: false,
      isHoliday: holidaySet.has(g),
      isLeave: leaveSet.has(g),
      rate: null,
      statuses: [],
    });
  }

  return { jy, jm, monthStart, monthEnd, cells, rows };
}

export function dayDetail(userId: number, date: GDate) {
  const rows = db
    .select({
      id: taskOccurrences.id,
      title: taskTemplates.title,
      status: taskOccurrences.status,
      periodKey: taskOccurrences.periodKey,
      note: taskOccurrences.note,
      priority: taskTemplates.priority,
      completedByUserId: taskOccurrences.completedByUserId,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        eq(taskOccurrences.userId, userId),
        sql`${taskOccurrences.periodStart} <= ${date}`,
        sql`${taskOccurrences.periodEnd} >= ${date}`,
      ),
    )
    .all();

  const completerIds = [
    ...new Set(
      rows
        .map((row) => row.completedByUserId)
        .filter((id): id is number => id != null && id !== userId),
    ),
  ];
  const names = new Map(
    completerIds.length === 0
      ? []
      : db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(inArray(users.id, completerIds))
          .all()
          .map((person) => [person.id, person.fullName] as const),
  );

  return rows.map((row) => ({
    ...row,
    completedByName:
      row.completedByUserId != null && row.completedByUserId !== userId
        ? (names.get(row.completedByUserId) ?? null)
        : null,
  }));
}
