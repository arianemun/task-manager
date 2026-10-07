import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  conversationMembers,
  conversations,
  departments,
  mediaJobs,
  messageAttachments,
  messages,
  userDepartments,
  users,
  type ConversationMemberRole,
} from "@/db/schema";
import { fa } from "@/lib/i18n/fa";
import { ChatError } from "./errors";
import { sniffMedia } from "./media-sniff";
import { assertSendRate } from "./rate-limit";
import {
  CHAT_BODY_MAX,
  CHAT_EDIT_WINDOW_MS,
  CHAT_IMAGE_MAX_BYTES,
  CHAT_PAGE_SIZE,
  CHAT_VIDEO_MAX_BYTES,
  type ChatAttachment,
  type ChatMessage,
  type ConversationSummary,
} from "./types";

export function pairKey(a: number, b: number): string {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return `${min}:${max}`;
}

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

function activeMember(conversationId: number, userId: number) {
  return db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
        isNull(conversationMembers.leftAt),
      ),
    )
    .get();
}

export function assertConversationMember(
  conversationId: number,
  userId: number,
): void {
  if (!activeMember(conversationId, userId)) {
    throw new ChatError("به این گفتگو دسترسی ندارید");
  }
}

function mapMessage(
  row: {
    id: number;
    conversationId: number;
    senderId: number;
    senderName: string;
    senderActive: boolean;
    senderDeleted: Date | null;
    type: ChatMessage["type"];
    body: string | null;
    clientId: string;
    editedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    replyToId: number | null;
  },
  reply: ChatMessage["replyTo"],
  attachment: ChatMessage["attachment"] = null,
): ChatMessage {
  const deleted = row.deletedAt != null;
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    senderName: row.senderName,
    senderActive: row.senderActive && row.senderDeleted == null,
    type: row.type,
    body: deleted ? null : row.body,
    attachment: deleted ? null : (attachment ?? null),
    replyTo: reply,
    clientId: row.clientId,
    editedAt: row.editedAt?.getTime() ?? null,
    deletedAt: row.deletedAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
  };
}

function uploadRoot(): string {
  const dir = process.env.UPLOAD_DIR ?? "./uploads";
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

function toAttachment(row: {
  id: number;
  kind: string;
  status: ChatAttachment["status"];
  path: string;
  thumbPath: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}): ChatAttachment {
  const ready = row.status === "READY";
  return {
    id: row.id,
    kind: row.kind === "video" ? "video" : "image",
    status: row.status,
    url: ready ? `/api/files/${row.path}` : null,
    thumbUrl: ready && row.thumbPath ? `/api/files/${row.thumbPath}` : null,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
  };
}

function attachmentFor(messageId: number, deleted: boolean): ChatAttachment | null {
  if (deleted) return null;
  const row = db
    .select()
    .from(messageAttachments)
    .where(eq(messageAttachments.messageId, messageId))
    .get();
  return row ? toAttachment(row) : null;
}

function attachmentsForMessages(ids: number[]): Map<number, ChatAttachment> {
  const map = new Map<number, ChatAttachment>();
  if (ids.length === 0) return map;
  const rows = db
    .select()
    .from(messageAttachments)
    .where(inArray(messageAttachments.messageId, ids))
    .all();
  for (const row of rows) {
    if (row.messageId != null) map.set(row.messageId, toAttachment(row));
  }
  return map;
}

export function loadMessage(id: number): ChatMessage | null {
  const row = db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      senderName: users.fullName,
      senderActive: users.isActive,
      senderDeleted: users.deletedAt,
      type: messages.type,
      body: messages.body,
      clientId: messages.clientId,
      editedAt: messages.editedAt,
      deletedAt: messages.deletedAt,
      createdAt: messages.createdAt,
      replyToId: messages.replyToId,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(eq(messages.id, id))
    .get();
  if (!row) return null;
  return mapMessage(row, replyPreview(row.replyToId), attachmentFor(row.id, row.deletedAt != null));
}

function replyPreview(replyToId: number | null): ChatMessage["replyTo"] {
  if (replyToId == null) return null;
  const row = db
    .select({
      id: messages.id,
      body: messages.body,
      deletedAt: messages.deletedAt,
      senderName: users.fullName,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(eq(messages.id, replyToId))
    .get();
  if (!row) return null;
  const deleted = row.deletedAt != null;
  return {
    id: row.id,
    body: deleted ? null : row.body,
    senderName: row.senderName,
    deleted,
  };
}

function existingByClient(senderId: number, clientId: string): ChatMessage | null {
  const row = db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.senderId, senderId), eq(messages.clientId, clientId)))
    .get();
  return row ? loadMessage(row.id) : null;
}

export function sendTextMessage(input: {
  userId: number;
  conversationId: number;
  body: string;
  clientId: string;
  replyToId?: number | null;
  now?: number;
}): ChatMessage {
  const body = input.body.trim();
  if (!input.clientId || input.clientId.length > 80) {
    throw new ChatError("شناسه پیام نامعتبر است");
  }
  const prior = existingByClient(input.userId, input.clientId);
  if (prior) return prior;

  const sender = db
    .select({ isActive: users.isActive, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, input.userId))
    .get();
  if (!sender || !sender.isActive || sender.deletedAt) {
    throw new ChatError("حساب غیرفعال است");
  }
  assertConversationMember(input.conversationId, input.userId);
  if (!body) throw new ChatError("متن پیام خالی است");
  if (body.length > CHAT_BODY_MAX) {
    throw new ChatError("متن پیام بلندتر از حد مجاز است");
  }
  if (input.replyToId) {
    const reply = db
      .select({ conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, input.replyToId))
      .get();
    if (!reply || reply.conversationId !== input.conversationId) {
      throw new ChatError("پیام پاسخ در این گفتگو نیست");
    }
  }

  assertSendRate(input.userId, input.now ?? Date.now());
  const now = new Date(input.now ?? Date.now());

  try {
    const inserted = db
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        senderId: input.userId,
        type: "TEXT",
        body,
        replyToId: input.replyToId ?? null,
        clientId: input.clientId,
        createdAt: now,
      })
      .returning({ id: messages.id })
      .get();
    db.update(conversations)
      .set({ lastMessageId: inserted.id, updatedAt: now })
      .where(eq(conversations.id, input.conversationId))
      .run();
    db.update(conversationMembers)
      .set({ lastReadMessageId: inserted.id, lastDeliveredMessageId: inserted.id })
      .where(
        and(
          eq(conversationMembers.conversationId, input.conversationId),
          eq(conversationMembers.userId, input.userId),
        ),
      )
      .run();
    const loaded = loadMessage(inserted.id);
    if (!loaded) throw new ChatError("پیام ذخیره نشد");
    return loaded;
  } catch (error) {
    if (isUniqueError(error)) {
      const again = existingByClient(input.userId, input.clientId);
      if (again) return again;
    }
    throw error;
  }
}

export function editTextMessage(input: {
  userId: number;
  messageId: number;
  body: string;
  now?: number;
}): ChatMessage {
  const nowMs = input.now ?? Date.now();
  const row = db.select().from(messages).where(eq(messages.id, input.messageId)).get();
  if (!row || row.deletedAt) throw new ChatError("پیام پیدا نشد");
  assertConversationMember(row.conversationId, input.userId);
  if (row.senderId !== input.userId) throw new ChatError("فقط فرستنده می‌تواند ویرایش کند");
  if (row.type !== "TEXT") throw new ChatError("این پیام قابل ویرایش نیست");
  if (nowMs - row.createdAt.getTime() > CHAT_EDIT_WINDOW_MS) {
    throw new ChatError("مهلت ویرایش تمام شده است");
  }
  const body = input.body.trim();
  if (!body || body.length > CHAT_BODY_MAX) {
    throw new ChatError("متن پیام نامعتبر است");
  }
  db.update(messages)
    .set({ body, editedAt: new Date(nowMs) })
    .where(eq(messages.id, row.id))
    .run();
  const loaded = loadMessage(row.id);
  if (!loaded) throw new ChatError("پیام ذخیره نشد");
  return loaded;
}

export function deleteMessageForEveryone(input: {
  userId: number;
  messageId: number;
  now?: number;
}): ChatMessage {
  const row = db.select().from(messages).where(eq(messages.id, input.messageId)).get();
  if (!row) throw new ChatError("پیام پیدا نشد");
  assertConversationMember(row.conversationId, input.userId);
  if (row.senderId !== input.userId) throw new ChatError("فقط فرستنده می‌تواند حذف کند");
  if (!row.deletedAt) {
    db.update(messages)
      .set({ deletedAt: new Date(input.now ?? Date.now()) })
      .where(eq(messages.id, row.id))
      .run();
  }
  const loaded = loadMessage(row.id);
  if (!loaded) throw new ChatError("پیام ذخیره نشد");
  return loaded;
}

export function listMessages(input: {
  userId: number;
  conversationId: number;
  beforeId?: number | null;
  limit?: number;
}): ChatMessage[] {
  assertConversationMember(input.conversationId, input.userId);
  const limit = input.limit ?? CHAT_PAGE_SIZE;
  const rows = db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      senderName: users.fullName,
      senderActive: users.isActive,
      senderDeleted: users.deletedAt,
      type: messages.type,
      body: messages.body,
      clientId: messages.clientId,
      editedAt: messages.editedAt,
      deletedAt: messages.deletedAt,
      createdAt: messages.createdAt,
      replyToId: messages.replyToId,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(
      and(
        eq(messages.conversationId, input.conversationId),
        input.beforeId ? lt(messages.id, input.beforeId) : undefined,
      ),
    )
    .orderBy(desc(messages.id))
    .limit(limit)
    .all()
    .reverse();

  const replyIds = [
    ...new Set(rows.map((r) => r.replyToId).filter((id): id is number => id != null)),
  ];
  const replies = new Map<number, ChatMessage["replyTo"]>();
  if (replyIds.length > 0) {
    const found = db
      .select({
        id: messages.id,
        body: messages.body,
        deletedAt: messages.deletedAt,
        senderName: users.fullName,
      })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(inArray(messages.id, replyIds))
      .all();
    for (const row of found) {
      const deleted = row.deletedAt != null;
      replies.set(row.id, {
        id: row.id,
        body: deleted ? null : row.body,
        senderName: row.senderName,
        deleted,
      });
    }
  }
  const ids = rows.map((row) => row.id);
  const attachments = attachmentsForMessages(ids);
  return rows.map((row) =>
    mapMessage(
      row,
      row.replyToId ? (replies.get(row.replyToId) ?? null) : null,
      row.deletedAt ? null : (attachments.get(row.id) ?? null),
    ),
  );
}

export function listMessagesAfter(input: {
  userId: number;
  conversationId: number;
  afterId: number;
}): ChatMessage[] {
  assertConversationMember(input.conversationId, input.userId);
  const rows = db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, input.conversationId),
        sql`${messages.id} > ${input.afterId}`,
      ),
    )
    .orderBy(messages.id)
    .limit(200)
    .all();
  return rows
    .map((row) => loadMessage(row.id))
    .filter((row): row is ChatMessage => row != null);
}

export function markDelivered(
  userId: number,
  conversationId: number,
  messageId: number,
): void {
  const member = activeMember(conversationId, userId);
  if (!member) return;
  const current = member.lastDeliveredMessageId ?? 0;
  if (messageId <= current) return;
  db.update(conversationMembers)
    .set({ lastDeliveredMessageId: messageId })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .run();
}

export function memberReceipts(conversationId: number): Array<{
  userId: number;
  deliveredId: number;
  readId: number;
}> {
  return db
    .select({
      userId: conversationMembers.userId,
      deliveredId: conversationMembers.lastDeliveredMessageId,
      readId: conversationMembers.lastReadMessageId,
    })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        isNull(conversationMembers.leftAt),
      ),
    )
    .all()
    .map((row) => ({
      userId: row.userId,
      deliveredId: row.deliveredId ?? 0,
      readId: row.readId ?? 0,
    }));
}

export function markRead(userId: number, conversationId: number, messageId: number): void {
  const member = activeMember(conversationId, userId);
  if (!member) return;
  const current = member.lastReadMessageId ?? 0;
  if (messageId <= current) return;
  db.update(conversationMembers)
    .set({ lastReadMessageId: messageId, lastDeliveredMessageId: messageId })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .run();
}

export function activeMemberIds(conversationId: number): number[] {
  return db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        isNull(conversationMembers.leftAt),
      ),
    )
    .all()
    .map((row) => row.userId);
}

export function conversationIdsForUser(userId: number): number[] {
  return db
    .select({ id: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(
      and(eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt)),
    )
    .all()
    .map((row) => row.id);
}

export function getConversationForUser(
  userId: number,
  conversationId: number,
): ConversationSummary | null {
  return (
    listConversations(userId).find((row) => row.id === conversationId) ?? null
  );
}

export function listConversations(userId: number): ConversationSummary[] {
  const memberships = db
    .select()
    .from(conversationMembers)
    .where(
      and(eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt)),
    )
    .all();
  if (memberships.length === 0) return [];

  const ids = memberships.map((m) => m.conversationId);
  const convs = db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, ids))
    .all();
  const others = db
    .select({
      conversationId: conversationMembers.conversationId,
      userId: users.id,
      fullName: users.fullName,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      avatarPath: users.avatarPath,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(
      and(
        inArray(conversationMembers.conversationId, ids),
        ne(conversationMembers.userId, userId),
        isNull(conversationMembers.leftAt),
      ),
    )
    .all();

  const lastIds = convs
    .map((c) => c.lastMessageId)
    .filter((id): id is number => id != null);
  const lastRows =
    lastIds.length === 0
      ? []
      : db
          .select({
            id: messages.id,
            type: messages.type,
            body: messages.body,
            deletedAt: messages.deletedAt,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(inArray(messages.id, lastIds))
          .all();

  return convs
    .map((conv) => {
      const mine = memberships.find((m) => m.conversationId === conv.id);
      const peer = others.find((o) => o.conversationId === conv.id);
      const last = lastRows.find((m) => m.id === conv.lastMessageId);
      const readUpTo = mine?.lastReadMessageId ?? 0;
      const unread = db
        .select({ n: sql<number>`count(*)` })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conv.id),
            sql`${messages.id} > ${readUpTo}`,
            ne(messages.senderId, userId),
            isNull(messages.deletedAt),
          ),
        )
        .get();
      const title =
        conv.type === "DIRECT"
          ? (peer?.fullName ?? "گفتگو")
          : (conv.title ?? "گروه");
      return {
        id: conv.id,
        type: conv.type,
        title,
        avatarPath: conv.type === "DIRECT" ? (peer?.avatarPath ?? null) : conv.avatarPath,
        peerActive: conv.type === "GROUP" ? true : Boolean(peer?.isActive && !peer.deletedAt),
        lastBody: last?.deletedAt
          ? null
          : last?.body ||
            (last?.type === "IMAGE"
              ? fa.chat.photo
              : last?.type === "VIDEO"
                ? fa.chat.video
                : null),
        lastAt: last?.createdAt.getTime() ?? conv.updatedAt.getTime(),
        unread: Number(unread?.n ?? 0),
        pinned: mine?.pinned ?? false,
        lastReadMessageId: mine?.lastReadMessageId ?? null,
        peerId: conv.type === "DIRECT" ? (peer?.userId ?? null) : null,
      } satisfies ConversationSummary;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastAt ?? 0) - (a.lastAt ?? 0);
    });
}

export function countUnreadChats(userId: number): number {
  return listConversations(userId).reduce((sum, row) => sum + row.unread, 0);
}

function addMember(
  conversationId: number,
  userId: number,
  role: ConversationMemberRole,
): void {
  const existing = db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .get();
  if (!existing) {
    db.insert(conversationMembers)
      .values({ conversationId, userId, role, joinedAt: new Date() })
      .run();
    return;
  }
  if (existing.leftAt) {
    db.update(conversationMembers)
      .set({ leftAt: null, joinedAt: new Date(), role })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
        ),
      )
      .run();
  }
}

export function createDirectConversation(userId: number, peerId: number): number {
  if (userId === peerId) throw new ChatError("گفتگو با خودتان ممکن نیست");
  const peer = db
    .select({ isActive: users.isActive, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, peerId))
    .get();
  if (!peer || !peer.isActive || peer.deletedAt) {
    throw new ChatError("این کاربر فعال نیست");
  }
  const key = pairKey(userId, peerId);
  const existing = db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.pairKey, key))
    .get();
  if (existing) {
    addMember(existing.id, userId, "MEMBER");
    addMember(existing.id, peerId, "MEMBER");
    return existing.id;
  }
  try {
    const created = db
      .insert(conversations)
      .values({
        type: "DIRECT",
        createdBy: userId,
        pairKey: key,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: conversations.id })
      .get();
    addMember(created.id, userId, "MEMBER");
    addMember(created.id, peerId, "MEMBER");
    return created.id;
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    const again = db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.pairKey, key))
      .get();
    if (!again) throw error;
    return again.id;
  }
}

export function createGroupConversation(input: {
  userId: number;
  title: string;
  memberIds: number[];
}): number {
  const title = input.title.trim();
  if (!title) throw new ChatError("نام گروه لازم است");
  const ids = [...new Set(input.memberIds.filter((id) => id !== input.userId))];
  const created = db
    .insert(conversations)
    .values({
      type: "GROUP",
      title,
      createdBy: input.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: conversations.id })
    .get();
  addMember(created.id, input.userId, "OWNER");
  for (const id of ids) addMember(created.id, id, "MEMBER");
  return created.id;
}

export function createDepartmentConversation(input: {
  userId: number;
  departmentId: number;
}): number {
  const existing = db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.departmentId, input.departmentId))
    .get();
  if (existing) return existing.id;
  const dept = db
    .select({ name: departments.name })
    .from(departments)
    .where(eq(departments.id, input.departmentId))
    .get();
  if (!dept) throw new ChatError("دپارتمان پیدا نشد");
  const created = db
    .insert(conversations)
    .values({
      type: "GROUP",
      title: dept.name,
      createdBy: input.userId,
      departmentId: input.departmentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: conversations.id })
    .get();
  addMember(created.id, input.userId, "OWNER");
  syncDepartmentChat(input.departmentId);
  return created.id;
}

export function syncDepartmentChat(departmentId: number): void {
  const conv = db
    .select()
    .from(conversations)
    .where(eq(conversations.departmentId, departmentId))
    .get();
  if (!conv) return;
  const members = departmentUserIds(departmentId);
  const wantedIds = new Set(members);
  const current = db
    .select()
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conv.id))
    .all();
  const now = new Date();
  for (const row of current) {
    if (wantedIds.has(row.userId)) {
      if (row.leftAt) {
        db.update(conversationMembers)
          .set({ leftAt: null, joinedAt: now })
          .where(
            and(
              eq(conversationMembers.conversationId, conv.id),
              eq(conversationMembers.userId, row.userId),
            ),
          )
          .run();
      }
    } else if (!row.leftAt && row.userId !== conv.createdBy) {
      db.update(conversationMembers)
        .set({ leftAt: now })
        .where(
          and(
            eq(conversationMembers.conversationId, conv.id),
            eq(conversationMembers.userId, row.userId),
          ),
        )
        .run();
    }
  }
  for (const userId of wantedIds) {
    if (!current.some((row) => row.userId === userId)) {
      addMember(conv.id, userId, "MEMBER");
    }
  }
}

function departmentUserIds(departmentId: number): number[] {
  return db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userDepartments, eq(userDepartments.userId, users.id))
    .where(
      and(
        eq(userDepartments.departmentId, departmentId),
        isNull(userDepartments.leftAt),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .all()
    .map((row) => row.id);
}

export function listActivePeers(userId: number): Array<{ id: number; fullName: string }> {
  return db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(ne(users.id, userId), eq(users.isActive, true), isNull(users.deletedAt)))
    .orderBy(users.fullName)
    .all();
}

export function listDepartmentsForChat(): Array<{ id: number; name: string }> {
  return db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .orderBy(departments.name)
    .all();
}

export async function createMediaMessage(input: {
  userId: number;
  conversationId: number;
  clientId: string;
  bytes: Buffer;
  now?: number;
}): Promise<ChatMessage> {
  if (!input.clientId || input.clientId.length > 80) {
    throw new ChatError("شناسه پیام نامعتبر است");
  }
  const prior = existingByClient(input.userId, input.clientId);
  if (prior) return prior;
  const sender = db
    .select({ isActive: users.isActive, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, input.userId))
    .get();
  if (!sender || !sender.isActive || sender.deletedAt) {
    throw new ChatError("حساب غیرفعال است");
  }
  assertConversationMember(input.conversationId, input.userId);
  const sniffed = sniffMedia(input.bytes);
  if (!sniffed) throw new ChatError("فقط عکس jpg یا png یا webp، یا ویدیو mp4 یا webm مجاز است");
  const limit = sniffed.kind === "video" ? CHAT_VIDEO_MAX_BYTES : CHAT_IMAGE_MAX_BYTES;
  if (input.bytes.length <= 0 || input.bytes.length > limit) {
    throw new ChatError(
      sniffed.kind === "video"
        ? "حجم ویدیو حداکثر ۱۰۰ مگابایت است"
        : "حجم عکس حداکثر ۱۲ مگابایت است",
    );
  }
  assertSendRate(input.userId, input.now ?? Date.now());
  const now = new Date(input.now ?? Date.now());
  const relDir = path.join("chat", String(input.conversationId));
  const filename = `${randomBytes(8).toString("hex")}.${sniffed.ext}`;
  const relative = path.join(relDir, filename).replace(/\\/g, "/");
  const absDir = path.join(uploadRoot(), relDir);
  await fs.mkdir(absDir, { recursive: true });
  await fs.writeFile(path.join(absDir, filename), input.bytes);
  const mime =
    sniffed.ext === "png"
      ? "image/png"
      : sniffed.ext === "webp"
        ? "image/webp"
        : sniffed.ext === "webm"
          ? "video/webm"
          : sniffed.kind === "video"
            ? "video/mp4"
            : "image/jpeg";
  try {
    const inserted = db
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        senderId: input.userId,
        type: sniffed.kind === "video" ? "VIDEO" : "IMAGE",
        body: null,
        clientId: input.clientId,
        createdAt: now,
      })
      .returning({ id: messages.id })
      .get();
    const attachment = db
      .insert(messageAttachments)
      .values({
        messageId: inserted.id,
        uploaderId: input.userId,
        kind: sniffed.kind,
        mime,
        size: input.bytes.length,
        path: relative,
        status: "PROCESSING",
        createdAt: now,
      })
      .returning({ id: messageAttachments.id })
      .get();
    db.insert(mediaJobs)
      .values({ attachmentId: attachment.id, status: "PENDING", createdAt: now, updatedAt: now })
      .run();
    db.update(conversations)
      .set({ lastMessageId: inserted.id, updatedAt: now })
      .where(eq(conversations.id, input.conversationId))
      .run();
    const loaded = loadMessage(inserted.id);
    if (!loaded) throw new ChatError("پیام ذخیره نشد");
    return loaded;
  } catch (error) {
    if (isUniqueError(error)) {
      const again = existingByClient(input.userId, input.clientId);
      if (again) return again;
    }
    throw error;
  }
}
