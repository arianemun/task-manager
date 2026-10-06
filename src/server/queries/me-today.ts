import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  holidays,
  staffLeaves,
  taskCategories,
  taskOccurrences,
  taskTemplates,
  users,
  type OccurrenceStatus,
  type Priority,
} from "@/db/schema";
import {
  addGregorianDays,
  compareGDate,
  diffGregorianDays,
  endOfJalaliMonth,
  endOfJalaliWeek,
  todayTehran,
  type GDate,
} from "@/lib/dates";

const PRIORITY_RANK: Record<Priority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export type MeOccurrence = {
  id: number;
  templateId: number;
  title: string;
  description: string | null;
  priority: Priority;
  categoryName: string | null;
  categoryColor: string | null;
  requiresNote: boolean;
  requiresAttachment: boolean;
  periodKey: string;
  periodStart: GDate;
  periodEnd: GDate;
  dueAt: Date | null;
  status: OccurrenceStatus;
  completedAt: Date | null;
  note: string | null;
  reasonCode: string | null;
  attachmentPath: string | null;
  editedAt: Date | null;
  daysLeft: number;
  group: "today" | "week" | "month";
  locked: boolean;
  groupTask: boolean;
  completedByUserId: number | null;
  completedByName: string | null;
  fulfilledByOther: boolean;
  completionMode: "INDIVIDUAL" | "SHARED";
};

function sortOcc(a: MeOccurrence, b: MeOccurrence): number {
  const da = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const db_ = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (da !== db_) return da - db_;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export function loadMeToday(userId: number) {
  const today = todayTehran();
  const weekEnd = endOfJalaliWeek(today);
  const monthEnd = endOfJalaliMonth(today);

  const rows = db
    .select({
      id: taskOccurrences.id,
      templateId: taskOccurrences.templateId,
      periodKey: taskOccurrences.periodKey,
      periodStart: taskOccurrences.periodStart,
      periodEnd: taskOccurrences.periodEnd,
      dueAt: taskOccurrences.dueAt,
      status: taskOccurrences.status,
      completedAt: taskOccurrences.completedAt,
      note: taskOccurrences.note,
      reasonCode: taskOccurrences.reasonCode,
      attachmentPath: taskOccurrences.attachmentPath,
      editedAt: taskOccurrences.editedAt,
      completedByUserId: taskOccurrences.completedByUserId,
      completionMode: taskTemplates.completionMode,
      title: taskTemplates.title,
      description: taskTemplates.description,
      priority: taskTemplates.priority,
      requiresNote: taskTemplates.requiresNote,
      requiresAttachment: taskTemplates.requiresAttachment,
      categoryName: taskCategories.name,
      categoryColor: taskCategories.color,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .leftJoin(taskCategories, eq(taskTemplates.categoryId, taskCategories.id))
    .where(
      and(
        eq(taskOccurrences.userId, userId),
        sql`${taskOccurrences.periodStart} <= ${today}`,
        sql`${taskOccurrences.periodEnd} >= ${today}`,
      ),
    )
    .all();

  const completerIds = [
    ...new Set(
      rows
        .map((row) => row.completedByUserId)
        .filter((id): id is number => id != null),
    ),
  ];
  const completerNames = new Map(
    completerIds.length === 0
      ? []
      : db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(inArray(users.id, completerIds))
          .all()
          .map((person) => [person.id, person.fullName] as const),
  );

  const todayList: MeOccurrence[] = [];
  const weekList: MeOccurrence[] = [];
  const monthList: MeOccurrence[] = [];
  const excusedList: MeOccurrence[] = [];

  for (const r of rows) {
    const fulfilledByOther =
      r.status === "DONE_BY_PEER" ||
      (r.completedByUserId != null && r.completedByUserId !== userId);
    const locked =
      compareGDate(r.periodEnd, today) < 0 ||
      r.status === "MISSED" ||
      r.status === "EXCUSED" ||
      fulfilledByOther;
    const daysLeft = Math.max(0, diffGregorianDays(today, r.periodEnd));
    const base: MeOccurrence = {
      id: r.id,
      templateId: r.templateId,
      title: r.title,
      description: r.description,
      priority: r.priority,
      categoryName: r.categoryName,
      categoryColor: r.categoryColor,
      requiresNote: r.requiresNote,
      requiresAttachment: r.requiresAttachment,
      periodKey: r.periodKey,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      dueAt: r.dueAt,
      status: r.status,
      completedAt: r.completedAt,
      note: r.note,
      reasonCode: r.reasonCode,
      attachmentPath: r.attachmentPath,
      editedAt: r.editedAt,
      daysLeft,
      group: "today",
      locked,
      groupTask: r.completionMode === "SHARED",
      completionMode: r.completionMode,
      completedByUserId: r.completedByUserId,
      completedByName: r.completedByUserId
        ? (completerNames.get(r.completedByUserId) ?? null)
        : null,
      fulfilledByOther,
    };

    if (r.status === "EXCUSED") {
      excusedList.push(base);
      continue;
    }

    if (r.periodKey.startsWith("D:") || r.periodKey.startsWith("O:")) {
      todayList.push({ ...base, group: "today" });
    } else if (r.periodKey.startsWith("W:")) {
      weekList.push({ ...base, group: "week", daysLeft: Math.max(0, diffGregorianDays(today, weekEnd)) });
    } else if (r.periodKey.startsWith("M:")) {
      monthList.push({
        ...base,
        group: "month",
        daysLeft: Math.max(0, diffGregorianDays(today, monthEnd)),
      });
    } else {
      todayList.push({ ...base, group: "today" });
    }
  }

  todayList.sort(sortOcc);
  weekList.sort(sortOcc);
  monthList.sort(sortOcc);

  const ownToday = todayList.filter((o) => !o.fulfilledByOther);
  const doneToday = ownToday.filter(
    (o) => o.status === "DONE" || o.status === "DONE_LATE",
  );
  const progressTotal = ownToday.filter((o) => o.status !== "EXCUSED").length;
  const progressDone = doneToday.length;

  const onLeave = isUserOnLeave(userId, today);
  const isHoliday = !!db
    .select()
    .from(holidays)
    .where(eq(holidays.date, today))
    .get();

  const allTodayExcused =
    todayList.length === 0 &&
    excusedList.some(
      (e) => e.periodKey.startsWith("D:") || e.periodKey.startsWith("O:"),
    );

  return {
    today,
    todayList,
    weekList,
    monthList,
    excusedList,
    progress: {
      done: progressDone,
      total: progressTotal,
    },
    onLeave,
    isHoliday,
    showLeaveBanner: onLeave || (allTodayExcused && excusedList.length > 0),
  };
}

export function isUserOnLeave(userId: number, date: GDate): boolean {
  const leaves = db
    .select()
    .from(staffLeaves)
    .where(eq(staffLeaves.userId, userId))
    .all();
  return leaves.some(
    (l) =>
      compareGDate(date, l.startDate) >= 0 &&
      compareGDate(date, l.endDate) <= 0,
  );
}

export function leaveDatesForUser(
  userId: number,
  from: GDate,
  to: GDate,
): Set<GDate> {
  const set = new Set<GDate>();
  const leaves = db
    .select()
    .from(staffLeaves)
    .where(eq(staffLeaves.userId, userId))
    .all();
  for (const l of leaves) {
    let d = l.startDate;
    while (compareGDate(d, l.endDate) <= 0) {
      if (compareGDate(d, from) >= 0 && compareGDate(d, to) <= 0) {
        set.add(d);
      }
      d = addGregorianDays(d, 1);
    }
  }
  return set;
}
