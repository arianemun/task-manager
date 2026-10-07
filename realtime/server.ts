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
  assertConversationMember,
  conversationIdsForUser,
  deleteMessageForEveryone,
  editTextMessage,
  listMessagesAfter,
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

  io.on("connection", (socket) => {
    const userId = socket.data.userId as number;
    const sessionVersion = socket.data.sessionVersion as number;
    socket.join(`user:${userId}`);
    for (const id of conversationIdsForUser(userId)) {
      socket.join(`conversation:${id}`);
    }

    const timer = setInterval(() => {
      if (!sessionStillValid(userId, sessionVersion)) socket.disconnect(true);
    }, 5 * 60 * 1000);
    socket.on("disconnect", () => clearInterval(timer));

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
        io.to(`conversation:${message.conversationId}`).emit("message:new", message);
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

    socket.on("sync:after", (payload, ack) => {
      const parsed = syncSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "درخواست نامعتبر است" });
      try {
        const missed = listMessagesAfter({ userId, ...parsed.data });
        ack?.({ ok: true, messages: missed });
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
