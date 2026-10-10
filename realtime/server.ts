import "dotenv/config";
import http from "node:http";
import { eq } from "drizzle-orm";
import { Server } from "socket.io";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";
import { ChatError } from "@/lib/chat/errors";
import { allowTyping } from "@/lib/chat/rate-limit";
import { CHAT_BODY_MAX } from "@/lib/chat/types";
import { socketNotificationSchema } from "@/lib/notifications/types";
import { deliverChatPush, processPushQueue, processQuietDigests } from "@/lib/push/queue";
import { runTaskNotificationJob } from "@/lib/notifications/task-notify";
import {
  collectChatAudience,
  isSocketForeground,
  SOCKET_PING_INTERVAL_MS,
  SOCKET_PING_TIMEOUT_MS,
  type SocketForeground,
} from "@/lib/realtime/foreground";
import {
  activeMemberIds,
  assertConversationMember,
  conversationIdsForUser,
  deleteMessageForEveryone,
  editTextMessage,
  listMessagesAfter,
  markDelivered,
  markRead,
  memberReceipts,
  sendTextMessage,
} from "@/lib/chat/store";
import { processNextMediaJob } from "@/lib/chat/media-worker";

const sendSchema = z.object({
  conversationId: z.number().int().positive(),
  body: z.string().max(CHAT_BODY_MAX),
  clientId: z.string().min(1).max(80),
  replyToId: z.number().int().positive().nullable().optional(),
});

const editSchema = z.object({
  messageId: z.number().int().positive(),
  body: z.string().max(CHAT_BODY_MAX),
});

const deleteSchema = z.object({
  messageId: z.number().int().positive(),
});

const syncSchema = z.object({
  conversationId: z.number().int().positive(),
  afterId: z.number().int().min(0),
});

const watchSchema = z.object({
  conversationId: z.number().int().positive(),
});

const typingSchema = z.object({
  conversationId: z.number().int().positive(),
  active: z.boolean(),
});

const readSchema = z.object({
  conversationId: z.number().int().positive(),
  messageId: z.number().int().positive(),
});

const focusSchema = z.object({
  conversationId: z.number().int().positive().nullable(),
});

const chatFanoutSchema = z.object({
  message: z
    .object({
      id: z.number().int().positive(),
      conversationId: z.number().int().positive(),
      senderId: z.number().int().positive(),
      senderName: z.string(),
      type: z.string(),
      body: z.string().nullable(),
    })
    .passthrough(),
});

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sessionStillValid(userId: number, sessionVersion: number): boolean {
  const row = db
    .select({
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return Boolean(
    row && row.isActive && !row.deletedAt && row.sessionVersion === sessionVersion,
  );
}

const disconnectSchema = z.object({
  userId: z.number().int().positive(),
});

const joinSchema = z.object({
  conversationId: z.number().int().positive(),
  userIds: z.array(z.number().int().positive()).max(200),
});

function readJson(req: http.IncomingMessage, maxBytes = 64 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export function startRealtimeServer(port: number): http.Server {
  const httpServer = http.createServer((req, res) => {
    void handleInternal(req, res);
  });

  const allowed = (process.env.APP_ORIGIN ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const io = new Server(httpServer, {
    pingInterval: SOCKET_PING_INTERVAL_MS,
    pingTimeout: SOCKET_PING_TIMEOUT_MS,
    cors: {
      origin(origin, callback) {
        if (!origin || allowed.length === 0 || allowed.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("origin"));
      },
      credentials: true,
    },
  });

  async function handleInternal(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const path = (req.url ?? "").split("?")[0];
    if (path === "/health" && req.method === "GET") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    const secret = process.env.INTERNAL_SECRET;
    const header = req.headers.authorization;
    if (!secret || header !== `Bearer ${secret}`) {
      res.statusCode = 401;
      res.end();
      return;
    }
    try {
      const body = await readJson(req);
      if (req.url === "/internal/disconnect" && req.method === "POST") {
        const parsed = disconnectSchema.safeParse(body);
        if (!parsed.success) {
          res.statusCode = 400;
          res.end();
          return;
        }
        io.in(`user:${parsed.data.userId}`).disconnectSockets(true);
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.url === "/internal/join" && req.method === "POST") {
        const parsed = joinSchema.safeParse(body);
        if (!parsed.success) {
          res.statusCode = 400;
          res.end();
          return;
        }
        for (const userId of parsed.data.userIds) {
          io.in(`user:${userId}`).socketsJoin(`conversation:${parsed.data.conversationId}`);
        }
        res.statusCode = 204;
        res.end();
        return;
      }
      if (path === "/internal/chat-message" && req.method === "POST") {
        const parsed = chatFanoutSchema.safeParse(body);
        if (!parsed.success) {
          res.statusCode = 400;
          res.end();
          return;
        }
        const message = parsed.data.message;
        io.to(`conversation:${message.conversationId}`).emit("message:new", message);
        const audience = pushAudience(message.conversationId);
        deliverChatPush({
          conversationId: message.conversationId,
          senderId: message.senderId,
          senderName: message.senderName,
          type: message.type,
          body: message.body,
          ...audience,
        });
        res.statusCode = 204;
        res.end();
        return;
      }
      if (path === "/internal/notify" && req.method === "POST") {
        const parsed = socketNotificationSchema.safeParse(body);
        if (!parsed.success) {
          res.statusCode = 400;
          res.end();
          return;
        }
        io.to(`user:${parsed.data.userId}`).emit("notification:new", parsed.data.notification);
        res.statusCode = 204;
        res.end();
        return;
      }
      res.statusCode = 404;
      res.end();
    } catch {
      res.statusCode = 400;
      res.end();
    }
  }

  io.use(async (socket, next) => {
    const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) return next(new Error("unauthorized"));
    const session = await verifySessionToken(token);
    if (!session || !sessionStillValid(session.userId, session.sessionVersion)) {
      return next(new Error("unauthorized"));
    }
    socket.data.userId = session.userId;
    socket.data.sessionVersion = session.sessionVersion;
    next();
  });

  const connectedCounts = new Map<number, number>();
  const offlineTimers = new Map<number, ReturnType<typeof setTimeout>>();
  const shownOnline = new Set<number>();

  function emitReceipt(conversationId: number) {
    io.to(`conversation:${conversationId}`).emit("receipt", {
      conversationId,
      members: memberReceipts(conversationId),
    });
  }

  function touchLastSeen(id: number, now = Date.now()) {
    db.update(users).set({ lastSeenAt: new Date(now) }).where(eq(users.id, id)).run();
  }

  function socketForeground(socket: { data: Record<string, unknown> }): SocketForeground {
    return {
      userId: socket.data.userId as number,
      backgrounded: Boolean(socket.data.backgrounded),
      foregroundAt: (socket.data.foregroundAt as number | null) ?? null,
      focusConversation: (socket.data.focusConversation as number | null) ?? null,
    };
  }

  function userIsForeground(id: number, now = Date.now()): boolean {
    for (const socket of io.sockets.sockets.values()) {
      if ((socket.data.userId as number) !== id) continue;
      if (isSocketForeground(socketForeground(socket), now)) return true;
    }
    return false;
  }

  function foregroundIds(now = Date.now()): number[] {
    return collectChatAudience(
      [...io.sockets.sockets.values()].map((socket) => socketForeground(socket)),
      -1,
      now,
    ).foregroundUserIds;
  }

  function syncPresence(id: number, now = Date.now()) {
    if (userIsForeground(id, now)) {
      const pending = offlineTimers.get(id);
      if (pending) clearTimeout(pending);
      offlineTimers.delete(id);
      if (!shownOnline.has(id)) {
        shownOnline.add(id);
        io.emit("presence", { userId: id, online: true });
      }
      return;
    }
    if ((connectedCounts.get(id) ?? 0) === 0) {
      if (!shownOnline.has(id) || offlineTimers.has(id)) return;
      const wait = Number(process.env.PRESENCE_OFFLINE_MS || 15_000);
      const timer = setTimeout(() => {
        offlineTimers.delete(id);
        if ((connectedCounts.get(id) ?? 0) === 0 && !userIsForeground(id)) {
          shownOnline.delete(id);
          touchLastSeen(id);
          io.emit("presence", { userId: id, online: false });
        }
      }, wait);
      offlineTimers.set(id, timer);
      return;
    }
    const pending = offlineTimers.get(id);
    if (pending) clearTimeout(pending);
    offlineTimers.delete(id);
    if (!shownOnline.has(id)) return;
    shownOnline.delete(id);
    touchLastSeen(id, now);
    io.emit("presence", { userId: id, online: false });
  }

  function pushAudience(conversationId: number) {
    const audience = collectChatAudience(
      [...io.sockets.sockets.values()].map((socket) => socketForeground(socket)),
      conversationId,
      Date.now(),
    );
    return {
      foregroundUserIds: audience.foregroundUserIds,
      viewingUserIds: audience.viewingUserIds,
    };
  }

  function deliverToOnline(conversationId: number, messageId: number, senderId: number) {
    for (const memberId of activeMemberIds(conversationId)) {
      if (memberId !== senderId && (connectedCounts.get(memberId) ?? 0) > 0) {
        markDelivered(memberId, conversationId, messageId);
      }
    }
  }

  io.on("connection", (socket) => {
    const userId = socket.data.userId as number;
    const sessionVersion = socket.data.sessionVersion as number;
    socket.join(`user:${userId}`);
    for (const id of conversationIdsForUser(userId)) {
      socket.join(`conversation:${id}`);
    }
    socket.data.backgrounded = true;
    socket.data.foregroundAt = null;
    socket.data.focusConversation = null;
    connectedCounts.set(userId, (connectedCounts.get(userId) ?? 0) + 1);
    socket.emit("presence:snapshot", foregroundIds());

    const timer = setInterval(() => {
      if (!sessionStillValid(userId, sessionVersion)) socket.disconnect(true);
    }, 5 * 60 * 1000);
    socket.on("disconnect", () => {
      clearInterval(timer);
      connectedCounts.set(userId, Math.max(0, (connectedCounts.get(userId) ?? 1) - 1));
      syncPresence(userId);
    });

    socket.on("presence:foreground", () => {
      socket.data.backgrounded = false;
      socket.data.foregroundAt = Date.now();
      syncPresence(userId);
    });

    socket.on("presence:background", () => {
      socket.data.backgrounded = true;
      syncPresence(userId);
    });

    socket.on("conversation:focus", (payload) => {
      const parsed = focusSchema.safeParse(payload);
      if (!parsed.success) return;
      const conversationId = parsed.data.conversationId;
      if (conversationId) {
        try {
          assertConversationMember(conversationId, userId);
        } catch {
          return;
        }
      }
      socket.data.focusConversation = conversationId;
    });

    socket.on("conversation:watch", (payload, ack) => {
      const parsed = watchSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "درخواست نامعتبر است" });
      try {
        assertConversationMember(parsed.data.conversationId, userId);
        socket.join(`conversation:${parsed.data.conversationId}`);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof ChatError ? error.message : "خطا" });
      }
    });

    socket.on("message:send", (payload, ack) => {
      const parsed = sendSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "درخواست نامعتبر است" });
      try {
        const message = sendTextMessage({ userId, ...parsed.data });
        deliverToOnline(message.conversationId, message.id, userId);
        io.to(`conversation:${message.conversationId}`).emit("message:new", message);
        deliverChatPush({
          conversationId: message.conversationId,
          senderId: message.senderId,
          senderName: message.senderName,
          type: message.type,
          body: message.body,
          ...pushAudience(message.conversationId),
        });
        emitReceipt(message.conversationId);
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof ChatError ? error.message : "خطا" });
      }
    });

    socket.on("message:edit", (payload, ack) => {
      const parsed = editSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "درخواست نامعتبر است" });
      try {
        const message = editTextMessage({ userId, ...parsed.data });
        io.to(`conversation:${message.conversationId}`).emit("message:updated", message);
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof ChatError ? error.message : "خطا" });
      }
    });

    socket.on("message:delete", (payload, ack) => {
      const parsed = deleteSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "درخواست نامعتبر است" });
      try {
        const message = deleteMessageForEveryone({ userId, ...parsed.data });
        io.to(`conversation:${message.conversationId}`).emit("message:updated", message);
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof ChatError ? error.message : "خطا" });
      }
    });

    socket.on("typing", (payload) => {
      const parsed = typingSchema.safeParse(payload);
      if (!parsed.success || !allowTyping(userId)) return;
      try {
        assertConversationMember(parsed.data.conversationId, userId);
        const person = db
          .select({ fullName: users.fullName })
          .from(users)
          .where(eq(users.id, userId))
          .get();
        socket.to(`conversation:${parsed.data.conversationId}`).emit("typing", {
          conversationId: parsed.data.conversationId,
          userId,
          name: person?.fullName ?? "",
          active: parsed.data.active,
        });
      } catch {
        /* عضویت ندارد */
      }
    });

    socket.on("receipt:read", (payload) => {
      const parsed = readSchema.safeParse(payload);
      if (!parsed.success) return;
      try {
        assertConversationMember(parsed.data.conversationId, userId);
        markRead(userId, parsed.data.conversationId, parsed.data.messageId);
        emitReceipt(parsed.data.conversationId);
      } catch {
        /* عضویت ندارد */
      }
    });

    socket.on("sync:after", (payload, ack) => {
      const parsed = syncSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "درخواست نامعتبر است" });
      try {
        const missed = listMessagesAfter({ userId, ...parsed.data });
        const last = missed.at(-1);
        if (last) markDelivered(userId, parsed.data.conversationId, last.id);
        ack?.({ ok: true, messages: missed });
        if (last) emitReceipt(parsed.data.conversationId);
      } catch (error) {
        ack?.({ ok: false, error: error instanceof ChatError ? error.message : "خطا" });
      }
    });
  });

  const presenceTimer = setInterval(() => {
    const ids = new Set<number>();
    for (const socket of io.sockets.sockets.values()) {
      ids.add(socket.data.userId as number);
    }
    for (const id of ids) syncPresence(id);
  }, 5000);

  let pushBusy = false;
  const pushTimer = setInterval(() => {
    if (pushBusy) return;
    pushBusy = true;
    void processPushQueue()
      .then(() => processQuietDigests())
      .catch(() => undefined)
      .finally(() => {
        pushBusy = false;
      });
  }, 5000);

  let taskBusy = false;
  const runTasks = () => {
    if (taskBusy) return;
    taskBusy = true;
    try {
      runTaskNotificationJob();
    } catch {
      /* دور بعد دوباره */
    } finally {
      taskBusy = false;
    }
  };
  runTasks();
  const taskTimer = setInterval(runTasks, 60_000);

  const mediaTimer = setInterval(() => {
    void processNextMediaJob()
      .then((message) => {
        if (!message) return;
        io.to(`conversation:${message.conversationId}`).emit("message:updated", message);
      })
      .catch(() => undefined);
  }, 2000);
  httpServer.on("close", () => {
    clearInterval(mediaTimer);
    clearInterval(pushTimer);
    clearInterval(presenceTimer);
    clearInterval(taskTimer);
  });

  httpServer.listen(port);
  return httpServer;
}

if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  const port = Number(process.env.REALTIME_PORT || 3231);
  startRealtimeServer(port);
  console.log(`realtime ${port}`);
}
