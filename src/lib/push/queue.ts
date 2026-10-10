import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationDeliveries,
  notificationPreferences,
  notifications,
  pushSubscriptions,
  users,
  type NotificationPriority,
  type NotificationType,
} from "@/db/schema";
import { activeMemberIds } from "@/lib/chat/store";
import { countUnreadNotifications } from "@/lib/notifications/store";
import {
  CHAT_PUSH_WINDOW_MS,
  PUSH_FAIL_DISABLE,
  chatPreview,
  chatPushCopy,
  decidePush,
  inQuietHours,
  nextBackoff,
  nextQuietEndMs,
  quietDigestCopy,
  quietPeriodEndMs,
  splitChatRecipients,
} from "./policy";
import { sendWebPush, type WebPushResult } from "./send";
import {
  activePushSubscriptions,
  deletePushSubscriptionByEndpoint,
  notePushFailure,
  notePushSuccess,
} from "./subscriptions";
import { chatPreviewHidden, markQuietDigest, quietDigestMarked } from "./settings";

const SKIP_REASON = {
  preference: "ترجیح کاربر",
  quiet: "ساعات سکوت",
} as const;

function preferencePush(userId: number, type: NotificationType): boolean | null {
  const row = db
    .select({ push: notificationPreferences.push })
    .from(notificationPreferences)
    .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)))
    .get();
  return row ? row.push : null;
}

function userQuietClocks(userId: number): { start: string; end: string } | null {
  const row = db
    .select({
      start: users.quietHoursStart,
      end: users.quietHoursEnd,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return row ?? null;
}

function userQuiet(userId: number, now: Date): boolean {
  const row = userQuietClocks(userId);
  if (!row) return false;
  return inQuietHours(now, row.start, row.end);
}

export function enqueuePushesFor(ids: number[]): void {
  if (ids.length === 0) return;
  const rows = db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      type: notifications.type,
      priority: notifications.priority,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(inArray(notifications.id, ids))
    .all();
  for (const row of rows) {
    enqueuePush({
      notificationId: row.id,
      userId: row.userId,
      type: row.type,
      priority: row.priority,
      now: row.createdAt.getTime(),
    });
  }
}

export function enqueuePush(input: {
  notificationId: number;
  userId: number;
  type: NotificationType;
  priority: NotificationPriority;
  now?: number;
  /** digest و summary در ساعات سکوت به پایان سکوت موکول می‌شوند. */
  whenQuiet?: "skip" | "defer";
}): "send" | "preference" | "quiet" {
  const now = input.now ?? Date.now();
  const decision = decidePush({
    priority: input.priority,
    preferencePush: preferencePush(input.userId, input.type),
    type: input.type,
    quiet: userQuiet(input.userId, new Date(now)),
  });
  if (decision === "send") {
    db.insert(notificationDeliveries)
      .values({
        notificationId: input.notificationId,
        channel: "PUSH",
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(now),
      })
      .run();
    return decision;
  }
  if (decision === "quiet" && input.whenQuiet === "defer") {
    const clocks = userQuietClocks(input.userId);
    const end = clocks ? nextQuietEndMs(new Date(now), clocks.start, clocks.end) : null;
    if (end != null) {
      db.insert(notificationDeliveries)
        .values({
          notificationId: input.notificationId,
          channel: "PUSH",
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: new Date(end),
        })
        .run();
      return decision;
    }
  }
  db.insert(notificationDeliveries)
    .values({
      notificationId: input.notificationId,
      channel: "PUSH",
      status: "SKIPPED",
      attempts: 0,
      lastError: SKIP_REASON[decision],
      sentAt: new Date(now),
    })
    .run();
  return decision;
}

function pendingPush(notificationId: number) {
  return db
    .select({ id: notificationDeliveries.id })
    .from(notificationDeliveries)
    .where(
      and(
        eq(notificationDeliveries.notificationId, notificationId),
        eq(notificationDeliveries.channel, "PUSH"),
        eq(notificationDeliveries.status, "PENDING"),
      ),
    )
    .get();
}

export function recordOfflineChatPush(input: {
  userId: number;
  conversationId: number;
  senderName: string;
  type: string;
  body: string | null;
  now?: number;
}): number {
  const now = input.now ?? Date.now();
  const groupKey = `chat:${input.conversationId}`;
  const preview = chatPreview({
    type: input.type,
    body: input.body,
    hideText: chatPreviewHidden(),
  });
  const since = new Date(now - CHAT_PUSH_WINDOW_MS);
  const existing = db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, input.userId),
        eq(notifications.type, "chat.message"),
        eq(notifications.groupKey, groupKey),
        gte(notifications.createdAt, since),
      ),
    )
    .orderBy(asc(notifications.id))
    .get();

  if (existing) {
    const count = existing.bundleCount + 1;
    const copy = chatPushCopy({ count, senderName: input.senderName, preview });
    db.update(notifications)
      .set({ title: copy.title, body: copy.body, bundleCount: count })
      .where(eq(notifications.id, existing.id))
      .run();
    if (!pendingPush(existing.id)) {
      enqueuePush({
        notificationId: existing.id,
        userId: input.userId,
        type: "chat.message",
        priority: "NORMAL",
        now,
      });
    }
    return existing.id;
  }

  const copy = chatPushCopy({ count: 1, senderName: input.senderName, preview });
  const inserted = db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: "chat.message",
      title: copy.title,
      body: copy.body,
      url: `/chat/${input.conversationId}`,
      entityType: "conversation",
      entityId: input.conversationId,
      groupKey,
      bundleCount: 1,
      priority: "NORMAL",
      createdAt: new Date(now),
    })
    .returning({ id: notifications.id })
    .get();
  db.insert(notificationDeliveries)
    .values({
      notificationId: inserted.id,
      channel: "IN_APP",
      status: "SENT",
      attempts: 1,
      sentAt: new Date(now),
    })
    .run();
  enqueuePush({
    notificationId: inserted.id,
    userId: input.userId,
    type: "chat.message",
    priority: "NORMAL",
    now,
  });
  return inserted.id;
}

export function deliverChatPush(input: {
  conversationId: number;
  senderId: number;
  senderName: string;
  type: string;
  body: string | null;
  foregroundUserIds: number[];
  viewingUserIds: number[];
  now?: number;
}): number[] {
  const split = splitChatRecipients({
    memberIds: activeMemberIds(input.conversationId),
    senderId: input.senderId,
    foregroundUserIds: new Set(input.foregroundUserIds),
    viewingUserIds: new Set(input.viewingUserIds),
  });
  return split.push.map((userId) =>
    recordOfflineChatPush({
      userId,
      conversationId: input.conversationId,
      senderName: input.senderName,
      type: input.type,
      body: input.body,
      now: input.now,
    }),
  );
}

export async function processPushQueue(input?: {
  now?: number;
  limit?: number;
  send?: (payload: {
    endpoint: string;
    p256dh: string;
    auth: string;
    title: string;
    body: string;
    url: string;
    tag: string | null;
    badge: number;
  }) => Promise<WebPushResult>;
}): Promise<number> {
  const now = input?.now ?? Date.now();
  const send = input?.send ?? sendWebPush;
  const due = db
    .select({
      deliveryId: notificationDeliveries.id,
      attempts: notificationDeliveries.attempts,
      notificationId: notifications.id,
      userId: notifications.userId,
      title: notifications.title,
      body: notifications.body,
      url: notifications.url,
      groupKey: notifications.groupKey,
    })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .where(
      and(
        eq(notificationDeliveries.channel, "PUSH"),
        eq(notificationDeliveries.status, "PENDING"),
        or(
          isNull(notificationDeliveries.nextAttemptAt),
          lte(notificationDeliveries.nextAttemptAt, new Date(now)),
        ),
      ),
    )
    .orderBy(asc(notificationDeliveries.id))
    .limit(input?.limit ?? 20)
    .all();

  let handled = 0;
  for (const row of due) {
    const subs = activePushSubscriptions(row.userId);
    if (subs.length === 0) {
      db.update(notificationDeliveries)
        .set({
          status: "SKIPPED",
          lastError: "اشتراک فعالی نیست",
          sentAt: new Date(now),
        })
        .where(eq(notificationDeliveries.id, row.deliveryId))
        .run();
      handled += 1;
      continue;
    }
    const badge = countUnreadNotifications(row.userId);
    let success = 0;
    let retry = false;
    let lastError = "";
    for (const sub of subs) {
      const result = await send({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        title: row.title,
        body: row.body,
        url: row.url || "/",
        tag: row.groupKey,
        badge,
      });
      if (result.ok) {
        success += 1;
        notePushSuccess(sub.id, now);
        continue;
      }
      if (result.statusCode === 404 || result.statusCode === 410) {
        deletePushSubscriptionByEndpoint(sub.endpoint);
        continue;
      }
      retry = true;
      lastError = result.error ?? "ارسال ناموفق";
      notePushFailure(sub.id, now, PUSH_FAIL_DISABLE);
    }
    if (success > 0 || !retry) {
      db.update(notificationDeliveries)
        .set({
          status: success > 0 ? "SENT" : "FAILED",
          attempts: row.attempts + 1,
          lastError: success > 0 ? null : lastError || "اشتراک منقضی شد",
          sentAt: new Date(now),
          nextAttemptAt: null,
        })
        .where(eq(notificationDeliveries.id, row.deliveryId))
        .run();
    } else {
      const attempts = row.attempts + 1;
      const wait = nextBackoff(attempts);
      db.update(notificationDeliveries)
        .set({
          status: wait == null ? "FAILED" : "PENDING",
          attempts,
          lastError: lastError.slice(0, 300),
          nextAttemptAt: wait == null ? null : new Date(now + wait),
          sentAt: wait == null ? new Date(now) : null,
        })
        .where(eq(notificationDeliveries.id, row.deliveryId))
        .run();
    }
    handled += 1;
  }
  return handled;
}

/** در پایان ساعات سکوت یک خلاصه می‌فرستد. Pushهای ردشدهٔ همان بازه در صف نمی‌مانند. */
export async function processQuietDigests(input?: {
  now?: number;
  send?: (payload: {
    endpoint: string;
    p256dh: string;
    auth: string;
    title: string;
    body: string;
    url: string;
    tag: string | null;
    badge: number;
  }) => Promise<WebPushResult>;
}): Promise<number> {
  const now = input?.now ?? Date.now();
  const send = input?.send ?? sendWebPush;
  const rows = db
    .select({
      userId: users.id,
      start: users.quietHoursStart,
      end: users.quietHoursEnd,
    })
    .from(users)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
    .where(isNull(pushSubscriptions.disabledAt))
    .all();
  const seen = new Set<number>();
  let sent = 0;
  for (const row of rows) {
    if (seen.has(row.userId)) continue;
    seen.add(row.userId);
    const periodEnd = quietPeriodEndMs(new Date(now), row.start, row.end);
    if (periodEnd == null) continue;
    if (quietDigestMarked(row.userId) === String(periodEnd)) continue;
    const unread = countUnreadNotifications(row.userId);
    if (unread === 0) {
      markQuietDigest(row.userId, periodEnd);
      continue;
    }
    const subs = activePushSubscriptions(row.userId);
    if (subs.length === 0) continue;
    const title = quietDigestCopy(unread);
    let success = 0;
    let retry = false;
    for (const sub of subs) {
      const result = await send({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        title,
        body: "",
        url: "/notifications",
        tag: "quiet-digest",
        badge: unread,
      });
      if (result.ok) {
        success += 1;
        notePushSuccess(sub.id, now);
        continue;
      }
      if (result.statusCode === 404 || result.statusCode === 410) {
        deletePushSubscriptionByEndpoint(sub.endpoint);
        continue;
      }
      retry = true;
      notePushFailure(sub.id, now, PUSH_FAIL_DISABLE);
    }
    if (success > 0 || !retry) {
      markQuietDigest(row.userId, periodEnd);
    }
    if (success > 0) sent += 1;
  }
  return sent;
}
