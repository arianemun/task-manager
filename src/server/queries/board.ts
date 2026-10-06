import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  taskOccurrences,
  taskTemplates,
  users,
  type OccurrenceStatus,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth/user";
import { userInDepartmentsSql } from "@/lib/departments/membership";
import { occurrenceSourceScope } from "@/lib/scope/occurrences";
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
  completedByUserId: number | null;
  completedByName: string | null;
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
  if (actor.role === "MANAGER" && actor.departmentIds.length > 0) {
    conditions.push(userInDepartmentsSql(actor.departmentIds));
  }
  return db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(users.fullName))
    .all();
}

function withCompleterNames<T extends { completedByUserId: number | null }>(
  rows: T[],
): Array<T & { completedByName: string | null }> {
  const ids = [
    ...new Set(
      rows
        .map((row) => row.completedByUserId)
        .filter((id): id is number => id != null),
    ),
  ];
  const names = new Map(
    ids.length === 0
      ? []
      : db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(inArray(users.id, ids))
          .all()
          .map((person) => [person.id, person.fullName] as const),
  );
  return rows.map((row) => ({
    ...row,
    completedByName: row.completedByUserId
      ? (names.get(row.completedByUserId) ?? null)
      : null,
  }));
}

function buildSummary(
  staff: Array<{ id: number; fullName: string }>,
  cells: BoardCell[],
  forDay: boolean,
) {
  const ownCells = cells.filter(
    (c) => c.completedByUserId == null || c.completedByUserId === c.userId,
  );
  const counted = ownCells.filter(
    (c) => c.status !== "EXCUSED" && c.status !== "PENDING",
  );
  const done = counted.filter(
    (c) => c.status === "DONE" || c.status === "DONE_LATE",
  ).length;
  const unanswered = ownCells.filter((c) => c.status === "PENDING").length;

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
export function loadBoardDay(
  actor: AuthUser,
  date: GDate,
  departmentId?: number | null,
): BoardPayload {
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
      completedByUserId: taskOccurrences.completedByUserId,
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
        occurrenceSourceScope(actor, departmentId ?? null),
      ),
    )
    .all();

  const named = withCompleterNames(rows);
  const taskMap = new Map<number, { id: number; title: string; recurrenceType: string }>();
  const cells: BoardCell[] = named.map((c) => {
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
      completedByUserId: c.completedByUserId,
      completedByName: c.completedByName,
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
  departmentId?: number | null,
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
      completedByUserId: taskOccurrences.completedByUserId,
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
        occurrenceSourceScope(actor, departmentId ?? null),
      ),
    )
    .all();

  const named = withCompleterNames(rows);
  const taskMap = new Map<number, { id: number; title: string; recurrenceType: string }>();
  const cells: BoardCell[] = named.map((c) => {
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
      completedByUserId: c.completedByUserId,
      completedByName: c.completedByName,
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
