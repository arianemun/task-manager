import { NOTIFICATION_TYPES, type NotificationType, type Role } from "@/db/schema";
import {
  compareGDate,
  dueAtTehranMs,
  tehranDateFromMs,
  toJalali,
  type GDate,
} from "@/lib/dates";
import { toFaDigits } from "@/lib/utils";

export const ASSIGNED_WINDOW_MS = 2 * 60 * 1000;
export const DIGEST_LATE_MS = 2 * 60 * 60 * 1000;

export const TASK_NOTIFY_DEFAULTS = {
  digestTime: "08:00",
  dueSoonMinutes: 30,
  overdueAfterMinutes: 15,
  summaryTime: "18:00",
} as const;

export type TaskNotifySettings = {
  digestTime: string;
  dueSoonMinutes: number;
  overdueAfterMinutes: number;
  summaryTime: string;
};

const TASK_TYPES: NotificationType[] = [
  "task.assigned",
  "task.daily_digest",
  "task.due_soon",
  "task.overdue",
  "task.visible",
  "task.manager_summary",
];

/** بعد از ساعت شروع، فقط در این پنجره اعلان «قابل انجام شد» می‌رود. */
export const VISIBLE_CATCHUP_MS = 30 * 60 * 1000;

export function notificationTypesForRole(role: Role): NotificationType[] {
  return NOTIFICATION_TYPES.filter((type) => {
    if (!TASK_TYPES.includes(type)) return true;
    if (type === "task.manager_summary") return role === "ADMIN" || role === "MANAGER";
    return true;
  });
}

export function assignedCopy(input: {
  count: number;
  title: string;
  startDate: GDate;
  today: GDate;
}): { title: string; body: string } {
  if (input.count > 1) {
    return {
      title: `${toFaDigits(input.count)} کار جدید به شما اختصاص داده شد`,
      body: "",
    };
  }
  const future = compareGDate(input.startDate, input.today) > 0;
  return {
    title: input.title,
    body: future ? `شروع ${toFaDigits(toJalali(input.startDate).jDate)}` : "",
  };
}

export type LaterTaskBucket = { clock: string; count: number };

function laterPhrase(later: LaterTaskBucket[]): string {
  return later
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => {
      const hour = String(Number(bucket.clock.slice(0, 2)));
      return `${toFaDigits(bucket.count)} کار از ساعت ${toFaDigits(hour)}`;
    })
    .join("، ");
}

export function digestCopy(
  todayCount: number,
  openCount: number,
  later: LaterTaskBucket[] = [],
): { title: string; body: string } {
  const laterText = laterPhrase(later);
  if (laterText) {
    return {
      title: `${toFaDigits(todayCount + openCount)} کار الان، ${laterText}`,
      body: "",
    };
  }
  if (todayCount > 0) {
    return {
      title: `امروز ${toFaDigits(todayCount)} کار دارید`,
      body: openCount > 0 ? `${toFaDigits(openCount)} کار هفتگی یا ماهانه باز است` : "",
    };
  }
  return {
    title: `${toFaDigits(openCount)} کار هفتگی یا ماهانه باز است`,
    body: "",
  };
}

export function visibleCopy(titles: string[]): { title: string; body: string } {
  if (titles.length <= 1) {
    return { title: titles[0] ?? "کار", body: "از الان قابل انجام است" };
  }
  return {
    title: `${toFaDigits(titles.length)} کار از الان قابل انجام است`,
    body: titles.slice(0, 3).join("، "),
  };
}

export function dueSoonCopy(title: string, leadMinutes: number): { title: string; body: string } {
  return { title, body: `${toFaDigits(leadMinutes)} دقیقه تا مهلت` };
}

export function overdueCopy(title: string): { title: string; body: string } {
  return { title, body: "مهلت این کار گذشته است" };
}

export function summaryCopy(input: {
  rate: number | null;
  unanswered: number;
  names: string[];
}): { title: string; body: string } {
  const rate =
    input.rate == null ? "درصد انجام امروز هنوز مشخص نیست" : `انجام امروز: ${toFaDigits(input.rate)}٪`;
  const shown = input.names.slice(0, 5);
  const extra = input.names.length > 5 ? " و دیگران" : "";
  const who = shown.length > 0 ? `\nبدون پاسخ: ${shown.join("،")}${extra}` : "";
  return {
    title: "خلاصهٔ امروز",
    body: `${rate}\nبی‌پاسخ: ${toFaDigits(input.unanswered)}${who}`,
  };
}

export function isDailyPeriod(periodKey: string): boolean {
  return periodKey.startsWith("D:") || periodKey.startsWith("O:");
}

export function isOpenPeriod(periodKey: string): boolean {
  return periodKey.startsWith("W:") || periodKey.startsWith("M:");
}

export function quietPushMode(type: NotificationType): "skip" | "defer" {
  if (type === "task.daily_digest" || type === "task.manager_summary") return "defer";
  return "skip";
}

export function clockReached(now: number, day: GDate, time: string, lateMs: number | null): "wait" | "late" | "due" {
  const at = dueAtTehranMs(day, time);
  if (now < at) return "wait";
  if (lateMs != null && now - at > lateMs) return "late";
  if (tehranDateFromMs(now) !== day) return "late";
  return "due";
}

export type DueDecision = { send: true } | { send: false; reason: string };

export function dueSoonDecision(input: {
  dueTime: string | null;
  status: string;
  dueAt: number | null;
  now: number;
  leadMinutes: number;
  sharedBlocked: boolean;
}): DueDecision {
  if (!input.dueTime) return { send: false, reason: "این کار مهلت ساعتی ندارد" };
  if (input.status !== "PENDING") return { send: false, reason: "کار دیگر در انتظار نیست" };
  if (input.dueAt == null) return { send: false, reason: "زمان مهلت مشخص نیست" };
  if (input.sharedBlocked) return { send: false, reason: "همکار همین گروه این کار را انجام داده" };
  const lead = input.leadMinutes * 60 * 1000;
  if (input.now < input.dueAt - lead) return { send: false, reason: "هنوز به زمان یادآوری نرسیده" };
  if (input.now >= input.dueAt) return { send: false, reason: "مهلت گذشته و یادآوری دیر شده" };
  return { send: true };
}

export function overdueDecision(input: {
  dueTime: string | null;
  status: string;
  dueAt: number | null;
  now: number;
  afterMinutes: number;
  sharedBlocked: boolean;
}): DueDecision {
  if (!input.dueTime) return { send: false, reason: "کار بدون مهلت با پایان روز بسته می‌شود" };
  if (input.status !== "PENDING") return { send: false, reason: "کار دیگر در انتظار نیست" };
  if (input.dueAt == null) return { send: false, reason: "زمان مهلت مشخص نیست" };
  if (input.sharedBlocked) return { send: false, reason: "همکار همین گروه این کار را انجام داده" };
  if (input.now < input.dueAt + input.afterMinutes * 60 * 1000) {
    return { send: false, reason: "هنوز به تأخیر بعد از مهلت نرسیده" };
  }
  return { send: true };
}

export function digestDecision(input: {
  onLeave: boolean;
  todayCount: number;
  openCount: number;
  laterCount?: number;
  timing: "wait" | "late" | "due";
}): DueDecision {
  if (input.timing === "wait") return { send: false, reason: "هنوز ساعت خلاصهٔ صبح نرسیده" };
  if (input.timing === "late") return { send: false, reason: "خلاصهٔ صبح بیش از دو ساعت دیر شده" };
  if (input.onLeave) return { send: false, reason: "امروز مرخصی است" };
  if (input.todayCount + input.openCount + (input.laterCount ?? 0) <= 0) {
    return { send: false, reason: "کار بازی برای امروز نمانده" };
  }
  return { send: true };
}
