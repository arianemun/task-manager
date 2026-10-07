import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";

describe("گفتگوی متنی", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-chat-"));
    dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    process.env.INTERNAL_SECRET = "test-internal-secret";
    vi.resetModules();
    execSync("npx drizzle-kit migrate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
  });

  afterEach(async () => {
    const rate = await import("@/lib/chat/rate-limit");
    rate.resetSendRate();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function seedPair() {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    function user(username: string, fullName: string) {
      return db
        .insert(schema.users)
        .values({
          username,
          passwordHash: "x",
          role: "STAFF",
          fullName,
          fullNameNormalized: fullName,
          mustChangePassword: false,
          isActive: true,
        })
        .returning({ id: schema.users.id })
        .get();
    }
    return {
      db,
      schema,
      a: user("a", "آزاده"),
      b: user("b", "بهروز"),
      c: user("c", "کامران"),
    };
  }

  function connect(port: number, token: string): Socket {
    return io(`http://127.0.0.1:${port}`, {
      extraHeaders: { cookie: `tm_session=${token}` },
      transports: ["websocket"],
    });
  }

  function waitConnect(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("connect timeout")), 4000);
      socket.on("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on("connect_error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  it("client_id تکراری پیام دوم نمی‌سازد و غیرعضو نمی‌تواند بفرستد", async () => {
    const { a, b, c } = await seedPair();
    const store = await import("@/lib/chat/store");
    const id = store.createDirectConversation(a.id, b.id);
    expect(store.createDirectConversation(b.id, a.id)).toBe(id);

    const first = store.sendTextMessage({
      userId: a.id,
      conversationId: id,
      body: "سلام",
      clientId: "same",
    });
    const second = store.sendTextMessage({
      userId: a.id,
      conversationId: id,
      body: "سلام دوباره",
      clientId: "same",
    });
    expect(second.id).toBe(first.id);
    expect(second.body).toBe("سلام");

    expect(() =>
      store.sendTextMessage({
        userId: c.id,
        conversationId: id,
        body: "نه",
        clientId: "other",
      }),
    ).toThrow(/دسترسی/);
  });

  it("ویرایش بعد از ۱۵ دقیقه رد می‌شود", async () => {
    const { a, b } = await seedPair();
    const store = await import("@/lib/chat/store");
    const id = store.createDirectConversation(a.id, b.id);
    const message = store.sendTextMessage({
      userId: a.id,
      conversationId: id,
      body: "قدیمی",
      clientId: "old",
      now: Date.now() - 16 * 60 * 1000,
    });
    expect(() =>
      store.editTextMessage({
        userId: a.id,
        messageId: message.id,
        body: "جدید",
        now: Date.now(),
      }),
    ).toThrow(/مهلت/);
  });

  it("کاربر غیرفعال پیام جدید نمی‌فرستد", async () => {
    const { a, b, db, schema } = await seedPair();
    const store = await import("@/lib/chat/store");
    const id = store.createDirectConversation(a.id, b.id);
    db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, a.id)).run();
    expect(() =>
      store.sendTextMessage({
        userId: a.id,
        conversationId: id,
        body: "بعد از غیرفعال",
        clientId: "late",
      }),
    ).toThrow(/غیرفعال/);
  });

  it("سوکت پیام را به عضو دیگر می‌رساند و قطع داخلی سوکت را می‌بندد", async () => {
    const { a, b } = await seedPair();
    const store = await import("@/lib/chat/store");
    const { createSessionToken } = await import("@/lib/auth/jwt");
    const { startRealtimeServer } = await import("../../../realtime/server");
    const id = store.createDirectConversation(a.id, b.id);
    const server = startRealtimeServer(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const clientA = connect(port, await createSessionToken(a.id, 1));
    const clientB = connect(port, await createSessionToken(b.id, 1));

    try {
      await Promise.all([waitConnect(clientA), waitConnect(clientB)]);
      const received = new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("message timeout")), 4000);
        clientB.on("message:new", (message: { id: number; body: string }) => {
          clearTimeout(timer);
          resolve(message.id);
          expect(message.body).toBe("زنده");
        });
      });
      const ack = await new Promise<{ ok: boolean }>((resolve, reject) => {
        clientA.emit(
          "message:send",
          { conversationId: id, body: "زنده", clientId: "sock-1" },
          (result: { ok: boolean }) => resolve(result),
        );
        setTimeout(() => reject(new Error("ack timeout")), 4000);
      });
      expect(ack.ok).toBe(true);
      expect(await received).toBeGreaterThan(0);

      const closed = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("disconnect timeout")), 4000);
        clientA.on("disconnect", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      const response = await fetch(`http://127.0.0.1:${port}/internal/disconnect`, {
        method: "POST",
        headers: {
          authorization: "Bearer test-internal-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: a.id }),
      });
      expect(response.status).toBe(204);
      await closed;
    } finally {
      clientA.close();
      clientB.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
