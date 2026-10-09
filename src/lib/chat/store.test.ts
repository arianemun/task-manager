import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { and, eq } from "drizzle-orm";
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

  it("احراز هویت سوکت: کوکی معتبر، نامعتبر، نسخه قدیمی و کاربر غیرفعال", async () => {
    const { a, db, schema } = await seedPair();
    const { createSessionToken } = await import("@/lib/auth/jwt");
    const { startRealtimeServer } = await import("../../../realtime/server");
    const server = startRealtimeServer(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const sockets: Socket[] = [];

    function open(token: string) {
      const socket = connect(port, token);
      sockets.push(socket);
      return socket;
    }

    function rejected(socket: Socket): Promise<void> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("باید رد می‌شد")), 4000);
        socket.on("connect", () => {
          clearTimeout(timer);
          reject(new Error("اتصال نباید برقرار شود"));
        });
        socket.on("connect_error", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    try {
      const valid = open(await createSessionToken(a.id, 1));
      await waitConnect(valid);
      await rejected(open("not-a-jwt"));
      await rejected(open(await createSessionToken(a.id, 0)));
      db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, a.id)).run();
      await rejected(open(await createSessionToken(a.id, 1)));
    } finally {
      for (const socket of sockets) socket.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("قطع سوکت بلافاصله آفلاین نیست و بعد از مهلت آفلاین می‌شود", async () => {
    process.env.PRESENCE_OFFLINE_MS = "200";
    const { a, b } = await seedPair();
    const store = await import("@/lib/chat/store");
    const { createSessionToken } = await import("@/lib/auth/jwt");
    const { startRealtimeServer } = await import("../../../realtime/server");
    store.createDirectConversation(a.id, b.id);
    const server = startRealtimeServer(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const clientA = connect(port, await createSessionToken(a.id, 1));
    const clientB = connect(port, await createSessionToken(b.id, 1));
    const offline = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("offline timeout")), 4000);
      clientB.on("presence", (event: { userId: number; online: boolean }) => {
        if (event.userId === a.id && event.online === false) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    try {
      await Promise.all([waitConnect(clientA), waitConnect(clientB)]);
      const online = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("online timeout")), 4000);
        clientB.on("presence", (event: { userId: number; online: boolean }) => {
          if (event.userId === a.id && event.online) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      clientA.emit("presence:foreground");
      await online;
      clientA.disconnect();
      const early = await Promise.race([
        offline.then(() => "offline"),
        new Promise((resolve) => setTimeout(() => resolve("still"), 80)),
      ]);
      expect(early).toBe("still");
      await offline;
    } finally {
      delete process.env.PRESENCE_OFFLINE_MS;
      clientA.close();
      clientB.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("پس‌زمینه Push می‌گیرد و جلوی چشم بودن جلوی Push را می‌گیرد", async () => {
    const { a, b } = await seedPair();
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const store = await import("@/lib/chat/store");
    const { createSessionToken } = await import("@/lib/auth/jwt");
    const { startRealtimeServer } = await import("../../../realtime/server");
    const id = store.createDirectConversation(a.id, b.id);
    const server = startRealtimeServer(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const clientA = connect(port, await createSessionToken(a.id, 1));
    const clientA2 = connect(port, await createSessionToken(a.id, 1));
    const clientB = connect(port, await createSessionToken(b.id, 1));
    function send(body: string) {
      return new Promise<void>((resolve, reject) => {
        clientB.emit(
          "message:send",
          { conversationId: id, body, clientId: body },
          (ack: { ok?: boolean; error?: string }) => {
            if (ack?.ok) resolve();
            else reject(new Error(ack?.error || "ارسال نشد"));
          },
        );
      });
    }
    function waitPresence(online: boolean) {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("presence timeout")), 4000);
        const onPresence = (event: { userId: number; online: boolean }) => {
          if (event.userId !== a.id || event.online !== online) return;
          clearTimeout(timer);
          clientB.off("presence", onPresence);
          resolve();
        };
        clientB.on("presence", onPresence);
      });
    }
    function countForA() {
      return db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, a.id))
        .all().length;
    }
    try {
      await Promise.all([waitConnect(clientA), waitConnect(clientA2), waitConnect(clientB)]);
      const online = waitPresence(true);
      clientA.emit("presence:foreground");
      await online;
      clientA.emit("conversation:focus", { conversationId: id });
      await new Promise((resolve) => setTimeout(resolve, 50));
      await send("روی همان گفتگو");
      expect(countForA()).toBe(0);

      const away = waitPresence(false);
      clientA.emit("presence:background");
      await away;
      await send("در پس‌زمینه");
      expect(countForA()).toBe(1);
      const seen = db.select().from(schema.users).where(eq(schema.users.id, a.id)).get();
      expect(seen?.lastSeenAt).toBeTruthy();

      const back = waitPresence(true);
      clientA2.emit("presence:foreground");
      await back;
      await send("دستگاه دیگر جلو است");
      expect(countForA()).toBe(1);
    } finally {
      clientA.close();
      clientA2.close();
      clientB.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
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
      const { db } = await import("@/db");
      const schema = await import("@/db/schema");
      const delivered = db
        .select({ id: schema.conversationMembers.lastDeliveredMessageId })
        .from(schema.conversationMembers)
        .where(
          and(
            eq(schema.conversationMembers.conversationId, id),
            eq(schema.conversationMembers.userId, b.id),
          ),
        )
        .get();
      expect(delivered?.id ?? 0).toBeGreaterThan(0);

      let senderSawTyping = false;
      clientA.on("typing", () => {
        senderSawTyping = true;
      });
      const typed = new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("typing timeout")), 4000);
        clientB.on("typing", (event: { userId: number; active: boolean }) => {
          if (event.userId !== a.id || !event.active) return;
          clearTimeout(timer);
          resolve(event.userId);
        });
      });
      clientA.emit("typing", { conversationId: id, active: true });
      expect(await typed).toBe(a.id);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(senderSawTyping).toBe(false);

      const closed = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("disconnect timeout")), 4000);
        clientA.on("disconnect", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, a.id)).run();
      process.env.REALTIME_PORT = String(port);
      const { bumpSessionVersion } = await import("@/lib/auth/user");
      bumpSessionVersion(a.id);
      await closed;
      const stale = connect(port, await createSessionToken(a.id, 1));
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("باید رد می‌شد")), 4000);
        stale.on("connect", () => {
          clearTimeout(timer);
          reject(new Error("اتصال نباید برقرار شود"));
        });
        stale.on("connect_error", () => {
          clearTimeout(timer);
          stale.close();
          resolve();
        });
      });
    } finally {
      delete process.env.REALTIME_PORT;
      clientA.close();
      clientB.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
