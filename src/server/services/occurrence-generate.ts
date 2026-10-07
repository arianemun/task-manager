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
import {
  activeMembersOfDepartment,
  closeDepartmentMembership,
  openDepartmentMembership,
  periodInsideMembership,
  type MembershipInterval,
} from "@/lib/departments/membership";
import {
  effectiveOccurrenceStart,
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
  intervals: MembershipInterval[];
};

type Assignee = {
  userId: number;
  hireDate: GDate | null;
  primaryDepartmentId: number | null;
  userAssignDate: GDate | null;
  deptPaths: DeptPath[];
};

function membershipIntervals(): Map<string, MembershipInterval[]> {
  const map = new Map<string, MembershipInterval[]>();
  const rows = db
    .select({
      userId: userDepartments.userId,
      departmentId: userDepartments.departmentId,
      joinedAt: userDepartments.joinedAt,
      leftAt: userDepartments.leftAt,
    })
    .from(userDepartments)
    .all();
  for (const row of rows) {
    const key = `${row.userId}:${row.departmentId}`;
    const list = map.get(key) ?? [];
    list.push({
      joinedAt: row.joinedAt as GDate,
      leftAt: (row.leftAt as GDate | null) ?? null,
    });
    map.set(key, list);
  }
  return map;
}

function resolveAssignees(templateId: number): Assignee[] {
  const assignments = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .all();
  const intervals = membershipIntervals();

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
        const departmentId = a.departmentId;
        const stored = intervals.get(`${member.user.id}:${departmentId}`);
        const pathIntervals =
          stored && stored.length > 0
            ? stored
            : [{ joinedAt: member.joinedAt, leftAt: null }];
        const existing = entry.deptPaths.find(
          (path) => path.departmentId === departmentId,
        );
        if (existing) {
          existing.assignDate = minGDate(
            existing.assignDate,
            assignmentCreatedDate,
          );
          continue;
        }
        entry.deptPaths.push({
          departmentId,
          assignDate: assignmentCreatedDate,
          joinedAt: member.joinedAt,
          intervals: pathIntervals,
        });
      }
    }
  }

  return [...map.values()];
}

function directEligibleStart(
  templateStart: GDate,
  assignee: Assignee,
): GDate | null {
  if (!assignee.userAssignDate) return null;
  return effectiveOccurrenceStart({
    templateStart,
    assignmentCreatedDate: assignee.userAssignDate,
    hireDate: assignee.hireDate,
  });
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
  const directStart = directEligibleStart(template.startDate, assignee);
  const floors: GDate[] = [];
  if (directStart) floors.push(directStart);
  for (const path of assignee.deptPaths) {
    for (const interval of path.intervals) {
      floors.push(
        effectiveOccurrenceStart({
          templateStart: template.startDate,
          assignmentCreatedDate: path.assignDate,
          hireDate: assignee.hireDate,
          departmentJoinedAt: interval.joinedAt,
        }),
      );
    }
  }
  if (floors.length === 0) return [];
  const from = maxGDate(minGDate(...floors), rangeFrom);
  if (compareGDate(from, rangeTo) > 0) return [];

  const periods = getOccurrencesInRange(
    templateInput(template),
    from,
    rangeTo,
    { holidays: holidaySet },
  );

  const rows: InsertRow[] = [];
  for (const period of periods) {
    const directOk =
      directStart != null &&
      compareGDate(period.periodStart, directStart) >= 0;
    const departmentPaths = assignee.deptPaths.flatMap((path) => {
      const interval = path.intervals.find((item) =>
        periodInsideMembership(period.periodStart, item),
      );
      if (!interval) return [];
      const start = effectiveOccurrenceStart({
        templateStart: template.startDate,
        assignmentCreatedDate: path.assignDate,
        hireDate: assignee.hireDate,
        departmentJoinedAt: interval.joinedAt,
      });
      if (compareGDate(period.periodStart, start) < 0) return [];
      return [
        {
          departmentId: path.departmentId,
          joinedAt: interval.joinedAt,
        },
      ];
    });
    if (!directOk && departmentPaths.length === 0) continue;

    const sourceDepartmentId = resolveOccurrenceSource({
      paths: [
        ...(directOk ? [{ kind: "direct" as const }] : []),
        ...departmentPaths.map((path) => ({
          kind: "department" as const,
          departmentId: path.departmentId,
        })),
      ],
      primaryDepartmentId: assignee.primaryDepartmentId,
      memberships: departmentPaths,
    });
    if (sourceDepartmentId == null) continue;

    rows.push({
      templateId: template.id,
      userId: assignee.userId,
      periodKey: period.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueAt: new Date(dueAtTehranMs(period.periodEnd, template.dueTime)),
      status: isOnLeave(leaves, period.periodStart, period.periodEnd)
        ? ("EXCUSED" as const)
        : ("PENDING" as const),
      sourceDepartmentId,
    });
  }
  return rows;
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
  const person = db
    .select({
      departmentJoinedAt: users.departmentJoinedAt,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .get();
  const membershipCount =
    db
      .select({ id: userDepartments.id })
      .from(userDepartments)
      .where(eq(userDepartments.userId, input.userId))
      .all().length;

  db.update(users)
    .set({
      departmentJoinedAt: input.newDepartmentId ? today : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId))
    .run();

  if (input.oldDepartmentId != null) {
    closeDepartmentMembership({
      userId: input.userId,
      departmentId: input.oldDepartmentId,
      leftAt: today,
      legacyJoinedAt:
        membershipCount === 0
          ? ((person?.departmentJoinedAt ?? today) as GDate)
          : null,
    });
  }
  if (input.newDepartmentId != null) {
    openDepartmentMembership({
      userId: input.userId,
      departmentId: input.newDepartmentId,
      joinedAt: today,
    });
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
