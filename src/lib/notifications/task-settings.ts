import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { parseClock } from "@/lib/push/policy";
import { TASK_NOTIFY_DEFAULTS, type TaskNotifySettings } from "./task-rules";

const KEYS = {
  digestTime: "notify_digest_time",
  dueSoonMinutes: "notify_due_soon_minutes",
  overdueAfterMinutes: "notify_overdue_after_minutes",
  summaryTime: "notify_summary_time",
} as const;

function read(key: string): string | null {
  return db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

function write(key: string, value: string) {
  const existing = db.select({ key: settings.key }).from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key)).run();
    return;
  }
  db.insert(settings).values({ key, value }).run();
}

export function loadTaskNotifySettings(): TaskNotifySettings {
  const digest = read(KEYS.digestTime);
  const summary = read(KEYS.summaryTime);
  const dueSoon = Number(read(KEYS.dueSoonMinutes));
  const overdue = Number(read(KEYS.overdueAfterMinutes));
  return {
    digestTime: digest && parseClock(digest) != null ? digest : TASK_NOTIFY_DEFAULTS.digestTime,
    summaryTime: summary && parseClock(summary) != null ? summary : TASK_NOTIFY_DEFAULTS.summaryTime,
    dueSoonMinutes:
      Number.isInteger(dueSoon) && dueSoon >= 1 && dueSoon <= 240
        ? dueSoon
        : TASK_NOTIFY_DEFAULTS.dueSoonMinutes,
    overdueAfterMinutes:
      Number.isInteger(overdue) && overdue >= 1 && overdue <= 240
        ? overdue
        : TASK_NOTIFY_DEFAULTS.overdueAfterMinutes,
  };
}

export function saveTaskNotifySettings(input: TaskNotifySettings): void {
  write(KEYS.digestTime, input.digestTime);
  write(KEYS.summaryTime, input.summaryTime);
  write(KEYS.dueSoonMinutes, String(input.dueSoonMinutes));
  write(KEYS.overdueAfterMinutes, String(input.overdueAfterMinutes));
}
