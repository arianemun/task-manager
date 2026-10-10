import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  requireUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

const DAY = "2026-10-10";
const BEFORE = Date.parse("2026-10-10T05:29:00.000Z");
const AT = Date.parse("2026-10-10T05:30:00.000Z");

describe("ثبت پاسخ قبل از ساعت شروع", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-occ-start-"));
    const dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    process.env.INTERNAL_SECRET = "test-internal-secret";
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE);
    execSync("npx drizzle-kit migrate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("انجام شد و انجام نشد قبل از ساعت رد می‌شوند و بعد از ساعت ثبت می‌شود", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const dept = db.insert(schema.departments).values({ name: "کافه" }).returning().get();
    const staff = db
      .insert(schema.users)
      .values({
        username: "ali",
        passwordHash: "x",
        role: "STAFF",
        fullName: "علی",
        fullNameNormalized: "علی",
        isActive: true,
      })
      .returning()
      .get();
    requireUser.mockResolvedValue({
      id: staff.id,
      role: "STAFF",
      departmentIds: [dept.id],
    });
    const template = db
      .insert(schema.taskTemplates)
      .values({
        title: "نظافت",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        startDate: DAY,
        startTime: "09:00",
        createdBy: staff.id,
      })
      .returning()
      .get();
    const open = db
      .insert(schema.taskOccurrences)
      .values({
        templateId: template.id,
        userId: staff.id,
        sourceDepartmentId: dept.id,
        periodKey: `D:${DAY}`,
        periodStart: DAY,
        periodEnd: DAY,
        status: "PENDING",
      })
      .returning()
      .get();

    const { submitOccurrenceAction } = await import("./occurrences");
    for (const intent of ["done", "not_done"] as const) {
      const form = new FormData();
      form.set("occurrenceId", String(open.id));
      form.set("intent", intent);
      if (intent === "not_done") form.set("note", "نشد");
      const blocked = await submitOccurrenceAction(form);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.error).toBe("این کار هنوز شروع نشده");
    }
    expect(db.select().from(schema.taskOccurrences).where(eq(schema.taskOccurrences.id, open.id)).get()?.status).toBe(
      "PENDING",
    );

    vi.setSystemTime(AT);
    const done = new FormData();
    done.set("occurrenceId", String(open.id));
    done.set("intent", "done");
    const saved = await submitOccurrenceAction(done);
    expect(saved.ok).toBe(true);
  });

  it("توضیح انجام‌نشدن فقط برای سایر یا کارِ نیازمند توضیح الزامی است", async () => {
    vi.setSystemTime(AT);
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const dept = db.insert(schema.departments).values({ name: "کافه" }).returning().get();
    const staff = db
      .insert(schema.users)
      .values({
        username: "ali",
        passwordHash: "x",
        role: "STAFF",
        fullName: "علی",
        fullNameNormalized: "علی",
        isActive: true,
      })
      .returning()
      .get();
    requireUser.mockResolvedValue({
      id: staff.id,
      role: "STAFF",
      departmentIds: [dept.id],
    });
    const template = db
      .insert(schema.taskTemplates)
      .values({
        title: "نظافت",
        recurrenceType: "DAILY",
        recurrenceConfig: {},
        startDate: DAY,
        startTime: "09:00",
        createdBy: staff.id,
      })
      .returning()
      .get();
    const open = db
      .insert(schema.taskOccurrences)
      .values({
        templateId: template.id,
        userId: staff.id,
        sourceDepartmentId: dept.id,
        periodKey: `D:${DAY}`,
        periodStart: DAY,
        periodEnd: DAY,
        status: "PENDING",
      })
      .returning()
      .get();
    const { submitOccurrenceAction } = await import("./occurrences");

    const ready = new FormData();
    ready.set("occurrenceId", String(open.id));
    ready.set("intent", "not_done");
    ready.set("reasonCode", "no_time");
    const withoutNote = await submitOccurrenceAction(ready);
    expect(withoutNote.ok).toBe(true);

    db.update(schema.taskOccurrences)
      .set({ status: "PENDING", note: null, reasonCode: null, completedAt: null })
      .where(eq(schema.taskOccurrences.id, open.id))
      .run();
    const other = new FormData();
    other.set("occurrenceId", String(open.id));
    other.set("intent", "not_done");
    other.set("reasonCode", "other");
    const missing = await submitOccurrenceAction(other);
    expect(missing.ok).toBe(false);
    other.set("note", "جزئیات");
    const withNote = await submitOccurrenceAction(other);
    expect(withNote.ok).toBe(true);

    db.update(schema.taskOccurrences)
      .set({ status: "PENDING", note: null, reasonCode: null, completedAt: null })
      .where(eq(schema.taskOccurrences.id, open.id))
      .run();
    db.update(schema.taskTemplates)
      .set({ requiresNote: true })
      .where(eq(schema.taskTemplates.id, template.id))
      .run();
    const forced = new FormData();
    forced.set("occurrenceId", String(open.id));
    forced.set("intent", "not_done");
    forced.set("reasonCode", "no_time");
    const stillRequired = await submitOccurrenceAction(forced);
    expect(stillRequired.ok).toBe(false);
  });
});
