import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export const NOT_DONE_REASONS_KEY = "not_done_reasons";

export type NotDoneReason = { code: string; label: string };

export const DEFAULT_NOT_DONE_REASONS: NotDoneReason[] = [
  { code: "no_time", label: "وقت نشد" },
  { code: "equipment", label: "نبود تجهیزات" },
  { code: "waiting", label: "منتظر هماهنگی" },
  { code: "other", label: "سایر" },
];

export function getNotDoneReasons(): NotDoneReason[] {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, NOT_DONE_REASONS_KEY))
    .get();
  if (!row?.value) return DEFAULT_NOT_DONE_REASONS;
  try {
    const parsed = JSON.parse(row.value) as NotDoneReason[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_NOT_DONE_REASONS;
    }
    return parsed.filter((r) => r.code && r.label);
  } catch {
    return DEFAULT_NOT_DONE_REASONS;
  }
}

export function setNotDoneReasons(reasons: NotDoneReason[]): void {
  const value = JSON.stringify(reasons);
  const existing = db
    .select()
    .from(settings)
    .where(eq(settings.key, NOT_DONE_REASONS_KEY))
    .get();
  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, NOT_DONE_REASONS_KEY))
      .run();
  } else {
    db.insert(settings).values({ key: NOT_DONE_REASONS_KEY, value }).run();
  }
}
