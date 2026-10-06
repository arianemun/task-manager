import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  taskOccurrences,
  taskTemplates,
  users,
  type OccurrenceStatus,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth/user";
import {
  endOfJalaliMonth,
  endOfJalaliWeek,
  startOfJalaliMonth,
  startOfJalaliWeek,
  type GDate,
} from "@/lib/dates";

export type BoardCell = {
  occurrenceId: number;
  templateId: number;
  userId: number;
  status: OccurrenceStatus;
  completedAt: Date | null;
  note: string | null;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
};

export type BoardPayload = {
  date: GDate;
  staff: Array<{ id: number; fullName: string }>;
  tasks: Array<{ id: number; title: string; recurrenceType: string }>;
  cells: BoardCell[];
  summary: {
    completionRate: number | null;
    unanswered: number;
    silentStaff: Array<{ id: number; fullName: string }>;
  };
};

function scopedStaff(actor: AuthUser) {
  const conditions = [
    eq(users.isActive, true),
    isNull(users.deletedAt),
    inArray(users.role, ["STAFF", "MANAGER"]),
  ];
  if (actor.role === "MANAGER" && actor.departmentId) {
    conditions.push(eq(users.departmentId, actor.departmentId));
  }
  return db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(users.fullName))
    .all();
}

function buildSummary(
  staff: Array<{ id: number; fullName: string }>,
  cells: BoardCell[],
  forDay: boolean,
) {
  const counted = cells.filter(
    (c) => c.status !== "EXCUSED" && c.status !== "PENDING",
  );
  const done = counted.filter(
    (c) => c.status === "DONE" || c.status === "DONE_LATE",
  ).length;
  const unanswered = cells.filter((c) => c.status === "PENDING").length;

  let silentStaff: Array<{ id: number; fullName: string }> = [];
  if (forDay) {
    const responded = new Set(
      cells.filter((c) => c.status !== "PENDING").map((c) => c.userId),
    );
    const hasPending = new Set(
      cells.filter((c) => c.status === "PENDING").map((c) => c.userId),
    );
    silentStaff = staff.filter(
      (s) => hasPending.has(s.id) && !responded.has(s.id),
    );
  }

  return {
    completionRate:
      counted.length === 0 ? null : Math.round((done / counted.length) * 100),
    unanswered,
    silentStaff,
  };
}

/** یک کوئری aggregate برای ماتریس روز (D/O که بازه‌شان شامل تاریخ است) */
export function loadBoardDay(actor: AuthUser, date: GDate): BoardPayload {
  const staff = scopedStaff(actor);
  const staffIds = staff.map((s) => s.id);

  if (staffIds.length === 0) {
    return {
      date,
      staff: [],
      tasks: [],
      cells: [],
      summary: { completionRate: null, unanswered: 0, silentStaff: [] },
    };
  }

  const rows = db
    .select({
      occurrenceId: taskOccurrences.id,
      templateId: taskOccurrences.templateId,
      userId: taskOccurrences.userId,
      status: taskOccurrences.status,
      completedAt: taskOccurrences.completedAt,
      note: taskOccurrences.note,
      periodKey: taskOccurrences.periodKey,
      periodStart: taskOccurrences.periodStart,
      periodEnd: taskOccurrences.periodEnd,
      taskTitle: taskTemplates.title,
      recurrenceType: taskTemplates.recurrenceType,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        inArray(taskOccurrences.userId, staffIds),
        eq(taskTemplates.isActive, true),
        sql`${taskOccurrences.periodStart} <= ${date}`,
        sql`${taskOccurrences.periodEnd} >= ${date}`,
        sql`(${taskOccurrences.periodKey} like 'D:%' OR ${taskOccurrences.periodKey} like 'O:%')`,
      ),
    )
    .all();

  const taskMap = new Map<number, { id: number; title: string; recurrenceType: string }>();
  const cells: BoardCell[] = rows.map((c) => {
    taskMap.set(c.templateId, {
      id: c.templateId,
      title: c.taskTitle,
      recurrenceType: c.recurrenceType,
    });
    return {
      occurrenceId: c.occurrenceId,
      templateId: c.templateId,
      userId: c.userId,
      status: c.status,
      completedAt: c.completedAt,
      note: c.note,
      periodKey: c.periodKey,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
    };
  });

  return {
    date,
    staff,
    tasks: [...taskMap.values()],
    cells,
    summary: buildSummary(staff, cells, true),
  };
}

export function loadBoardPeriod(
  actor: AuthUser,
  kind: "week" | "month",
  anchor: GDate,
): BoardPayload {
  const start =
    kind === "week" ? startOfJalaliWeek(anchor) : startOfJalaliMonth(anchor);
  const end =
    kind === "week" ? endOfJalaliWeek(anchor) : endOfJalaliMonth(anchor);
  const prefix = kind === "week" ? "W:" : "M:";

  const staff = scopedStaff(actor);
  const staffIds = staff.map((s) => s.id);
  if (staffIds.length === 0) {
    return {
      date: anchor,
      staff: [],
      tasks: [],
      cells: [],
      summary: { completionRate: null, unanswered: 0, silentStaff: [] },
    };
  }

  const rows = db
    .select({
      occurrenceId: taskOccurrences.id,
      templateId: taskOccurrences.templateId,
      userId: taskOccurrences.userId,
      status: taskOccurrences.status,
      completedAt: taskOccurrences.completedAt,
      note: taskOccurrences.note,
      periodKey: taskOccurrences.periodKey,
      periodStart: taskOccurrences.periodStart,
      periodEnd: taskOccurrences.periodEnd,
      taskTitle: taskTemplates.title,
      recurrenceType: taskTemplates.recurrenceType,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        inArray(taskOccurrences.userId, staffIds),
        eq(taskTemplates.isActive, true),
        sql`${taskOccurrences.periodKey} like ${prefix + "%"}`,
        sql`${taskOccurrences.periodStart} <= ${end}`,
        sql`${taskOccurrences.periodEnd} >= ${start}`,
      ),
    )
    .all();

  const taskMap = new Map<number, { id: number; title: string; recurrenceType: string }>();
  const cells: BoardCell[] = rows.map((c) => {
    taskMap.set(c.templateId, {
      id: c.templateId,
      title: c.taskTitle,
      recurrenceType: c.recurrenceType,
    });
    return {
      occurrenceId: c.occurrenceId,
      templateId: c.templateId,
      userId: c.userId,
      status: c.status,
      completedAt: c.completedAt,
      note: c.note,
      periodKey: c.periodKey,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
    };
  });

  return {
    date: anchor,
    staff,
    tasks: [...taskMap.values()],
    cells,
    summary: buildSummary(staff, cells, false),
  };
}
