import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  holidays,
  notificationDeliveries,
  notifications,
  staffLeaves,
  taskAssignments,
  taskOccurrences,
  taskTemplates,
  userDepartments,
  users,
  type NotificationType,
} from "@/db/schema";
import { activeMembersOfDepartment } from "@/lib/departments/membership";
import { classifyOccurrence } from "@/lib/reports/classify";
import { ratesFromCounts, type StatusCounts } from "@/lib/reports/rates";
import {
  compareGDate,
  tehranDateFromMs,
  type GDate,
} from "@/lib/dates";
import { enqueuePush } from "@/lib/push/queue";
import { requestSocketNotify } from "@/lib/realtime/notify";
import { isTaskVisibleAt } from "@/lib/tasks/start-time";
import { safeInternalPath } from "./store";
import { loadTaskNotifySettings } from "./task-settings";
import {
  ASSIGNED_WINDOW_MS,
  DIGEST_LATE_MS,
  assignedCopy,
  clockReached,
  digestCopy,
  digestDecision,
  dueSoonCopy,
  dueSoonDecision,
  isDailyPeriod,
  isOpenPeriod,
  overdueCopy,
  overdueDecision,
  quietPushMode,
  summaryCopy,
} from "./task-rules";

type Row = {
  occurrenceId: number;
  userId: number;
  fullName: string;
  status: string;
  periodKey: string;
  periodStart: GDate;
  periodEnd: GDate;
  dueAt: number | null;
  sourceDepartmentId: number;
  templateId: number;
  title: string;
  dueTime: string | null;
  completionMode: string;
  startDate: GDate;
};

export type TaskNoticePlan = {
  willSend: boolean;
  reason: string;
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  dedupeKey: string | null;
  groupKey: string | null;
  entityId: number | null;
};

function isUnique(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code: string }).code).includes("SQLITE_CONSTRAINT")
  );
}

function assigneeIds(userIds: number[], departmentIds: number[]): number[] {
  const ids = new Set<number>(userIds);
  for (const departmentId of departmentIds) {
    for (const member of activeMembersOfDepartment(departmentId)) {
      if (member.user.isActive && !member.user.deletedAt) ids.add(member.user.id);
    }
  }
  return [...ids];
}

export function notifyTemplateAssignees(templateId: number, onlyUserIds?: number[]): void {
  const template = db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.id, templateId))
    .get();
  if (!template || !template.isActive) return;
  const today = tehranDateFromMs(Date.now());
  if (template.endDate && compareGDate(template.endDate, today) < 0) return;
  const assignments = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .all();
  const usersWanted = assigneeIds(
    assignments.filter((row) => row.assigneeType === "USER" && row.userId).map((row) => row.userId!),
    assignments
      .filter((row) => row.assigneeType === "DEPARTMENT" && row.departmentId)
      .map((row) => row.departmentId!),
  );
  const targets = onlyUserIds
    ? usersWanted.filter((id) => onlyUserIds.includes(id))
    : usersWanted;
  for (const userId of targets) {
    recordTaskAssigned({
      userId,
      title: template.title,
      startDate: template.startDate,
      now: Date.now(),
    });
  }
}

export function notifyDepartmentJoin(userId: number, departmentIds: number[]): void {
  if (departmentIds.length === 0) return;
  const today = tehranDateFromMs(Date.now());
  const rows = db
    .select({
      templateId: taskTemplates.id,
      title: taskTemplates.title,
      startDate: taskTemplates.startDate,
      endDate: taskTemplates.endDate,
      isActive: taskTemplates.isActive,
    })
    .from(taskAssignments)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.templateId))
    .where(
      and(
        eq(taskAssignments.assigneeType, "DEPARTMENT"),
        inArray(taskAssignments.departmentId, departmentIds),
      ),
    )
    .all();
  for (const row of rows) {
    if (!row.isActive) continue;
    if (row.endDate && compareGDate(row.endDate, today) < 0) continue;
    recordTaskAssigned({
      userId,
      title: row.title,
      startDate: row.startDate,
      now: Date.now(),
    });
  }
}

export function recordTaskAssigned(input: {
  userId: number;
  title: string;
  startDate: GDate;
  now?: number;
}): number | null {
  const now = input.now ?? Date.now();
  const today = tehranDateFromMs(now);
  const key = `task.assigned:${input.userId}`;
  const existing = db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, input.userId), eq(notifications.dedupeKey, key)))
    .get();
  if (existing && now - existing.createdAt.getTime() < ASSIGNED_WINDOW_MS) {
    const count = existing.bundleCount + 1;
    const copy = assignedCopy({ count, title: input.title, startDate: input.startDate, today });
    db.update(notifications)
      .set({ title: copy.title, body: copy.body, bundleCount: count, url: "/me" })
      .where(eq(notifications.id, existing.id))
      .run();
    const pending = db
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.notificationId, existing.id),
          eq(notificationDeliveries.channel, "PUSH"),
          eq(notificationDeliveries.status, "PENDING"),
        ),
      )
      .get();
    if (!pending) {
      enqueuePush({
        notificationId: existing.id,
        userId: input.userId,
        type: "task.assigned",
        priority: "NORMAL",
        now,
        whenQuiet: "skip",
      });
    }
    return existing.id;
  }
  if (existing) {
    db.update(notifications)
      .set({ dedupeKey: null })
      .where(eq(notifications.id, existing.id))
      .run();
  }
  const copy = assignedCopy({ count: 1, title: input.title, startDate: input.startDate, today });
  return insertNotice({
    userId: input.userId,
    type: "task.assigned",
    title: copy.title,
    body: copy.body,
    url: "/me",
    dedupeKey: key,
    groupKey: key,
    entityId: null,
    now,
  });
}

function loadRows(today: GDate, now = Date.now()): Row[] {
  return db
    .select({
      occurrenceId: taskOccurrences.id,
      userId: taskOccurrences.userId,
      fullName: users.fullName,
      status: taskOccurrences.status,
      periodKey: taskOccurrences.periodKey,
      periodStart: taskOccurrences.periodStart,
      periodEnd: taskOccurrences.periodEnd,
      dueAt: taskOccurrences.dueAt,
      sourceDepartmentId: taskOccurrences.sourceDepartmentId,
      templateId: taskOccurrences.templateId,
      title: taskTemplates.title,
      dueTime: taskTemplates.dueTime,
      startTime: taskTemplates.startTime,
      completionMode: taskTemplates.completionMode,
      startDate: taskTemplates.startDate,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.templateId))
    .innerJoin(users, eq(users.id, taskOccurrences.userId))
    .where(
      and(
        lte(taskOccurrences.periodStart, today),
        gte(taskOccurrences.periodEnd, today),
        eq(users.isActive, true),
        isNull(users.deletedAt),
        eq(taskTemplates.isActive, true),
      ),
    )
    .all()
    .filter((row) => isTaskVisibleAt(row.startTime, now))
    .map((row) => ({
      occurrenceId: row.occurrenceId,
      userId: row.userId,
      fullName: row.fullName,
      status: row.status,
      periodKey: row.periodKey,
      periodStart: row.periodStart as GDate,
      periodEnd: row.periodEnd as GDate,
      dueAt: row.dueAt ? row.dueAt.getTime() : null,
      sourceDepartmentId: row.sourceDepartmentId,
      templateId: row.templateId,
      title: row.title,
      dueTime: row.dueTime,
      completionMode: row.completionMode,
      startDate: row.startDate as GDate,
    }));
}

function onLeaveIds(today: GDate): Set<number> {
  const rows = db.select().from(staffLeaves).all();
  const ids = new Set<number>();
  for (const row of rows) {
    if (compareGDate(today, row.startDate as GDate) >= 0 && compareGDate(today, row.endDate as GDate) <= 0) {
      ids.add(row.userId);
    }
  }
  return ids;
}

function isHoliday(today: GDate): boolean {
  return Boolean(db.select({ id: holidays.id }).from(holidays).where(eq(holidays.date, today)).get());
}

function sharedBlocked(row: Row, rows: Row[]): boolean {
  if (row.completionMode !== "SHARED") return false;
  return rows.some(
    (other) =>
      other.occurrenceId !== row.occurrenceId &&
      other.templateId === row.templateId &&
      other.periodKey === row.periodKey &&
      other.sourceDepartmentId === row.sourceDepartmentId &&
      (other.status === "DONE" || other.status === "DONE_LATE"),
  );
}

function countsFor(rows: Row[], onLeave: boolean, holiday: boolean) {
  let todayCount = 0;
  let openCount = 0;
  for (const row of rows) {
    if (row.status !== "PENDING") continue;
    if (isDailyPeriod(row.periodKey)) {
      if (onLeave || holiday) continue;
      todayCount += 1;
    } else if (isOpenPeriod(row.periodKey) && !onLeave) {
      openCount += 1;
    }
  }
  return { todayCount, openCount };
}

function plansForUser(input: {
  userId: number;
  rows: Row[];
  allRows: Row[];
  today: GDate;
  now: number;
  onLeave: boolean;
  holiday: boolean;
  settings: ReturnType<typeof loadTaskNotifySettings>;
  types: NotificationType[];
}): TaskNoticePlan[] {
  const mine = input.rows.filter((row) => row.userId === input.userId);
  const plans: TaskNoticePlan[] = [];
  if (input.types.includes("task.daily_digest")) {
    const timing = clockReached(input.now, input.today, input.settings.digestTime, DIGEST_LATE_MS);
    const counts = countsFor(mine, input.onLeave, input.holiday);
    const decision = digestDecision({
      onLeave: input.onLeave,
      todayCount: counts.todayCount,
      openCount: counts.openCount,
      timing,
    });
    const copy = digestCopy(counts.todayCount, counts.openCount);
    plans.push({
      willSend: decision.send,
      reason: decision.send ? "ارسال می‌شود" : decision.reason,
      userId: input.userId,
      type: "task.daily_digest",
      title: copy.title,
      body: copy.body,
      url: "/me",
      dedupeKey: `task.daily_digest:${input.userId}:${input.today}`,
      groupKey: `digest:${input.today}`,
      entityId: null,
    });
  }
  for (const type of ["task.due_soon", "task.overdue"] as const) {
    if (!input.types.includes(type)) continue;
    const matches = mine.filter((row) => {
      const blocked = sharedBlocked(row, input.allRows);
      const decision =
        type === "task.due_soon"
          ? dueSoonDecision({
              dueTime: row.dueTime,
              status: row.status,
              dueAt: row.dueAt,
              now: input.now,
              leadMinutes: input.settings.dueSoonMinutes,
              sharedBlocked: blocked,
            })
          : overdueDecision({
              dueTime: row.dueTime,
              status: row.status,
              dueAt: row.dueAt,
              now: input.now,
              afterMinutes: input.settings.overdueAfterMinutes,
              sharedBlocked: blocked,
            });
      return decision.send;
    });
    if (matches.length === 0) {
      const sample = mine[0];
      const blocked = sample ? sharedBlocked(sample, input.allRows) : false;
      const decision =
        type === "task.due_soon"
          ? dueSoonDecision({
              dueTime: sample?.dueTime ?? null,
              status: sample?.status ?? "PENDING",
              dueAt: sample?.dueAt ?? null,
              now: input.now,
              leadMinutes: input.settings.dueSoonMinutes,
              sharedBlocked: blocked,
            })
          : overdueDecision({
              dueTime: sample?.dueTime ?? null,
              status: sample?.status ?? "PENDING",
              dueAt: sample?.dueAt ?? null,
              now: input.now,
              afterMinutes: input.settings.overdueAfterMinutes,
              sharedBlocked: blocked,
            });
      plans.push({
        willSend: false,
        reason: sample ? (decision.send ? "موردی نیست" : decision.reason) : "کاری برای امروز نیست",
        userId: input.userId,
        type,
        title: "",
        body: "",
        url: null,
        dedupeKey: null,
        groupKey: null,
        entityId: null,
      });
      continue;
    }
    for (const row of matches) {
      const copy =
        type === "task.due_soon"
          ? dueSoonCopy(row.title, input.settings.dueSoonMinutes)
          : overdueCopy(row.title);
      plans.push({
        willSend: true,
        reason: "ارسال می‌شود",
        userId: input.userId,
        type,
        title: copy.title,
        body: copy.body,
        url: `/me?focus=${row.occurrenceId}`,
        dedupeKey: `${type}:${input.userId}:${row.occurrenceId}`,
        groupKey: type === "task.due_soon" ? `due_soon:${row.occurrenceId}` : `overdue:${row.occurrenceId}`,
        entityId: row.occurrenceId,
      });
    }
  }
  return plans;
}

function summaryPlan(input: {
  userId: number;
  role: "ADMIN" | "MANAGER";
  departmentIds: number[];
  rows: Row[];
  today: GDate;
  now: number;
  settings: ReturnType<typeof loadTaskNotifySettings>;
}): TaskNoticePlan {
  const timing = clockReached(input.now, input.today, input.settings.summaryTime, null);
  const scoped =
    input.role === "ADMIN"
      ? input.rows
      : input.rows.filter((row) => input.departmentIds.includes(row.sourceDepartmentId));
  const active = scoped.filter((row) => row.status !== "EXCUSED" && row.status !== "DONE_BY_PEER");
  const base = {
    userId: input.userId,
    type: "task.manager_summary" as const,
    dedupeKey: `task.manager_summary:${input.userId}:${input.today}`,
    groupKey: `summary:${input.today}`,
    entityId: null,
    url:
      input.departmentIds.length === 1
        ? `/admin/board?date=${input.today}&departmentId=${input.departmentIds[0]}`
        : `/admin/board?date=${input.today}`,
  };
  if (timing === "wait") {
    return { ...base, willSend: false, reason: "هنوز ساعت خلاصهٔ مدیر نرسیده", title: "", body: "" };
  }
  if (timing === "late") {
    return { ...base, willSend: false, reason: "خلاصهٔ مدیر برای امروز دیگر ارسال نمی‌شود", title: "", body: "" };
  }
  if (active.length === 0) {
    return { ...base, willSend: false, reason: "امروز کار فعالی در محدوده نیست", title: "", body: "" };
  }
  const counts: StatusCounts = {};
  for (const row of scoped) {
    const kind = classifyOccurrence(
      {
        status: row.status,
        dueAtMs: row.dueAt,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        periodKey: row.periodKey,
        userId: row.userId,
        completedByUserId: null,
      },
      { nowMs: input.now, from: input.today, to: input.today, today: input.today },
    );
    if (kind.kind === "counted") counts[kind.status] = (counts[kind.status] ?? 0) + 1;
    else if (kind.kind === "in_progress") counts.PENDING = (counts.PENDING ?? 0) + 1;
  }
  const rates = ratesFromCounts(counts);
  const byUser = new Map<number, { name: string; responded: boolean; pending: number }>();
  for (const row of active) {
    const current = byUser.get(row.userId) ?? { name: row.fullName, responded: false, pending: 0 };
    if (row.status === "PENDING") current.pending += 1;
    else current.responded = true;
    byUser.set(row.userId, current);
  }
  const silent = [...byUser.values()].filter((person) => !person.responded && person.pending > 0);
  const copy = summaryCopy({
    rate: rates.completionRate,
    unanswered: active.filter((row) => row.status === "PENDING").length,
    names: silent.map((person) => person.name),
  });
  return { ...base, willSend: true, reason: "ارسال می‌شود", title: copy.title, body: copy.body };
}

function managerDepartmentIds(userId: number): number[] {
  return db
    .select({ departmentId: userDepartments.departmentId })
    .from(userDepartments)
    .where(and(eq(userDepartments.userId, userId), isNull(userDepartments.leftAt)))
    .all()
    .map((row) => row.departmentId);
}

export function commitAssignedForUser(userId: number, now = Date.now()): number {
  const rows = db
    .select({ title: taskTemplates.title, startDate: taskTemplates.startDate, isActive: taskTemplates.isActive, endDate: taskTemplates.endDate })
    .from(taskAssignments)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.templateId))
    .where(and(eq(taskAssignments.assigneeType, "USER"), eq(taskAssignments.userId, userId), eq(taskTemplates.isActive, true)))
    .all();
  const today = tehranDateFromMs(now);
  let n = 0;
  for (const row of rows) {
    if (row.endDate && compareGDate(row.endDate, today) < 0) continue;
    recordTaskAssigned({ userId, title: row.title, startDate: row.startDate as GDate, now });
    n += 1;
  }
  return n;
}

export function previewTaskNotices(input: {
  type: NotificationType;
  userId: number;
  now?: number;
}): TaskNoticePlan[] {
  const now = input.now ?? Date.now();
  const today = tehranDateFromMs(now);
  const settings = loadTaskNotifySettings();
  const rows = loadRows(today, now);
  const person = db
    .select({ role: users.role, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, input.userId))
    .get();
  if (!person) {
    return [
      {
        willSend: false,
        reason: "کاربر پیدا نشد",
        userId: input.userId,
        type: input.type,
        title: "",
        body: "",
        url: null,
        dedupeKey: null,
        groupKey: null,
        entityId: null,
      },
    ];
  }
  if (input.type === "task.manager_summary") {
    if (person.role !== "ADMIN" && person.role !== "MANAGER") {
      return [
        {
          willSend: false,
          reason: "این نوع فقط برای مدیر و سرپرست است",
          userId: input.userId,
          type: input.type,
          title: "",
          body: "",
          url: null,
          dedupeKey: null,
          groupKey: null,
          entityId: null,
        },
      ];
    }
    return [
      summaryPlan({
        userId: input.userId,
        role: person.role,
        departmentIds: person.role === "ADMIN" ? [] : managerDepartmentIds(input.userId),
        rows,
        today,
        now,
        settings,
      }),
    ];
  }
  if (input.type === "task.assigned") {
    const templates = db
      .select({ title: taskTemplates.title, startDate: taskTemplates.startDate })
      .from(taskAssignments)
      .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.templateId))
      .where(and(eq(taskAssignments.assigneeType, "USER"), eq(taskAssignments.userId, input.userId)))
      .all();
    if (templates.length === 0) {
      return [
        {
          willSend: false,
          reason: "کار مستقیمی برای این کاربر نیست؛ اعلان هنگام اختصاص ساخته می‌شود",
          userId: input.userId,
          type: input.type,
          title: "",
          body: "",
          url: null,
          dedupeKey: null,
          groupKey: null,
          entityId: null,
        },
      ];
    }
    const copy = assignedCopy({
      count: templates.length,
      title: templates[0]!.title,
      startDate: templates[0]!.startDate as GDate,
      today,
    });
    return [
      {
        willSend: true,
        reason: "با ارسال واقعی، در پنجرهٔ دو دقیقه با اساین‌های بعدی جمع می‌شود",
        userId: input.userId,
        type: input.type,
        title: copy.title,
        body: copy.body,
        url: "/me",
        dedupeKey: `task.assigned:${input.userId}`,
        groupKey: `task.assigned:${input.userId}`,
        entityId: null,
      },
    ];
  }
  const holiday = isHoliday(today);
  const leave = onLeaveIds(today).has(input.userId);
  return plansForUser({
    userId: input.userId,
    rows,
    allRows: rows,
    today,
    now,
    onLeave: leave,
    holiday,
    settings,
    types: [input.type],
  });
}

function insertNotice(input: {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  dedupeKey: string;
  groupKey: string;
  entityId: number | null;
  now: number;
}): number | null {
  const existing = db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, input.userId), eq(notifications.dedupeKey, input.dedupeKey)))
    .get();
  if (existing) return existing.id;
  try {
    const url = safeInternalPath(input.url);
    const inserted = db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 4000),
        url,
        entityType: input.entityId ? "occurrence" : null,
        entityId: input.entityId,
        groupKey: input.groupKey,
        dedupeKey: input.dedupeKey,
        priority: "NORMAL",
        createdAt: new Date(input.now),
      })
      .returning({ id: notifications.id })
      .get();
    db.insert(notificationDeliveries)
      .values({
        notificationId: inserted.id,
        channel: "IN_APP",
        status: "SENT",
        attempts: 1,
        sentAt: new Date(input.now),
      })
      .run();
    enqueuePush({
      notificationId: inserted.id,
      userId: input.userId,
      type: input.type,
      priority: "NORMAL",
      now: input.now,
      whenQuiet: quietPushMode(input.type),
    });
    requestSocketNotify(input.userId, {
      id: inserted.id,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 180),
      url,
      priority: "NORMAL",
      createdAt: input.now,
    });
    return inserted.id;
  } catch (error) {
    if (!isUnique(error)) throw error;
    return (
      db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.userId, input.userId), eq(notifications.dedupeKey, input.dedupeKey)))
        .get()?.id ?? null
    );
  }
}

export function commitTaskNotices(plans: TaskNoticePlan[], now = Date.now()): number {
  let sent = 0;
  for (const plan of plans) {
    if (!plan.willSend || !plan.dedupeKey || !plan.groupKey) continue;
    const before = db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, plan.userId), eq(notifications.dedupeKey, plan.dedupeKey)))
      .get();
    insertNotice({ ...plan, dedupeKey: plan.dedupeKey, groupKey: plan.groupKey, now });
    if (!before) sent += 1;
  }
  return sent;
}

export function runTaskNotificationJob(now = Date.now()): number {
  const today = tehranDateFromMs(now);
  const settings = loadTaskNotifySettings();
  const rows = loadRows(today, now);
  const holiday = isHoliday(today);
  const leaves = onLeaveIds(today);
  const userIds = [...new Set(rows.map((row) => row.userId))];
  let sent = 0;
  for (const userId of userIds) {
    const plans = plansForUser({
      userId,
      rows,
      allRows: rows,
      today,
      now,
      onLeave: leaves.has(userId),
      holiday,
      settings,
      types: ["task.daily_digest", "task.due_soon", "task.overdue"],
    });
    sent += commitTaskNotices(plans, now);
  }
  const managers = db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(inArray(users.role, ["ADMIN", "MANAGER"]), eq(users.isActive, true), isNull(users.deletedAt)))
    .all();
  for (const manager of managers) {
    if (manager.role !== "ADMIN" && manager.role !== "MANAGER") continue;
    const plan = summaryPlan({
      userId: manager.id,
      role: manager.role,
      departmentIds: manager.role === "ADMIN" ? [] : managerDepartmentIds(manager.id),
      rows,
      today,
      now,
      settings,
    });
    sent += commitTaskNotices([plan], now);
  }
  return sent;
}

export function coveredAssigneeIds(userIds: number[], departmentIds: number[]): number[] {
  return assigneeIds(userIds, departmentIds);
}
