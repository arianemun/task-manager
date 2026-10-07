import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("سلامت صف رسانه", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-media-health-"));
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

  it("FAILED و PROCESSING قدیمی را گزارش می‌کند و کار تازه را نه", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { runHealthChecks } = await import("./db-check");
    const user = db
      .insert(schema.users)
      .values({
        username: "media-health",
        fullName: "رسانه",
        fullNameNormalized: "رسانه",
        passwordHash: "x",
        role: "STAFF",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();
    const attachment = db
      .insert(schema.messageAttachments)
      .values({
        uploaderId: user.id,
        kind: "image",
        mime: "image/jpeg",
        size: 10,
        path: "chat/1/a.jpg",
        status: "FAILED",
        createdAt: new Date(),
      })
      .returning({ id: schema.messageAttachments.id })
      .get();
    const failed = db
      .insert(schema.mediaJobs)
      .values({
        attachmentId: attachment.id,
        status: "FAILED",
        attempts: 1,
        updatedAt: new Date(),
        createdAt: new Date(),
      })
      .returning({ id: schema.mediaJobs.id })
      .get();
    const stuck = db
      .insert(schema.mediaJobs)
      .values({
        attachmentId: attachment.id,
        status: "PROCESSING",
        attempts: 1,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      })
      .returning({ id: schema.mediaJobs.id })
      .get();
    db.insert(schema.mediaJobs)
      .values({
        attachmentId: attachment.id,
        status: "PROCESSING",
        attempts: 1,
        updatedAt: new Date(),
        createdAt: new Date(),
      })
      .run();
    db.insert(schema.mediaJobs)
      .values({
        attachmentId: attachment.id,
        status: "DONE",
        attempts: 1,
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        createdAt: new Date(),
      })
      .run();

    const finding = runHealthChecks(db).checks.find((check) => check.id === "media_jobs");
    expect(finding?.count).toBe(2);
    expect(finding?.sampleIds).toEqual(expect.arrayContaining([failed.id, stuck.id]));
  });
});
