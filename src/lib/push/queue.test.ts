import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("صف Push", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-push-"));
    const dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
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
      })
      .returning({ id: schema.users.id })
      .get();
  }

  it("دو پیام نزدیک یک اعلان و یک ارسال می‌سازند", async () => {
    const person = await user("ali");
    const { recordOfflineChatPush } = await import("@/lib/push/queue");
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const now = Date.parse("2026-10-08T12:00:00Z");
    const first = recordOfflineChatPush({
      userId: person.id,
      conversationId: 4,
      senderName: "سارا",
      type: "TEXT",
      body: "سلام",
      now,
    });
    const second = recordOfflineChatPush({
      userId: person.id,
      conversationId: 4,
      senderName: "سارا",
      type: "TEXT",
      body: "خوبی؟",
      now: now + 10_000,
    });
    expect(second).toBe(first);
    const row = db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, first))
      .get();
    expect(row?.bundleCount).toBe(2);
    expect(row?.title).toBe("۲ پیام جدید");
    const deliveries = db
      .select()
      .from(schema.notificationDeliveries)
      .where(
        and(
          eq(schema.notificationDeliveries.notificationId, first),
          eq(schema.notificationDeliveries.channel, "PUSH"),
        ),
      )
      .all();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.status).toBe("PENDING");
  });

  it("پاسخ ۴۱۰ اشتراک را حذف می‌کند", async () => {
    const person = await user("reza");
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const note = db
      .insert(schema.notifications)
      .values({
        userId: person.id,
        type: "announcement.new",
        title: "خبر",
        body: "متن",
        url: "/me/info",
        priority: "NORMAL",
      })
      .returning({ id: schema.notifications.id })
      .get();
    db.insert(schema.notificationDeliveries)
      .values({
        notificationId: note.id,
        channel: "PUSH",
        status: "PENDING",
        nextAttemptAt: new Date(),
      })
      .run();
    const endpoint = "https://fcm.googleapis.com/fcm/send/device-1";
    db.insert(schema.pushSubscriptions)
      .values({
        userId: person.id,
        endpoint,
        p256dh: "key",
        auth: "auth",
      })
      .run();
    const { processPushQueue } = await import("@/lib/push/queue");
    await processPushQueue({
      send: async () => ({ ok: false, statusCode: 410, error: "gone" }),
    });
    expect(
      db.select().from(schema.pushSubscriptions).all(),
    ).toHaveLength(0);
    const delivery = db.select().from(schema.notificationDeliveries).all()[0];
    expect(delivery?.status).toBe("FAILED");
  });

  it("Push ساعات سکوت بعد از پایان سکوت ارسال نمی‌شود و یک خلاصه می‌رود", async () => {
    const person = await user("sara");
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const during = Date.parse("2026-10-08T20:00:00Z");
    const ended = Date.parse("2026-10-09T03:30:00Z");
    for (const title of ["خبر", "پیام"]) {
      const note = db
        .insert(schema.notifications)
        .values({
          userId: person.id,
          type: "announcement.new",
          title,
          body: "متن",
          url: "/me/info",
          priority: "NORMAL",
          createdAt: new Date(during),
        })
        .returning({ id: schema.notifications.id })
        .get();
      db.insert(schema.notificationDeliveries)
        .values({
          notificationId: note.id,
          channel: "PUSH",
          status: "SKIPPED",
          lastError: "ساعات سکوت",
          sentAt: new Date(during),
        })
        .run();
    }
    db.insert(schema.pushSubscriptions)
      .values({
        userId: person.id,
        endpoint: "https://fcm.googleapis.com/fcm/send/device-sara",
        p256dh: "key",
        auth: "auth",
      })
      .run();
    const { processPushQueue, processQuietDigests } = await import("@/lib/push/queue");
    const queued: string[] = [];
    await processPushQueue({
      now: ended,
      send: async (payload) => {
        queued.push(payload.title);
        return { ok: true, statusCode: 201, error: null };
      },
    });
    expect(queued).toEqual([]);
    expect(
      db
        .select()
        .from(schema.notificationDeliveries)
        .all()
        .every((row) => row.status === "SKIPPED"),
    ).toBe(true);

    const digests: Array<{ title: string; url: string; tag: string | null }> = [];
    const first = await processQuietDigests({
      now: ended,
      send: async (payload) => {
        digests.push({ title: payload.title, url: payload.url, tag: payload.tag });
        return { ok: true, statusCode: 201, error: null };
      },
    });
    expect(first).toBe(1);
    expect(digests).toEqual([
      {
        title: "۲ پیام و اطلاعیه خوانده‌نشده",
        url: "/notifications",
        tag: "quiet-digest",
      },
    ]);
    const second = await processQuietDigests({
      now: ended,
      send: async () => {
        throw new Error("نباید دوباره فرستاده شود");
      },
    });
    expect(second).toBe(0);
    const { countUnreadNotifications } = await import("@/lib/notifications/store");
    expect(countUnreadNotifications(person.id)).toBe(2);
  });

  it("داخل ساعات سکوت و بدون مورد خوانده‌نشده خلاصه نمی‌رود", async () => {
    const person = await user("nima");
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    db.insert(schema.pushSubscriptions)
      .values({
        userId: person.id,
        endpoint: "https://web.push.apple.com/device-nima",
        p256dh: "key",
        auth: "auth",
      })
      .run();
    const { processQuietDigests } = await import("@/lib/push/queue");
    const during = await processQuietDigests({
      now: Date.parse("2026-10-08T20:00:00Z"),
      send: async () => {
        throw new Error("نباید داخل سکوت فرستاده شود");
      },
    });
    expect(during).toBe(0);
    const empty = await processQuietDigests({
      now: Date.parse("2026-10-09T03:30:00Z"),
      send: async () => {
        throw new Error("بدون مورد خوانده‌نشده نباید فرستاده شود");
      },
    });
    expect(empty).toBe(0);
  });
});