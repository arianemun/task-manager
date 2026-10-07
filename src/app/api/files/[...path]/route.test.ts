import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionJar = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (sessionJar.token ? { value: sessionJar.token } : undefined),
    set: () => undefined,
  }),
}));

describe("Range فایل گفتگو", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-range-"));
    const dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.UPLOAD_DIR = path.join(tmpDir, "uploads");
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    sessionJar.token = null;
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

  it("۲۰۶ و ۲۰۰ و ۴۱۶ و ۴۰۳ را بدون شبکه برمی‌گرداند", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const store = await import("@/lib/chat/store");
    const { createSessionToken } = await import("@/lib/auth/jwt");
    const { GET } = await import("./route");

    function person(username: string, fullName: string) {
      return db
        .insert(schema.users)
        .values({
          username,
          fullName,
          fullNameNormalized: fullName,
          passwordHash: "x",
          role: "STAFF",
          mustChangePassword: false,
          isActive: true,
        })
        .returning({ id: schema.users.id })
        .get();
    }

    const member = person("range-a", "الف");
    const other = person("range-b", "ب");
    const outsider = person("range-c", "ج");
    const conversationId = store.createDirectConversation(member.id, other.id);
    const relative = path.join("chat", String(conversationId), "clip.mp4");
    const abs = path.join(process.env.UPLOAD_DIR as string, relative);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.alloc(10000, 7));

    async function read(token: string, range?: string) {
      sessionJar.token = token;
      const headers = new Headers();
      if (range) headers.set("range", range);
      const response = await GET(new Request("http://localhost/api/files/clip.mp4", { headers }), {
        params: Promise.resolve({ path: ["chat", String(conversationId), "clip.mp4"] }),
      });
      const body = Buffer.from(await response.arrayBuffer());
      return { response, body };
    }

    const memberToken = await createSessionToken(member.id, 1);
    const start = await read(memberToken, "bytes=0-99");
    expect(start.response.status).toBe(206);
    expect(start.response.headers.get("content-range")).toBe("bytes 0-99/10000");
    expect(start.body.length).toBe(100);
    expect(start.body.every((byte) => byte === 7)).toBe(true);

    const middle = await read(memberToken, "bytes=5000-5099");
    expect(middle.response.status).toBe(206);
    expect(middle.response.headers.get("content-range")).toBe("bytes 5000-5099/10000");
    expect(middle.body.length).toBe(100);

    const end = await read(memberToken, "bytes=-100");
    expect(end.response.status).toBe(206);
    expect(end.response.headers.get("content-range")).toBe("bytes 9900-9999/10000");
    expect(end.body.length).toBe(100);

    const whole = await read(memberToken);
    expect(whole.response.status).toBe(200);
    expect(whole.response.headers.get("content-range")).toBeNull();
    expect(whole.response.headers.get("content-length")).toBe("10000");
    expect(whole.body.length).toBe(10000);

    const invalid = await read(memberToken, "bytes=20000-20010");
    expect(invalid.response.status).toBe(416);
    expect(invalid.response.headers.get("content-range")).toBe("bytes */10000");

    const denied = await read(await createSessionToken(outsider.id, 1), "bytes=0-99");
    expect(denied.response.status).toBe(403);
    expect(JSON.parse(denied.body.toString("utf8"))).toEqual({ error: "دسترسی ندارید" });
  });
});
