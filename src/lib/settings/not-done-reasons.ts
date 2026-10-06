import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  notDoneReasonDepartments,
  notDoneReasons,
  settings,
  taskOccurrences,
} from "@/db/schema";

export const NOT_DONE_REASONS_KEY = "not_done_reasons";

export type NotDoneReason = { code: string; label: string };

export type NotDoneReasonAdmin = NotDoneReason & {
  id: number;
  departmentIds: number[];
  departmentNames: string[];
  usageCount: number;
};

export const DEFAULT_NOT_DONE_REASONS: NotDoneReason[] = [
  { code: "no_time", label: "وقت نشد" },
  { code: "equipment", label: "نبود تجهیزات" },
  { code: "waiting", label: "منتظر هماهنگی" },
  { code: "other", label: "سایر" },
];

function readLegacyReasons(): NotDoneReason[] {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, NOT_DONE_REASONS_KEY))
    .get();
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value) as NotDoneReason[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r.code && r.label);
  } catch {
    return [];
  }
}

/** اگر جدول خالی باشد، دلایل قبلی تنظیمات (یا پیش‌فرض) را وارد می‌کند. */
export function ensureNotDoneReasonsSeeded(): void {
  const existing = db.select({ c: count() }).from(notDoneReasons).get()?.c ?? 0;
  if (existing > 0) return;
  const seed = readLegacyReasons();
  const rows = seed.length > 0 ? seed : DEFAULT_NOT_DONE_REASONS;
  for (const reason of rows) {
    db.insert(notDoneReasons)
      .values({ code: reason.code, label: reason.label })
      .onConflictDoNothing()
      .run();
  }
}

export function getNotDoneReasons(): NotDoneReason[] {
  ensureNotDoneReasonsSeeded();
  return db
    .select({ code: notDoneReasons.code, label: notDoneReasons.label })
    .from(notDoneReasons)
    .orderBy(asc(notDoneReasons.label))
    .all();
}

/**
 * دلایل قابل انتخاب برای پرسنل یک دپارتمان.
 * دلیل بدون دپارتمان برای همه است؛ دلیل با دپارتمان فقط برای همان‌ها.
 */
export function getNotDoneReasonsForDepartments(
  departmentIds: number[],
): NotDoneReason[] {
  ensureNotDoneReasonsSeeded();
  const reasons = db
    .select()
    .from(notDoneReasons)
    .orderBy(asc(notDoneReasons.label))
    .all();
  const links = db.select().from(notDoneReasonDepartments).all();
  const byReason = new Map<number, number[]>();
  for (const link of links) {
    const list = byReason.get(link.reasonId) ?? [];
    list.push(link.departmentId);
    byReason.set(link.reasonId, list);
  }
  const allowed = new Set(departmentIds);
  return reasons
    .filter((reason) => {
      const assigned = byReason.get(reason.id) ?? [];
      if (assigned.length === 0) return true;
      return assigned.some((id) => allowed.has(id));
    })
    .map((reason) => ({ code: reason.code, label: reason.label }));
}

export function getNotDoneReasonsForDepartment(
  departmentId: number | null | undefined,
): NotDoneReason[] {
  return getNotDoneReasonsForDepartments(
    departmentId == null ? [] : [departmentId],
  );
}

export function reasonLabelMap(): Map<string, string> {
  return new Map(getNotDoneReasons().map((reason) => [reason.code, reason.label]));
}

export function listNotDoneReasonsAdmin(): NotDoneReasonAdmin[] {
  ensureNotDoneReasonsSeeded();
  const reasons = db
    .select()
    .from(notDoneReasons)
    .orderBy(asc(notDoneReasons.label))
    .all();
  const links = db
    .select({
      reasonId: notDoneReasonDepartments.reasonId,
      departmentId: notDoneReasonDepartments.departmentId,
      departmentName: departments.name,
    })
    .from(notDoneReasonDepartments)
    .innerJoin(
      departments,
      eq(departments.id, notDoneReasonDepartments.departmentId),
    )
    .all();
  const usage = db
    .select({
      reasonCode: taskOccurrences.reasonCode,
      c: count(),
    })
    .from(taskOccurrences)
    .groupBy(taskOccurrences.reasonCode)
    .all();
  const usageByCode = new Map(
    usage
      .filter((row) => row.reasonCode)
      .map((row) => [row.reasonCode as string, row.c]),
  );

  return reasons.map((reason) => {
    const assigned = links.filter((link) => link.reasonId === reason.id);
    return {
      id: reason.id,
      code: reason.code,
      label: reason.label,
      departmentIds: assigned.map((link) => link.departmentId),
      departmentNames: assigned.map((link) => link.departmentName),
      usageCount: usageByCode.get(reason.code) ?? 0,
    };
  });
}
