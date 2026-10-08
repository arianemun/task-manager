import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";

describe("مرکز اعلان", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-notify-"));
    const dbPath = path.join(tmpDir, "test.db");
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

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function user(username: string) {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    return db
      .insert(schema.users)
      .values({
        username,
        passwordHash: "x",
        role: "STAFF",
        fullName: username,
        fullNameNormalized: username,
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();
  }

  it("اعلان را ثبت می‌کند، می‌خواند و پیام چت را در زنگ نمی‌گذارد", async () => {
    delete process.env.INTERNAL_SECRET;
    const { safeInternalPath, createInAppNotifications, countUnreadNotifications, markNotificationRead, markAllNotificationsRead, listNotifications } =
      await import("./store");
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    expect(safeInternalPath("//evil")).toBeNull();
    expect(safeInternalPath("/me/info")).toBe("/me/info");
    const a = await user("notify-a");
    const b = await user("notify-b");
    const ids = createInAppNotifications([
      {
        userId: a.id,
        type: "announcement.new",
        title: "اطلاعیه",
        body: "متن",
        url: "/me/info",
      },
      {
        userId: b.id,
        type: "announcement.new",
        title: "اطلاعیه",
        body: "متن",
        url: "https://example.com",
      },
    ]);
    expect(ids).toHaveLength(2);
    expect(countUnreadNotifications(a.id)).toBe(1);
    expect(listNotifications(b.id)[0]?.url).toBeNull();
    const delivery = db
      .select({ status: schema.notificationDeliveries.status })
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.notificationId, ids[0]!))
      .get();
    expect(delivery?.status).toBe("SENT");
    markNotificationRead(a.id, ids[0]!);
    expect(countUnreadNotifications(a.id)).toBe(0);
    createInAppNotifications([
      { userId: a.id, type: "task.assigned", title: "کار", body: "جدید" },
    ]);
    markAllNotificationsRead(a.id);
    expect(countUnreadNotifications(a.id)).toBe(0);

    const chat = await import("@/lib/chat/store");
    const conversationId = chat.createDirectConversation(a.id, b.id);
    chat.sendTextMessage({
      userId: a.id,
      conversationId,
      body: "سلام",
      clientId: "notify-chat",
    });
    expect(countUnreadNotifications(b.id)).toBe(1);
  });

  it("سوکت اعلان را فقط به همان کاربر می‌رساند", async () => {
    const a = await user("sock-a");
    const b = await user("sock-b");
    const { createSessionToken } = await import("@/lib/auth/jwt");
    const { startRealtimeServer } = await import("../../../realtime/server");
    const { requestSocketNotify } = await import("@/lib/realtime/notify");
    const server = startRealtimeServer(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    process.env.REALTIME_PORT = String(port);
    const open = (token: string) =>
      io(`http://127.0.0.1:${port}`, {
        extraHeaders: { cookie: `tm_session=${token}` },
        transports: ["websocket"],
      });
    const clientA = open(await createSessionToken(a.id, 1));
    const clientB = open(await createSessionToken(b.id, 1));
    const wait = (socket: Socket) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("connect timeout")), 4000);
        socket.on("connect", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    try {
      await Promise.all([wait(clientA), wait(clientB)]);
      let leaked = false;
      clientA.on("notification:new", () => {
        leaked = true;
      });
      const received = new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("notification timeout")), 4000);
        clientB.on("notification:new", (item: { id: number; title: string }) => {
          clearTimeout(timer);
          resolve(item.id);
          expect(item.title).toBe("زنگ");
        });
      });
      requestSocketNotify(b.id, {
        id: 7,
        type: "announcement.new",
        title: "زنگ",
        body: "متن",
        url: "/me/info",
        priority: "NORMAL",
        createdAt: Date.now(),
      });
      expect(await received).toBe(7);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(leaked).toBe(false);
    } finally {
      delete process.env.REALTIME_PORT;
      clientA.close();
      clientB.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
