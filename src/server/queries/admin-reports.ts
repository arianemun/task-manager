import { and, asc, count, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  taskOccurrences,
  taskTemplates,
  users,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth/user";
import { reasonLabelMap } from "@/lib/settings/not-done-reasons";
import { departmentNamesForUser } from "@/lib/departments/membership";
import { occurrenceSourceScope } from "@/lib/scope/occurrences";
import { rateStatusSql } from "@/lib/reports/rate-sql";
import { openPeriodCounts } from "@/server/queries/report-core";
import {
  addGregorianDays,
  jalaliWeekday,
  todayTehran,
  type GDate,
} from "@/lib/dates";
import {
  averageCompletion,
  bucketDayAggregates,
  computeStreaks,
  parseReportFilters,
  mergeStatusCounts,
  ratesFromCounts,
  sharedPeriodsRate,
  type ReportFilters,
  type StatusCounts,
  type StreakDay,
} from "@/lib/reports";
import { scopeUsersQuery } from "@/lib/scope/users";

const STATUS_COLS = [
  "PENDING",
  "DONE",
  "DONE_LATE",
  "NOT_DONE",
  "MISSED",
  "EXCUSED",
  "OVERDUE",
  "DONE_BY_PEER",
] as const;

function scopedUserIds(actor: AuthUser, filters: ReportFilters): number[] | null {
  // null = بدون محدودیت کاربر (فقط ADMIN با view_all)
  const conditions: SQL[] = [];
  const scope = scopeUsersQuery(actor);
  if (scope) conditions.push(scope);

  if (filters.userId) {
    conditions.push(eq(users.id, filters.userId));
  }

  if (conditions.length === 0 && actor.role === "ADMIN") {
    return null; // همه
  }

  const rows = db
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions))
    .all();
  return rows.map((r) => r.id);
}

function baseOccurrenceWhere(
  actor: AuthUser,
  filters: ReportFilters,
  options?: { personalCreditOnly?: boolean; period?: boolean },
): { clauses: SQL[]; userIds: number[] | null } {
  const userIds = scopedUserIds(actor, filters);
  const clauses: SQL[] = [];
  if (options?.period !== false) {
    clauses.push(
      sql`${taskOccurrences.periodEnd} >= ${filters.from}`,
      sql`${taskOccurrences.periodEnd} <= ${filters.to}`,
    );
  }
  if (userIds) {
    if (userIds.length === 0) {
      clauses.push(sql`1 = 0`);
    } else {
      clauses.push(inArray(taskOccurrences.userId, userIds));
    }
  }
  if (filters.categoryId) {
    clauses.push(eq(taskTemplates.categoryId, filters.categoryId));
  }
  if (filters.recurrenceType) {
    clauses.push(eq(taskTemplates.recurrenceType, filters.recurrenceType));
  }
  if (filters.priority) {
    clauses.push(eq(taskTemplates.priority, filters.priority));
  }
  const sourceScope = occurrenceSourceScope(actor, filters.departmentId);
  if (sourceScope) clauses.push(sourceScope);
  return { clauses, userIds };
}

function pivotStatusRows(
  rows: Array<{ day?: string; status: string; c: number; [k: string]: unknown }>,
  keyField: string,
): Map<string, StatusCounts & { key: string }> {
  const map = new Map<string, StatusCounts & { key: string }>();
  for (const r of rows) {
    const key = String(r[keyField] ?? r.day);
    const cur = map.get(key) ?? { key };
    const st = r.status as keyof StatusCounts;
    cur[st] = (cur[st] ?? 0) + Number(r.c);
    map.set(key, cur);
  }
  return map;
}

/** تجمیع روزانه بر اساس period_end */
export function aggregateByDay(actor: AuthUser, filters: ReportFilters) {
  const { clauses } = baseOccurrenceWhere(actor, filters);
  const statusExpr = rateStatusSql(Date.now());
  const rows = db
    .select({
      day: taskOccurrences.periodEnd,
      status: statusExpr,
      c: count(),
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(and(...clauses))
    .groupBy(taskOccurrences.periodEnd, statusExpr)
    .all();

  const byDay = pivotStatusRows(rows, "day");
  const dayAggs = [...byDay.values()].map((v) => ({
    day: v.key as GDate,
    PENDING: v.PENDING,
    DONE: v.DONE,
    DONE_LATE: v.DONE_LATE,
    NOT_DONE: v.NOT_DONE,
    MISSED: v.MISSED,
    EXCUSED: v.EXCUSED,
    OVERDUE: v.OVERDUE,
    DONE_BY_PEER: v.DONE_BY_PEER,
  }));

  const buckets = bucketDayAggregates(dayAggs, filters.granularity);
  return {
    dayAggs,
    buckets,
    average: averageCompletion(buckets),
    totals: ratesFromCounts(
      dayAggs.reduce(
        (acc, d) => {
          for (const s of STATUS_COLS) {
            acc[s] = (acc[s] ?? 0) + (d[s] ?? 0);
          }
          return acc;
        },
        {} as StatusCounts,
      ),
    ),
  };
}

export function aggregateStatusDonut(actor: AuthUser, filters: ReportFilters) {
  const { clauses } = baseOccurrenceWhere(actor, filters);
  const statusExpr = rateStatusSql(Date.now());
  const rows = db
    .select({
      status: statusExpr,
      c: count(),
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(and(...clauses))
    .groupBy(statusExpr)
    .all();

  const counts: StatusCounts = {};
  for (const r of rows) {
    counts[r.status as keyof StatusCounts] = Number(r.c);
  }
  const { clauses: openClauses } = baseOccurrenceWhere(actor, filters, {
    period: false,
  });
  const open = openPeriodCounts(openClauses, filters.from, filters.to);
  const merged = mergeStatusCounts(counts, open.counts);
  return { counts: merged, rates: ratesFromCounts(merged) };
}

export function aggregateByStaff(actor: AuthUser, filters: ReportFilters) {
  const { clauses } = baseOccurrenceWhere(actor, filters);
  const statusExpr = rateStatusSql(Date.now());
  const rows = db
    .select({
      userId: taskOccurrences.userId,
      fullName: users.fullName,
      departmentId: users.departmentId,
      departmentName: departments.name,
      status: statusExpr,
      c: count(),
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .innerJoin(users, eq(taskOccurrences.userId, users.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(...clauses))
    .groupBy(
      taskOccurrences.userId,
      users.fullName,
      users.departmentId,
      departments.name,
      statusExpr,
    )
    .all();

  const map = new Map<
    number,
    {
      userId: number;
      fullName: string;
      departmentName: string | null;
      counts: StatusCounts;
    }
  >();

  for (const r of rows) {
    const cur = map.get(r.userId) ?? {
      userId: r.userId,
      fullName: r.fullName,
      departmentName:
        departmentNamesForUser(r.userId) || r.departmentName,
      counts: {},
    };
    cur.counts[r.status as keyof StatusCounts] =
      (cur.counts[r.status as keyof StatusCounts] ?? 0) + Number(r.c);
    map.set(r.userId, cur);
  }

  const { clauses: openClauses } = baseOccurrenceWhere(actor, filters, {
    period: false,
  });
  const open = openPeriodCounts(openClauses, filters.from, filters.to);
  for (const [userId, extra] of open.byUser) {
    const cur = map.get(userId);
    if (!cur) continue;
    cur.counts = mergeStatusCounts(cur.counts, extra);
  }

  const list = [...map.values()].map((u) => {
    const rates = ratesFromCounts(u.counts);
    return {
      ...u,
      ...rates,
      bestStreak: bestStreakForUser(
        u.userId,
        filters.from,
        filters.to,
        filters.departmentId,
      ),
    };
  });

  if (filters.staffSort === "rate_asc") {
    list.sort((a, b) => (a.completionRate ?? -1) - (b.completionRate ?? -1));
  } else if (filters.staffSort === "name") {
    list.sort((a, b) => a.fullName.localeCompare(b.fullName, "fa"));
  } else {
    list.sort((a, b) => (b.completionRate ?? -1) - (a.completionRate ?? -1));
  }

  return list;
}

function bestStreakForUser(
  userId: number,
  from: GDate,
  to: GDate,
  sourceDepartmentId?: number | null,
): number {
  const rows = db
    .select({
      day: taskOccurrences.periodEnd,
      status: taskOccurrences.status,
    })
    .from(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.userId, userId),
        sql`${taskOccurrences.periodEnd} >= ${from}`,
        sql`${taskOccurrences.periodEnd} <= ${to}`,
        sql`${taskOccurrences.periodKey} like 'D:%'`,
        sourceDepartmentId
          ? eq(taskOccurrences.sourceDepartmentId, sourceDepartmentId)
          : undefined,
      ),
    )
    .all();

  const byDay = new Map<GDate, string[]>();
  for (const r of rows) {
    const list = byDay.get(r.day) ?? [];
    list.push(r.status);
    byDay.set(r.day, list);
  }
  const days: StreakDay[] = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, statuses]) => {
      const actionable = statuses.filter(
        (s) => s !== "EXCUSED" && s !== "PENDING" && s !== "DONE_BY_PEER",
      );
      if (actionable.length === 0) return { date, kind: "skip" as const };
      const allDone = actionable.every((s) => s === "DONE" || s === "DONE_LATE");
      return { date, kind: "work" as const, allDone };
    });
  return computeStreaks(days).best;
}

export function aggregateByDepartment(actor: AuthUser, filters: ReportFilters) {
  const { clauses } = baseOccurrenceWhere(actor, filters);
  const statusExpr = rateStatusSql(Date.now());
  const rows = db
    .select({
      departmentId: taskOccurrences.sourceDepartmentId,
      departmentName: departments.name,
      status: statusExpr,
      c: count(),
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .innerJoin(
      departments,
      eq(departments.id, taskOccurrences.sourceDepartmentId),
    )
    .where(and(...clauses))
    .groupBy(taskOccurrences.sourceDepartmentId, departments.name, statusExpr)
    .all();

  const map = new Map<string, { name: string; counts: StatusCounts }>();
  for (const r of rows) {
    const key = String(r.departmentId ?? "none");
    const cur = map.get(key) ?? {
      name: r.departmentName ?? "بدون دپارتمان",
      counts: {},
    };
    cur.counts[r.status as keyof StatusCounts] =
      (cur.counts[r.status as keyof StatusCounts] ?? 0) + Number(r.c);
    map.set(key, cur);
  }

  return [...map.values()].map((d) => ({
    name: d.name,
    ...ratesFromCounts(d.counts),
    counts: d.counts,
  }));
}

export function aggregateWorstTasks(actor: AuthUser, filters: ReportFilters) {
  const { clauses } = baseOccurrenceWhere(actor, filters);
  const statusExpr = rateStatusSql(Date.now());
  const rows = db
    .select({
      templateId: taskOccurrences.templateId,
      title: taskTemplates.title,
      status: statusExpr,
      c: count(),
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(and(...clauses))
    .groupBy(taskOccurrences.templateId, taskTemplates.title, statusExpr)
    .all();

  const map = new Map<number, { title: string; counts: StatusCounts }>();
  for (const r of rows) {
    const cur = map.get(r.templateId) ?? { title: r.title, counts: {} };
    cur.counts[r.status as keyof StatusCounts] =
      (cur.counts[r.status as keyof StatusCounts] ?? 0) + Number(r.c);
    map.set(r.templateId, cur);
  }

  return [...map.entries()]
    .map(([templateId, v]) => {
      const rates = ratesFromCounts(v.counts);
      const fail =
        (v.counts.NOT_DONE ?? 0) +
        (v.counts.MISSED ?? 0) +
        (v.counts.OVERDUE ?? 0);
      return { templateId, title: v.title, fail, ...rates };
    })
    .sort((a, b) => b.fail - a.fail)
    .slice(0, 20);
}

export function aggregateWeekdayRates(actor: AuthUser, filters: ReportFilters) {
  const dayData = aggregateByDay(actor, filters).dayAggs;
  const buckets: StatusCounts[] = Array.from({ length: 7 }, () => ({}));
  for (const d of dayData) {
    const wd = jalaliWeekday(d.day);
    const b = buckets[wd]!;
    for (const s of STATUS_COLS) {
      b[s] = (b[s] ?? 0) + (d[s] ?? 0);
    }
  }
  return buckets.map((counts, weekday) => ({
    weekday,
    ...ratesFromCounts(counts),
  }));
}

export function aggregateCompletionHours(actor: AuthUser, filters: ReportFilters) {
  const { clauses } = baseOccurrenceWhere(actor, filters);
  const rows = db
    .select({
      completedAt: taskOccurrences.completedAt,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        ...clauses,
        sql`${taskOccurrences.completedAt} is not null`,
        inArray(taskOccurrences.status, ["DONE", "DONE_LATE", "NOT_DONE"]),
      ),
    )
    .all();

  const hours = Array.from({ length: 24 }, () => 0);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    hour12: false,
  });
  for (const r of rows) {
    if (!r.completedAt) continue;
    const h = Number(fmt.format(r.completedAt));
    if (h >= 0 && h < 24) hours[h]! += 1;
  }
  return hours.map((c, hour) => ({ hour, count: c }));
}

export function aggregateReasons(actor: AuthUser, filters: ReportFilters) {
  const { clauses } = baseOccurrenceWhere(actor, filters);
  const byCode = db
    .select({
      reasonCode: taskOccurrences.reasonCode,
      c: count(),
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        ...clauses,
        eq(taskOccurrences.status, "NOT_DONE"),
        sql`${taskOccurrences.reasonCode} is not null`,
      ),
    )
    .groupBy(taskOccurrences.reasonCode)
    .all();

  const labels = reasonLabelMap();
  const labeled = byCode.map((row) => ({
    ...row,
    reasonLabel: row.reasonCode
      ? (labels.get(row.reasonCode) ?? row.reasonCode)
      : null,
  }));

  const recentNotes = db
    .select({
      id: taskOccurrences.id,
      note: taskOccurrences.note,
      reasonCode: taskOccurrences.reasonCode,
      fullName: users.fullName,
      title: taskTemplates.title,
      periodEnd: taskOccurrences.periodEnd,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .innerJoin(users, eq(taskOccurrences.userId, users.id))
    .where(
      and(
        ...clauses,
        eq(taskOccurrences.status, "NOT_DONE"),
        sql`${taskOccurrences.note} is not null`,
        sql`${taskOccurrences.note} != ''`,
      ),
    )
    .orderBy(desc(taskOccurrences.periodEnd))
    .limit(30)
    .all();

  return {
    byCode: labeled,
    recentNotes: recentNotes.map((note) => ({
      ...note,
      reasonLabel: note.reasonCode
        ? (labels.get(note.reasonCode) ?? note.reasonCode)
        : null,
    })),
  };
}

export function staffDayHeatmap(actor: AuthUser, filters: ReportFilters) {
  const { clauses } = baseOccurrenceWhere(actor, filters);
  const statusExpr = rateStatusSql(Date.now());
  const rows = db
    .select({
      userId: taskOccurrences.userId,
      fullName: users.fullName,
      day: taskOccurrences.periodEnd,
      status: statusExpr,
      c: count(),
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .innerJoin(users, eq(taskOccurrences.userId, users.id))
    .where(
      and(...clauses, sql`${taskOccurrences.periodKey} like 'D:%'`),
    )
    .groupBy(
      taskOccurrences.userId,
      users.fullName,
      taskOccurrences.periodEnd,
      statusExpr,
    )
    .all();

  const cells = new Map<string, StatusCounts & { userId: number; fullName: string; day: GDate }>();
  for (const r of rows) {
    const key = `${r.userId}:${r.day}`;
    const cur = cells.get(key) ?? {
      userId: r.userId,
      fullName: r.fullName,
      day: r.day,
    };
    cur[r.status as keyof StatusCounts] =
      (cur[r.status as keyof StatusCounts] ?? 0) + Number(r.c);
    cells.set(key, cur);
  }

  return [...cells.values()].map((c) => ({
    userId: c.userId,
    fullName: c.fullName,
    day: c.day,
    rate: ratesFromCounts(c).completionRate,
  }));
}

export function listOccurrenceDetails(
  actor: AuthUser,
  filters: ReportFilters,
) {
  const { clauses } = baseOccurrenceWhere(actor, filters, {
    personalCreditOnly: false,
  });
  const whereParts = [...clauses];
  if (filters.q) {
    const needle = `%${filters.q}%`;
    whereParts.push(
      or(like(users.fullName, needle), like(taskTemplates.title, needle))!,
    );
  }

  const where = and(...whereParts);

  const total =
    db
      .select({ c: count() })
      .from(taskOccurrences)
      .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
      .innerJoin(users, eq(taskOccurrences.userId, users.id))
      .where(where)
      .get()?.c ?? 0;

  const offset = (filters.page - 1) * filters.pageSize;
  const rows = db
    .select({
      id: taskOccurrences.id,
      status: taskOccurrences.status,
      periodStart: taskOccurrences.periodStart,
      periodEnd: taskOccurrences.periodEnd,
      periodKey: taskOccurrences.periodKey,
      dueAt: taskOccurrences.dueAt,
      completedAt: taskOccurrences.completedAt,
      note: taskOccurrences.note,
      reasonCode: taskOccurrences.reasonCode,
      attachmentPath: taskOccurrences.attachmentPath,
      completedByUserId: taskOccurrences.completedByUserId,
      fullName: users.fullName,
      userId: users.id,
      title: taskTemplates.title,
      priority: taskTemplates.priority,
      recurrenceType: taskTemplates.recurrenceType,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .innerJoin(users, eq(taskOccurrences.userId, users.id))
    .where(where)
    .orderBy(desc(taskOccurrences.periodEnd), asc(users.fullName))
    .limit(filters.pageSize)
    .offset(offset)
    .all();

  const labels = reasonLabelMap();
  const rates = aggregateStatusDonut(actor, filters).rates;
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

  return {
    rows: rows.map((row) => ({
      ...row,
      completedByName: row.completedByUserId
        ? (completerNames.get(row.completedByUserId) ?? null)
        : null,
      reasonLabel: row.reasonCode
        ? (labels.get(row.reasonCode) ?? row.reasonCode)
        : null,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    rates,
  };
}

/** درصد دوره‌های کار SHARED که حداقل یک عضو انجام داده است. */
export function sharedGroupSummary(actor: AuthUser, filters: ReportFilters) {
  const { clauses } = baseOccurrenceWhere(actor, filters);
  const rows = db
    .select({
      templateId: taskOccurrences.templateId,
      periodKey: taskOccurrences.periodKey,
      status: taskOccurrences.status,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(and(...clauses, eq(taskTemplates.completionMode, "SHARED")))
    .all();

  const doneByPeriod = new Map<string, boolean>();
  for (const row of rows) {
    const key = `${row.templateId}:${row.periodKey}`;
    const done = row.status === "DONE" || row.status === "DONE_LATE";
    doneByPeriod.set(key, (doneByPeriod.get(key) ?? false) || done);
  }
  const periods = doneByPeriod.size;
  const donePeriods = [...doneByPeriod.values()].filter(Boolean).length;
  return {
    periods,
    donePeriods,
    rate: sharedPeriodsRate(donePeriods, periods),
  };
}

export function loadDashboardKpis(actor: AuthUser) {
  const todayF = parseReportFilters({ range: "today" });
  const weekF = parseReportFilters({ range: "week" });
  const monthF = parseReportFilters({ range: "month" });

  const today = aggregateStatusDonut(actor, todayF).rates;
  const week = aggregateStatusDonut(actor, weekF).rates;
  const month = aggregateStatusDonut(actor, monthF).rates;

  const staffScope = scopeUsersQuery(actor);
  const activeStaff =
    db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          sql`${users.deletedAt} is null`,
          ...(staffScope ? [staffScope] : []),
        ),
      )
      .get()?.c ?? 0;

  const unanswered = aggregateByStaff(actor, todayF).filter(
    (s) => (s.counts.PENDING ?? 0) > 0 && s.done + s.doneLate === 0,
  );

  const to = todayTehran();
  const from = addGregorianDays(to, -6);
  const last7 = parseReportFilters({
    range: "custom",
    from,
    to,
  });
  const lowPerformers = aggregateByStaff(actor, last7).filter(
    (s) => s.completionRate != null && s.completionRate < 50 && s.countable > 0,
  );

  return {
    today,
    week,
    month,
    activeStaff,
    unanswered,
    lowPerformers,
  };
}
