import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  holidays,
  settings,
  staffLeaves,
  taskAssignments,
  taskOccurrences,
  taskTemplates,
  userDepartments,
  users,
} from "@/db/schema";
import {
  addGregorianDays,
  compareGDate,
  dueAtTehranMs,
  maxGDate,
  minGDate,
  tehranDateFromMs,
  todayTehran,
  type GDate,
} from "@/lib/dates";
import { activeMembersOfDepartment } from "@/lib/departments/membership";
import {
  earliestEligibleStart,
  getOccurrencesInRange,
  type RecurrenceConfig,
  type RecurrenceTemplateInput,
} from "@/lib/recurrence";
import {
  LAST_OCCURRENCE_GENERATED_KEY,
  LAST_PERIOD_CLOSE_KEY,
} from "@/lib/settings/system-keys";
import { resolveOccurrenceSource } from "@/lib/tasks/occurrence-source";
import { syncPendingGroupClosures } from "@/server/services/group-completion";

const LAST_GEN_KEY = LAST_OCCURRENCE_GENERATED_KEY;
export const MAX_CATCHUP_DAYS = 62;

export type GenerateResult = {
  inserted: number;
  templates: number;
  from: GDate;
  to: GDate;
};

export type CloseResult = {
  closed: number;
  asOf: GDate;
};

function loadHolidaySet(): Set<GDate> {
  return new Set(
    db
      .select({ date: holidays.date })
      .from(holidays)
      .all()
      .map((h) => h.date),
  );
}

function loadLeavesForUsers(userIds: number[]): Map<number, Array<{ start: GDate; end: GDate }>> {
  const map = new Map<number, Array<{ start: GDate; end: GDate }>>();
  if (userIds.length === 0) return map;
  const rows = db
    .select()
    .from(staffLeaves)
    .where(inArray(staffLeaves.userId, userIds))
    .all();
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push({ start: r.startDate, end: r.endDate });
    map.set(r.userId, list);
  }
  return map;
}

function isOnLeave(
  leaves: Array<{ start: GDate; end: GDate }> | undefined,
  periodStart: GDate,
  periodEnd: GDate,
): boolean {
  if (!leaves?.length) return false;
  return leaves.some(
    (l) =>
      compareGDate(periodStart, l.end) <= 0 &&
      compareGDate(periodEnd, l.start) >= 0,
  );
}

function getLastGeneratedDate(): GDate | null {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, LAST_GEN_KEY))
    .get();
  return row?.value ? (row.value as GDate) : null;
}

function setLastGeneratedDate(date: GDate): void {
  const existing = db
    .select()
    .from(settings)
    .where(eq(settings.key, LAST_GEN_KEY))
    .get();
  if (existing) {
    db.update(settings)
      .set({ value: date, updatedAt: new Date() })
      .where(eq(settings.key, LAST_GEN_KEY))
      .run();
  } else {
    db.insert(settings).values({ key: LAST_GEN_KEY, value: date }).run();
  }
}

function setLastCloseDate(date: GDate): void {
  const existing = db
    .select()
    .from(settings)
    .where(eq(settings.key, LAST_PERIOD_CLOSE_KEY))
    .get();
  if (existing) {
    db.update(settings)
      .set({ value: date, updatedAt: new Date() })
      .where(eq(settings.key, LAST_PERIOD_CLOSE_KEY))
      .run();
  } else {
    db.insert(settings).values({ key: LAST_PERIOD_CLOSE_KEY, value: date }).run();
  }
}

export function resolveCatchupRange(today: GDate): { from: GDate; to: GDate } {
  const earliest = addGregorianDays(today, -(MAX_CATCHUP_DAYS - 1));
  const last = getLastGeneratedDate();
  if (!last) {
    return { from: earliest, to: today };
  }
  const next = addGregorianDays(last, 1);
  const from = compareGDate(next, earliest) < 0 ? earliest : next;
  if (compareGDate(from, today) > 0) {
    return { from: today, to: today };
  }
  return { from, to: today };
}

type DeptPath = {
  departmentId: number;
  assignDate: GDate;
  joinedAt: GDate | null;
};

type Assignee = {
  userId: number;
  hireDate: GDate | null;
  primaryDepartmentId: number | null;
  userAssignDate: GDate | null;
  deptPaths: DeptPath[];
};

function resolveAssignees(templateId: number): Assignee[] {
  const assignments = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .all();

  const map = new Map<number, Assignee>();

  const ensure = (userId: number, u: typeof users.$inferSelect) => {
    let a = map.get(userId);
    if (!a) {
      a = {
        userId,
        hireDate: u.hireDate,
        primaryDepartmentId: u.departmentId,
        userAssignDate: null,
        deptPaths: [],
      };
      map.set(userId, a);
    }
    return a;
  };

  for (const a of assignments) {
    const assignmentCreatedDate = tehranDateFromMs(
      a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : Number(a.createdAt),
    );

    if (a.assigneeType === "USER" && a.userId) {
      const u = db.select().from(users).where(eq(users.id, a.userId)).get();
      if (!u || !u.isActive || u.deletedAt) continue;
      const entry = ensure(u.id, u);
      entry.userAssignDate = entry.userAssignDate
        ? minGDate(entry.userAssignDate, assignmentCreatedDate)
        : assignmentCreatedDate;
    }

    if (a.assigneeType === "DEPARTMENT" && a.departmentId) {
      const members = activeMembersOfDepartment(a.departmentId);
      for (const member of members) {
        const entry = ensure(member.user.id, member.user);
        entry.deptPaths.push({
          departmentId: a.departmentId,
          assignDate: assignmentCreatedDate,
          joinedAt: member.joinedAt,
        });
      }
    }
  }

  return [...map.values()];
}

function assigneeEffectiveStart(
  templateStart: GDate,
  assignee: Assignee,
): GDate {
  const paths: Array<{
    templateStart: GDate;
    assignmentCreatedDate: GDate;
    hireDate?: GDate | null;
    departmentJoinedAt?: GDate | null;
  }> = [];

  if (assignee.userAssignDate) {
    paths.push({
      templateStart,
      assignmentCreatedDate: assignee.userAssignDate,
      hireDate: assignee.hireDate,
    });
  }
  for (const path of assignee.deptPaths) {
    paths.push({
      templateStart,
      assignmentCreatedDate: path.assignDate,
      hireDate: assignee.hireDate,
      departmentJoinedAt: path.joinedAt,
    });
  }
  if (paths.length === 0) {
    return templateStart;
  }
  return earliestEligibleStart(paths);
}

function templateInput(
  row: typeof taskTemplates.$inferSelect,
): RecurrenceTemplateInput {
  return {
    recurrenceType: row.recurrenceType,
    recurrenceConfig: (row.recurrenceConfig ?? {}) as RecurrenceConfig,
    startDate: row.startDate,
    endDate: row.endDate,
    skipHolidays: row.skipHolidays !== false,
  };
}

type InsertRow = {
  templateId: number;
  userId: number;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueAt: Date;
  status: "PENDING" | "EXCUSED";
  sourceDepartmentId: number;
};

function buildInsertsForUser(
  template: typeof taskTemplates.$inferSelect,
  assignee: Assignee,
  rangeFrom: GDate,
  rangeTo: GDate,
  holidaySet: Set<GDate>,
  leaves: Array<{ start: GDate; end: GDate }> | undefined,
): InsertRow[] {
  const effective = assigneeEffectiveStart(template.startDate, assignee);
  const from = maxGDate(effective, rangeFrom);
  if (compareGDate(from, rangeTo) > 0) return [];

  const sourceDepartmentId = resolveOccurrenceSource({
    paths: [
      ...(assignee.userAssignDate
        ? [{ kind: "direct" as const }]
        : []),
      ...assignee.deptPaths.map((path) => ({
        kind: "department" as const,
        departmentId: path.departmentId,
      })),
    ],
    primaryDepartmentId: assignee.primaryDepartmentId,
    memberships: assignee.deptPaths.map((path) => ({
      departmentId: path.departmentId,
      joinedAt: path.joinedAt,
    })),
  });
  if (sourceDepartmentId == null) return [];

  const periods = getOccurrencesInRange(
    templateInput(template),
    from,
    rangeTo,
    { holidays: holidaySet },
  );

  return periods.map((p) => ({
    templateId: template.id,
    userId: assignee.userId,
    periodKey: p.periodKey,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    dueAt: new Date(dueAtTehranMs(p.periodEnd, template.dueTime)),
    status: isOnLeave(leaves, p.periodStart, p.periodEnd)
      ? ("EXCUSED" as const)
      : ("PENDING" as const),
    sourceDepartmentId,
  }));
}

function insertBatch(rows: InsertRow[]): number {
  if (rows.length === 0) return 0;
  let inserted = 0;
  const chunkSize = 100;
  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const result = tx
        .insert(taskOccurrences)
        .values(chunk)
        .onConflictDoNothing()
        .run();
      inserted += result.changes;
    }
  });
  return inserted;
}

export function generateOccurrences(options?: {
  skipCursorUpdate?: boolean;
  userId?: number;
  templateId?: number;
  from?: GDate;
  to?: GDate;
}): GenerateResult {
  const today = todayTehran();

  let start: GDate;
  let end: GDate;

  if (options?.from || options?.to) {
    end = minGDate(options.to ?? today, today);
    start = options.from ?? addGregorianDays(end, -(MAX_CATCHUP_DAYS - 1));
    // سقف ۶۲ روز حتی با from دستی خیلی قدیمی
    const earliest = addGregorianDays(end, -(MAX_CATCHUP_DAYS - 1));
    if (compareGDate(start, earliest) < 0) start = earliest;
  } else if (options?.userId || options?.templateId) {
    end = today;
    start = addGregorianDays(today, -(MAX_CATCHUP_DAYS - 1));
  } else {
    const catchup = resolveCatchupRange(today);
    start = catchup.from;
    end = catchup.to;
  }

  if (compareGDate(start, end) > 0) {
    start = end;
  }

  const holidaySet = loadHolidaySet();
  let templates = db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.isActive, true))
    .all();
  if (options?.templateId) {
    templates = templates.filter((t) => t.id === options.templateId);
  }

  const allRows: InsertRow[] = [];
  const userIds = new Set<number>();

  for (const template of templates) {
    let assignees = resolveAssignees(template.id);
    if (options?.userId) {
      assignees = assignees.filter((a) => a.userId === options.userId);
    }
    for (const a of assignees) userIds.add(a.userId);
  }

  const leavesMap = loadLeavesForUsers([...userIds]);

  for (const template of templates) {
    let assignees = resolveAssignees(template.id);
    if (options?.userId) {
      assignees = assignees.filter((a) => a.userId === options.userId);
    }
    for (const assignee of assignees) {
      allRows.push(
        ...buildInsertsForUser(
          template,
          assignee,
          start,
          end,
          holidaySet,
          leavesMap.get(assignee.userId),
        ),
      );
    }
  }

  const inserted = insertBatch(allRows);
  syncPendingGroupClosures(templates.map((template) => template.id));

  if (
    !options?.skipCursorUpdate &&
    !options?.userId &&
    !options?.templateId
  ) {
    setLastGeneratedDate(today);
  }

  return {
    inserted,
    templates: templates.length,
    from: start,
    to: end,
  };
}

export function generateForTemplate(templateId: number): GenerateResult {
  return generateOccurrences({
    templateId,
    skipCursorUpdate: true,
  });
}

export function lazyGenerateForUser(userId: number): GenerateResult {
  return generateOccurrences({
    userId,
    skipCursorUpdate: true,
  });
}

export function closeMissedPeriods(): CloseResult {
  syncPendingGroupClosures();
  const today = todayTehran();
  const result = db
    .update(taskOccurrences)
    .set({
      status: "MISSED",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(taskOccurrences.status, "PENDING"),
        lt(taskOccurrences.periodEnd, today),
      ),
    )
    .run();

  setLastCloseDate(today);
  return { closed: result.changes, asOf: today };
}

export function removePendingOnUnassign(input: {
  templateId: number;
  userIds: number[];
}): number {
  if (input.userIds.length === 0) return 0;
  const today = todayTehran();
  const result = db
    .delete(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.templateId, input.templateId),
        inArray(taskOccurrences.userId, input.userIds),
        eq(taskOccurrences.status, "PENDING"),
        isNull(taskOccurrences.completedAt),
        isNull(taskOccurrences.note),
        sql`${taskOccurrences.periodEnd} >= ${today}`,
      ),
    )
    .run();
  return result.changes;
}

function sourceForUserTemplate(
  templateId: number,
  userId: number,
): number | null {
  const assignee = resolveAssignees(templateId).find(
    (row) => row.userId === userId,
  );
  if (!assignee) return null;
  return resolveOccurrenceSource({
    paths: [
      ...(assignee.userAssignDate ? [{ kind: "direct" as const }] : []),
      ...assignee.deptPaths.map((path) => ({
        kind: "department" as const,
        departmentId: path.departmentId,
      })),
    ],
    primaryDepartmentId: assignee.primaryDepartmentId,
    memberships: assignee.deptPaths.map((path) => ({
      departmentId: path.departmentId,
      joinedAt: path.joinedAt,
    })),
  });
}

/**
 * خروج از یک دپارتمان: PENDING بی‌پاسخ دوره جاری با منبع همان دپارتمان.
 * اگر مسیر دیگری هنوز کاربر را واجد شرایط کند، ردیف می‌ماند و منبع عوض می‌شود.
 */
export function removeDeptOnlyPendingOnTransfer(input: {
  userId: number;
  oldDepartmentId: number;
}): number {
  const today = todayTehran();
  const rows = db
    .select()
    .from(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.userId, input.userId),
        eq(taskOccurrences.sourceDepartmentId, input.oldDepartmentId),
        eq(taskOccurrences.status, "PENDING"),
        isNull(taskOccurrences.completedAt),
        isNull(taskOccurrences.note),
        sql`${taskOccurrences.periodEnd} >= ${today}`,
      ),
    )
    .all();

  let removed = 0;
  for (const row of rows) {
    const next = sourceForUserTemplate(row.templateId, input.userId);
    if (next != null && next !== input.oldDepartmentId) {
      db.update(taskOccurrences)
        .set({ sourceDepartmentId: next, updatedAt: new Date() })
        .where(eq(taskOccurrences.id, row.id))
        .run();
      continue;
    }
    db.delete(taskOccurrences)
      .where(eq(taskOccurrences.id, row.id))
      .run();
    removed += 1;
  }
  return removed;
}

export function onUserDepartmentChanged(input: {
  userId: number;
  oldDepartmentId: number | null;
  newDepartmentId: number | null;
}): { removed: number; generated: number } {
  const today = todayTehran();
  db.update(users)
    .set({
      departmentJoinedAt: input.newDepartmentId ? today : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId))
    .run();

  if (input.oldDepartmentId != null) {
    db.delete(userDepartments)
      .where(
        and(
          eq(userDepartments.userId, input.userId),
          eq(userDepartments.departmentId, input.oldDepartmentId),
        ),
      )
      .run();
  }
  if (input.newDepartmentId != null) {
    db.insert(userDepartments)
      .values({
        userId: input.userId,
        departmentId: input.newDepartmentId,
        joinedAt: today,
      })
      .onConflictDoNothing()
      .run();
  }

  let removed = 0;
  if (input.oldDepartmentId != null) {
    removed = removeDeptOnlyPendingOnTransfer({
      userId: input.userId,
      oldDepartmentId: input.oldDepartmentId,
    });
  }

  let generated = 0;
  if (input.newDepartmentId != null) {
    const templates = db
      .select({ templateId: taskAssignments.templateId })
      .from(taskAssignments)
      .where(
        and(
          eq(taskAssignments.assigneeType, "DEPARTMENT"),
          eq(taskAssignments.departmentId, input.newDepartmentId),
        ),
      )
      .all();
    for (const t of templates) {
      const r = generateOccurrences({
        templateId: t.templateId,
        userId: input.userId,
        from: today,
        to: today,
        skipCursorUpdate: true,
      });
      generated += r.inserted;
    }
  }

  return { removed, generated };
}

export function excuseOccurrencesInRange(input: {
  userId: number;
  startDate: GDate;
  endDate: GDate;
  reason: string;
  sourceDepartmentIds?: number[];
}): number {
  if (input.sourceDepartmentIds && input.sourceDepartmentIds.length === 0) {
    return 0;
  }
  const result = db
    .update(taskOccurrences)
    .set({
      status: "EXCUSED",
      note: input.reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(taskOccurrences.userId, input.userId),
        eq(taskOccurrences.status, "PENDING"),
        sql`${taskOccurrences.periodStart} <= ${input.endDate}`,
        sql`${taskOccurrences.periodEnd} >= ${input.startDate}`,
        input.sourceDepartmentIds
          ? inArray(taskOccurrences.sourceDepartmentId, input.sourceDepartmentIds)
          : undefined,
      ),
    )
    .run();
  return result.changes;
}

export function readLastGeneratedDate(): GDate | null {
  return getLastGeneratedDate();
}

export function writeLastGeneratedDate(date: GDate): void {
  setLastGeneratedDate(date);
}
