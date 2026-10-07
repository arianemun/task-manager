import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sniffMedia } from "./media-sniff";
import { parseByteRange } from "@/lib/uploads/range";

describe("عکس و ویدیوی گفتگو", () => {
  it("امضای فایل را از بایت‌ها می‌خواند", () => {
    expect(sniffMedia(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))?.kind).toBe("image");
    expect(sniffMedia(Buffer.from("0000ftypisom", "ascii"))?.kind).toBe("video");
    expect(sniffMedia(Buffer.from("%PDF-1.7"))).toBeNull();
  });

  it("بازهٔ Range را برای پاسخ ۲۰۶ حساب می‌کند", () => {
    expect(parseByteRange("bytes=0-1", 10)).toEqual({ start: 0, end: 1 });
    expect(parseByteRange("bytes=4-", 10)).toEqual({ start: 4, end: 9 });
    expect(parseByteRange("bytes=-3", 10)).toEqual({ start: 7, end: 9 });
    expect(parseByteRange("bytes=20-30", 10)).toBeNull();
    expect(parseByteRange(null, 10)).toBeNull();
  });

  describe("ذخیره", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-media-"));
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

    it("عکس معتبر صف media_jobs می‌سازد و غیرعضو را رد می‌کند", async () => {
      const { db } = await import("@/db");
      const schema = await import("@/db/schema");
      const store = await import("./store");
      const a = db
        .insert(schema.users)
        .values({
          username: "a",
          fullName: "الف",
          fullNameNormalized: "الف",
          passwordHash: "x",
          role: "STAFF",
          mustChangePassword: false,
          isActive: true,
        })
        .returning({ id: schema.users.id })
        .get();
      const b = db
        .insert(schema.users)
        .values({
          username: "b",
          fullName: "ب",
          fullNameNormalized: "ب",
          passwordHash: "x",
          role: "STAFF",
          mustChangePassword: false,
          isActive: true,
        })
        .returning({ id: schema.users.id })
        .get();
      const conversationId = store.createDirectConversation(a.id, b.id);
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
      const message = await store.createMediaMessage({
        userId: a.id,
        conversationId,
        clientId: "img-1",
        bytes: jpeg,
      });
      expect(message.type).toBe("IMAGE");
      expect(message.attachment?.status).toBe("PROCESSING");
      expect(message.attachment?.url).toBeNull();
      const jobs = db.select().from(schema.mediaJobs).all();
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.status).toBe("PENDING");
      const stranger = db
        .insert(schema.users)
        .values({
          username: "c",
          fullName: "ج",
          fullNameNormalized: "ج",
          passwordHash: "x",
          role: "STAFF",
          mustChangePassword: false,
          isActive: true,
        })
        .returning({ id: schema.users.id })
        .get();
      await expect(
        store.createMediaMessage({
          userId: stranger.id,
          conversationId,
          clientId: "img-2",
          bytes: jpeg,
        }),
      ).rejects.toThrow(/دسترسی/);
    });
  });
});
