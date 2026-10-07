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

const sendSchema = z.object({
  conversationId: z.number().int().positive(),
  body: z.string(),
  clientId: z.string().min(1).max(80),
  replyToId: z.number().int().positive().nullable().optional(),
});

const editSchema = z.object({
  messageId: z.number().int().positive(),
  body: z.string(),
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

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
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
      const body = (await readJson(req)) as {
        userId?: number;
        conversationId?: number;
        userIds?: number[];
      };
      if (req.url === "/internal/disconnect" && req.method === "POST") {
        if (body.userId) io.in(`user:${body.userId}`).disconnectSockets(true);
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.url === "/internal/join" && req.method === "POST") {
        if (body.conversationId && Array.isArray(body.userIds)) {
          for (const userId of body.userIds) {
            io.in(`user:${userId}`).socketsJoin(`conversation:${body.conversationId}`);
          }
        }
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

  const onlineCounts = new Map<number, number>();
  const offlineTimers = new Map<number, ReturnType<typeof setTimeout>>();

  function emitReceipt(conversationId: number) {
    io.to(`conversation:${conversationId}`).emit("receipt", {
      conversationId,
      members: memberReceipts(conversationId),
    });
  }

  function noteOnline(id: number) {
    const next = (onlineCounts.get(id) ?? 0) + 1;
    onlineCounts.set(id, next);
    const pending = offlineTimers.get(id);
    if (pending) clearTimeout(pending);
    offlineTimers.delete(id);
    if (next === 1) io.emit("presence", { userId: id, online: true });
  }

  function noteOffline(id: number) {
    const next = Math.max(0, (onlineCounts.get(id) ?? 1) - 1);
    onlineCounts.set(id, next);
    if (next > 0) return;
    const wait = Number(process.env.PRESENCE_OFFLINE_MS || 15_000);
    const timer = setTimeout(() => {
      offlineTimers.delete(id);
      if ((onlineCounts.get(id) ?? 0) === 0) {
        io.emit("presence", { userId: id, online: false });
      }
    }, wait);
    offlineTimers.set(id, timer);
  }

  function deliverToOnline(conversationId: number, messageId: number, senderId: number) {
    for (const memberId of activeMemberIds(conversationId)) {
      if (memberId !== senderId && (onlineCounts.get(memberId) ?? 0) > 0) {
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
    noteOnline(userId);
    socket.emit(
      "presence:snapshot",
      [...onlineCounts.entries()].filter(([, count]) => count > 0).map(([id]) => id),
    );

    const timer = setInterval(() => {
      if (!sessionStillValid(userId, sessionVersion)) socket.disconnect(true);
    }, 5 * 60 * 1000);
    socket.on("disconnect", () => {
      clearInterval(timer);
      noteOffline(userId);
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
      if (!parsed.success) return;
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

  httpServer.listen(port);
  return httpServer;
}

if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  const port = Number(process.env.REALTIME_PORT || 3231);
  startRealtimeServer(port);
  console.log(`realtime ${port}`);
}
