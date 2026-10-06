import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";

const sessionJar = vi.hoisted(() => ({
  token: null as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (sessionJar.token ? { value: sessionJar.token } : undefined),
    set: () => undefined,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

describe("اجرای دوباره بررسی سلامت داده", () => {
  let tmpDir: string;
  let db: Db;
  let rerun: () => Promise<void>;
  let createSessionToken: (
    userId: number,
    sessionVersion: number,
  ) => Promise<string>;
  let loadLastHealthReport: typeof import("@/lib/health/db-check").loadLastHealthReport;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-health-action-"));
    const dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    execSync("npx drizzle-kit migrate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
    vi.resetModules();
    db = (await import("@/db")).db;
    const session = await import("@/lib/auth/session");
    createSessionToken = session.createSessionToken;
    const action = await import("@/server/actions/data-health");
    rerun = action.rerunDataHealthCheckAction;
    loadLastHealthReport = (await import("@/lib/health/db-check"))
      .loadLastHealthReport;
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function user(role: "ADMIN" | "MANAGER" | "STAFF") {
    const schema = await import("@/db/schema");
    const row = db
      .insert(schema.users)
      .values({
        username: `${role.toLowerCase()}_${Math.random()}`,
        passwordHash: "x",
        role,
        fullName: role,
        fullNameNormalized: role,
        mustChangePassword: false,
        isActive: true,
        sessionVersion: 1,
      })
      .returning({ id: schema.users.id, sessionVersion: schema.users.sessionVersion })
      .get();
    sessionJar.token = await createSessionToken(row.id, row.sessionVersion);
    return row;
  }

  it("فقط ADMIN مجاز است و نتیجه در settings ذخیره می‌شود", async () => {
    await user("MANAGER");
    await expect(rerun()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "شما به این بخش دسترسی ندارید",
    });

    await user("STAFF");
    await expect(rerun()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "شما به این بخش دسترسی ندارید",
    });
    expect(loadLastHealthReport(db)).toBeNull();

    const before = Date.now();
    await user("ADMIN");
    await rerun();
    const stored = loadLastHealthReport(db);
    expect(stored).not.toBeNull();
    expect(stored!.checks.length).toBeGreaterThan(0);
    expect(typeof stored!.ok).toBe("boolean");
    expect(Date.parse(stored!.ranAt)).toBeGreaterThanOrEqual(before - 1000);
  });
});
