import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("فهرست دپارتمان", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-depts-"));
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

  it("اعضای فعلی را می‌شمارد و ستون id مبهم نمی‌سازد", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { listAllDepartments } = await import("./staff");
    const dept = db
      .insert(schema.departments)
      .values({ name: "پشتیبانی" })
      .returning({ id: schema.departments.id })
      .get();
    const open = db
      .insert(schema.users)
      .values({
        username: "open-member",
        fullName: "عضو باز",
        fullNameNormalized: "عضو باز",
        passwordHash: "x",
        role: "STAFF",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();
    const left = db
      .insert(schema.users)
      .values({
        username: "left-member",
        fullName: "عضو رفته",
        fullNameNormalized: "عضو رفته",
        passwordHash: "x",
        role: "STAFF",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();
    db.insert(schema.users)
      .values({
        username: "legacy-member",
        fullName: "عضو قدیمی",
        fullNameNormalized: "عضو قدیمی",
        passwordHash: "x",
        role: "STAFF",
        departmentId: dept.id,
        mustChangePassword: false,
        isActive: true,
      })
      .run();
    db.insert(schema.userDepartments)
      .values([
        { userId: open.id, departmentId: dept.id, joinedAt: "2026-01-01" },
        { userId: left.id, departmentId: dept.id, joinedAt: "2026-01-01", leftAt: "2026-02-01" },
      ])
      .run();

    const rows = listAllDepartments();
    expect(rows.find((row) => row.id === dept.id)?.memberCount).toBe(2);
  });
});
