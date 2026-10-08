import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { fromZonedTime } from "date-fns-tz";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { TEHRAN_TZ, tehranDateFromMs, type GDate } from "@/lib/dates";

export type AuditFilters = {
  actorId?: number | null;
  action?: string | null;
  from?: GDate | null;
  to?: GDate | null;
  page?: number;
  pageSize?: number;
};

export const AUDIT_ACTION_WHITELIST = [
  "staff.create",
  "staff.update",
  "staff.avatar",
  "task.create",
  "task.bulk_create",
  "task.update",
  "task.archive",
  "task.activate",
  "occurrence.submit",
  "occurrence.edit",
  "occurrence.status_change",
  "staff_leave.create",
  "settings.not_done_reasons",
  "reason.create",
  "reason.update",
  "reason.delete",
  "auth.login",
  "auth.logout",
  "auth.change_password",
] as const;

export function listAuditLogs(filters: AuditFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 30));
  const conditions: SQL[] = [];

  if (filters.actorId) {
    conditions.push(eq(auditLogs.actorId, filters.actorId));
  }
  if (
    filters.action &&
    (AUDIT_ACTION_WHITELIST as readonly string[]).includes(filters.action)
  ) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.from) {
    const fromMs = fromZonedTime(
      `${filters.from}T00:00:00`,
      TEHRAN_TZ,
    ).getTime();
    conditions.push(gte(auditLogs.createdAt, new Date(fromMs)));
  }
  if (filters.to) {
    const toMs = fromZonedTime(
      `${filters.to}T23:59:59`,
      TEHRAN_TZ,
    ).getTime();
    conditions.push(lte(auditLogs.createdAt, new Date(toMs)));
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const total =
    db.select({ c: count() }).from(auditLogs).where(where).get()?.c ?? 0;

  const rows = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt,
      actorName: users.fullName,
      actorId: auditLogs.actorId,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  return {
    rows: rows.map((r) => ({
      ...r,
      tehranDay: tehranDateFromMs(
        r.createdAt instanceof Date
          ? r.createdAt.getTime()
          : Number(r.createdAt),
      ),
    })),
    total,
    page,
    pageSize,
    actions: AUDIT_ACTION_WHITELIST,
  };
}
