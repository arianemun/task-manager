import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("سلامت رسانه و عضویت چت", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-chat-health-"));
    const dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.UPLOAD_DIR = path.join(tmpDir, "uploads");
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

  it("یتیم، فایل بی‌رکورد، رکورد بی‌فایل و عضو غیرفعال را بعد از مهلت گزارش می‌کند", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { runHealthChecks } = await import("./db-check");
    const day = 25 * 60 * 60 * 1000;
    const old = new Date(Date.now() - day);
    const fresh = new Date();
    const user = db
      .insert(schema.users)
      .values({
        username: "chat-health",
        fullName: "چت",
        fullNameNormalized: "چت",
        passwordHash: "x",
        role: "STAFF",
        mustChangePassword: false,
        isActive: false,
      })
      .returning({ id: schema.users.id })
      .get();
    const active = db
      .insert(schema.users)
      .values({
        username: "chat-health-on",
        fullName: "فعال",
        fullNameNormalized: "فعال",
        passwordHash: "x",
        role: "STAFF",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();
    const conversation = db
      .insert(schema.conversations)
      .values({ type: "GROUP", title: "گروه", createdBy: active.id })
      .returning({ id: schema.conversations.id })
      .get();
    db.insert(schema.conversationMembers)
      .values([
        { conversationId: conversation.id, userId: user.id, role: "MEMBER" },
        { conversationId: conversation.id, userId: active.id, role: "OWNER" },
      ])
      .run();
    const message = db
      .insert(schema.messages)
      .values({
        conversationId: conversation.id,
        senderId: active.id,
        type: "IMAGE",
        clientId: "health-1",
        createdAt: old,
      })
      .returning({ id: schema.messages.id })
      .get();
    const orphan = db
      .insert(schema.messageAttachments)
      .values({
        uploaderId: active.id,
        kind: "image",
        mime: "image/jpeg",
        size: 4,
        path: "chat/1/orphan.jpg",
        status: "PENDING",
        createdAt: old,
      })
      .returning({ id: schema.messageAttachments.id })
      .get();
    db.insert(schema.messageAttachments)
      .values({
        uploaderId: active.id,
        kind: "image",
        mime: "image/jpeg",
        size: 4,
        path: "chat/1/fresh.jpg",
        status: "PENDING",
        createdAt: fresh,
      })
      .run();
    const upload = process.env.UPLOAD_DIR!;
    fs.mkdirSync(path.join(upload, "chat", "1"), { recursive: true });
    fs.writeFileSync(path.join(upload, "chat", "1", "kept.jpg"), "ok");
    const stray = path.join(upload, "chat", "1", "stray.jpg");
    fs.writeFileSync(stray, "x");
    fs.utimesSync(stray, new Date(Date.now() - day), new Date(Date.now() - day));
    fs.writeFileSync(path.join(upload, "chat", "1", "new.jpg"), "n");
    const missing = db
      .insert(schema.messageAttachments)
      .values({
        messageId: message.id,
        uploaderId: active.id,
        kind: "image",
        mime: "image/jpeg",
        size: 4,
        path: "chat/1/missing.jpg",
        status: "READY",
        createdAt: old,
      })
      .returning({ id: schema.messageAttachments.id })
      .get();
    db.insert(schema.messageAttachments)
      .values({
        uploaderId: active.id,
        kind: "image",
        mime: "image/jpeg",
        size: 2,
        messageId: message.id,
        path: "chat/1/kept.jpg",
        status: "READY",
        createdAt: old,
      })
      .run();

    const report = runHealthChecks(db);
    const orphanFinding = report.checks.find((check) => check.id === "chat_orphan_attachment");
    const disk = report.checks.find((check) => check.id === "chat_disk_mismatch");
    const member = report.checks.find((check) => check.id === "chat_inactive_member");
    expect(orphanFinding?.count).toBe(1);
    expect(orphanFinding?.sampleIds).toEqual([orphan.id]);
    expect(disk?.count).toBe(2);
    expect(disk?.sampleIds).toEqual([missing.id]);
    expect(disk?.detail).toContain("stray.jpg");
    expect(member?.count).toBe(1);
    expect(member?.sampleIds).toEqual([user.id]);
  });
});
