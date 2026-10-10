import type { NotificationPriority, NotificationType } from "@/db/schema";
import { toFaDigits } from "@/lib/utils";

const TEHRAN = "Asia/Tehran";

export const CHAT_PUSH_WINDOW_MS = 30_000;
/** بعد از پایان سکوت فقط در این پنجره خلاصه فرستاده می‌شود. */
export const QUIET_DIGEST_WINDOW_MS = 10 * 60 * 1000;
export const CHAT_PREVIEW_MAX = 80;
export const PUSH_FAIL_DISABLE = 5;
export const PUSH_BACKOFF_MS = [30_000, 120_000, 600_000, 1_800_000] as const;

/** پیش‌فرض روشن بودن Push برای هر نوع، وقتی ردیف preference نیست. */
export const PUSH_ON_BY_DEFAULT: Record<NotificationType, boolean> = {
  "chat.message": true,
  "chat.mention": true,
  "announcement.new": true,
  "task.assigned": true,
  "task.daily_digest": true,
  "task.due_soon": true,
  "task.overdue": true,
  "task.visible": false,
  "task.manager_summary": true,
  "system.data_check_failed": true,
};

export function tehranMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TEHRAN,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** بازهٔ شبانه (مثلاً ۲۲:۰۰ تا ۰۷:۰۰) از شروع تا قبل از پایان است. */
export function inQuietHours(now: Date, start: string, end: string): boolean {
  const current = tehranMinutes(now);
  const from = parseClock(start);
  const to = parseClock(end);
  if (from == null || to == null || from === to) return false;
  if (from < to) return current >= from && current < to;
  return current >= from || current < to;
}

export type PushDecision = "send" | "preference" | "quiet";

export function decidePush(input: {
  priority: NotificationPriority;
  preferencePush: boolean | null;
  type: NotificationType;
  quiet: boolean;
}): PushDecision {
  const enabled = input.preferencePush ?? PUSH_ON_BY_DEFAULT[input.type];
  if (!enabled) return "preference";
  if (input.quiet && input.priority !== "HIGH") return "quiet";
  return "send";
}

export function chatPreview(input: {
  type: string;
  body: string | null;
  hideText: boolean;
}): string {
  if (input.type === "VOICE") return "🎤 پیام صوتی";
  if (input.type === "IMAGE") return "📷 عکس";
  if (input.type === "VIDEO" || input.type === "VIDEO_NOTE") return "🎬 ویدیو";
  const text = (input.body ?? "").replace(/\s+/g, " ").trim();
  if (!text || input.hideText) return "پیام جدید";
  if (text.length <= CHAT_PREVIEW_MAX) return text;
  return `${text.slice(0, CHAT_PREVIEW_MAX)}…`;
}

export function chatPushCopy(input: {
  count: number;
  senderName: string;
  preview: string;
}): { title: string; body: string } {
  if (input.count <= 1) {
    return { title: input.senderName, body: input.preview };
  }
  return {
    title: `${toFaDigits(input.count)} پیام جدید`,
    body: `از ${input.senderName}`,
  };
}

export function splitChatRecipients(input: {
  memberIds: number[];
  senderId: number;
  /** حداقل یک سوکت جلوی چشم. اتصالِ تنها در پس‌زمینه اینجا نیست. */
  foregroundUserIds: ReadonlySet<number>;
  viewingUserIds: ReadonlySet<number>;
}): { push: number[]; toastOnly: number[]; skip: number[] } {
  const push: number[] = [];
  const toastOnly: number[] = [];
  const skip: number[] = [];
  for (const userId of input.memberIds) {
    if (userId === input.senderId) continue;
    if (input.viewingUserIds.has(userId)) {
      skip.push(userId);
      continue;
    }
    if (input.foregroundUserIds.has(userId)) {
      toastOnly.push(userId);
      continue;
    }
    push.push(userId);
  }
  return { push, toastOnly, skip };
}

export function nextBackoff(attemptsAfterFailure: number): number | null {
  return PUSH_BACKOFF_MS[attemptsAfterFailure - 1] ?? null;
}

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

function tehranYmd(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TEHRAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { y: pick("year"), m: pick("month"), d: pick("day") };
}

/** اگر همین الان سکوت تمام شده باشد، زمان پایان این دوره را برمی‌گرداند. */
export function quietPeriodEndMs(now: Date, start: string, end: string): number | null {
  if (inQuietHours(now, start, end)) return null;
  const from = parseClock(start);
  const to = parseClock(end);
  if (from == null || to == null || from === to) return null;
  const { y, m, d } = tehranYmd(now);
  const hh = Math.floor(to / 60);
  const mm = to % 60;
  let endMs = Date.UTC(y, m - 1, d, hh, mm) - TEHRAN_OFFSET_MS;
  if (endMs > now.getTime()) endMs -= 86_400_000;
  if (now.getTime() < endMs) return null;
  if (now.getTime() - endMs >= QUIET_DIGEST_WINDOW_MS) return null;
  return endMs;
}

export function quietDigestCopy(unread: number): string {
  return `${toFaDigits(unread)} پیام و اطلاعیه خوانده‌نشده`;
}

/** اگر الان داخل سکوت است، زمان پایان همین دوره. وگرنه null. */
export function nextQuietEndMs(now: Date, start: string, end: string): number | null {
  if (!inQuietHours(now, start, end)) return null;
  const to = parseClock(end);
  if (to == null) return null;
  const { y, m, d } = tehranYmd(now);
  const hh = Math.floor(to / 60);
  const mm = to % 60;
  let endMs = Date.UTC(y, m - 1, d, hh, mm) - TEHRAN_OFFSET_MS;
  if (endMs <= now.getTime()) endMs += 86_400_000;
  return endMs;
}
