import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationDeliveries,
  notifications,
  users,
  type NotificationPriority,
  type NotificationType,
} from "@/db/schema";
import { userIdsInDepartments } from "@/lib/departments/membership";
import { requestSocketNotify } from "@/lib/realtime/notify";
import type { NotificationItem, SocketNotification } from "./types";

/**
 * پیام چت در زنگ تکرار نمی‌شود و badge گفتگو جدا می‌ماند.
 * chat.message فقط وقتی ثبت می‌شود که کاربر آفلاین بوده و Push خبر را رسانده باشد.
 * آن مسیر در فاز Push است؛ ارسال پیام در چت از اینجا اعلان نمی‌سازد.
 */
const PAGE_SIZE = 20;

export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value.slice(0, 300);
}

export function createInAppNotifications(
  items: Array<{
    userId: number;
    type: NotificationType;
    title: string;
    body: string;
    url?: string | null;
    entityType?: string | null;
    entityId?: number | null;
    groupKey?: string | null;
    priority?: NotificationPriority;
    now?: number;
  }>,
): number[] {
  if (items.length === 0) return [];
  const created = db.transaction((tx) => {
    const rows: Array<{ id: number; userId: number; payload: SocketNotification }> = [];
    for (const item of items) {
      const now = item.now ?? Date.now();
      const url = safeInternalPath(item.url);
      const title = item.title.trim().slice(0, 200);
      const body = item.body.trim().slice(0, 4000);
      const inserted = tx
        .insert(notifications)
        .values({
          userId: item.userId,
          type: item.type,
          title,
          body,
          url,
          entityType: item.entityType ?? null,
          entityId: item.entityId ?? null,
          groupKey: item.groupKey ?? null,
          priority: item.priority ?? "NORMAL",
          createdAt: new Date(now),
        })
        .returning({ id: notifications.id })
        .get();
      tx.insert(notificationDeliveries)
        .values({
          notificationId: inserted.id,
          channel: "IN_APP",
          status: "SENT",
          attempts: 1,
          sentAt: new Date(now),
        })
        .run();
      rows.push({
        id: inserted.id,
        userId: item.userId,
        payload: {
          id: inserted.id,
          type: item.type,
          title,
          body: body.slice(0, 180),
          url,
          priority: item.priority ?? "NORMAL",
          createdAt: now,
        },
      });
    }
    return rows;
  });
  for (const row of created) requestSocketNotify(row.userId, row.payload);
  return created.map((row) => row.id);
}

function mapRow(row: {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  priority: NotificationPriority;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    priority: row.priority,
    readAt: row.readAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
  };
}

export function listNotifications(userId: number, page = 1, pageSize = PAGE_SIZE): NotificationItem[] {
  const current = Math.max(1, page);
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      url: notifications.url,
      priority: notifications.priority,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.id))
    .limit(pageSize)
    .offset((current - 1) * pageSize)
    .all()
    .map(mapRow);
}

export function countNotifications(userId: number): number {
  return (
    db
      .select({ n: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .get()?.n ?? 0
  );
}

export function countUnreadNotifications(userId: number): number {
  return (
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .get()?.n ?? 0
  );
}

export function markNotificationRead(userId: number, id: number, now = Date.now()): void {
  db.update(notifications)
    .set({ readAt: new Date(now) })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)),
    )
    .run();
}

export function markAllNotificationsRead(userId: number, now = Date.now()): void {
  db.update(notifications)
    .set({ readAt: new Date(now) })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .run();
}

export function announcementRecipientIds(input: {
  authorId: number;
  audience: "ALL" | "DEPARTMENT" | "USERS";
  departmentId?: number | null;
  userIds?: number[];
}): number[] {
  let ids: number[] = [];
  if (input.audience === "ALL") {
    ids = db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
      .all()
      .map((row) => row.id);
  } else if (input.audience === "DEPARTMENT" && input.departmentId) {
    ids = userIdsInDepartments([input.departmentId], { activeOnly: true });
  } else if (input.audience === "USERS" && input.userIds && input.userIds.length > 0) {
    ids = db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.id, input.userIds),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .all()
      .map((row) => row.id);
  }
  return [...new Set(ids.filter((id) => id !== input.authorId))];
}

export function notifyAnnouncement(input: {
  announcementId: number;
  authorId: number;
  title: string;
  body: string;
  audience: "ALL" | "DEPARTMENT" | "USERS";
  departmentId?: number | null;
  userIds?: number[];
}): number[] {
  const recipients = announcementRecipientIds(input);
  return createInAppNotifications(
    recipients.map((userId) => ({
      userId,
      type: "announcement.new" as const,
      title: input.title,
      body: input.body,
      url: "/me/info",
      entityType: "announcement",
      entityId: input.announcementId,
      groupKey: `announcement:${input.announcementId}`,
      priority: "NORMAL" as const,
    })),
  );
}

export const NOTIFICATION_PAGE_SIZE = PAGE_SIZE;

export function notificationPageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
