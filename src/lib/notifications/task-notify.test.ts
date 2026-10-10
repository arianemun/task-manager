import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyPeriodKey, weeklyPeriodKey } from "@/lib/recurrence/period-key";
import { dueAtTehranMs, endOfJalaliWeek, startOfJalaliWeek } from "@/lib/dates";
import { notificationTypesForRole } from "./task-rules";

const DAY = "2026-10-09";
const AT_9 = Date.parse("2026-10-09T05:30:00.000Z");
const AT_940 = Date.parse("2026-10-09T06:10:00.000Z");
const AT_1030 = Date.parse("2026-10-09T07:00:00.000Z");
const AT_12 = Date.parse("2026-10-09T08:30:00.000Z");
const AT_18 = Date.parse("2026-10-09T14:30:00.000Z");

describe("اعلان کارها", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-task-notify-"));
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

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function seed() {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const dept = (name: string) =>
      db.insert(schema.departments).values({ name }).returning({ id: schema.departments.id }).get();
    const cafe = dept("کافه");
    const kitchen = dept("آشپزخانه");
    const office = dept("دفتر");
    function person(username: string, role: "STAFF" | "MANAGER" | "ADMIN" = "STAFF") {
      return db
        .insert(schema.users)
        .values({
          username,
          passwordHash: "x",
          role,
          fullName: username,
          fullNameNormalized: username,
          isActive: true,
        })
        .returning({ id: schema.users.id })
        .get();
    }
    const staff = person("ali");
    const peer = person("sara");
    const other = person("reza");
    const manager = person("mina", "MANAGER");
    db.insert(schema.userDepartments)
      .values([
        { userId: manager.id, departmentId: cafe.id, joinedAt: DAY },
        { userId: manager.id, departmentId: kitchen.id, joinedAt: DAY },
      ])
      .run();
    function template(
      title: string,
      dueTime: string | null,
      mode: "INDIVIDUAL" | "SHARED" = "INDIVIDUAL",
      startTime: string | null = null,
    ) {
      return db
        .insert(schema.taskTemplates)
        .values({
          title,
          recurrenceType: "DAILY",
          recurrenceConfig: { interval: 1, excludeWeekdays: [] },
          startDate: DAY,
          dueTime,
          startTime,
          completionMode: mode,
          createdBy: staff.id,
        })
        .returning({ id: schema.taskTemplates.id })
        .get();
    }
    function occurrence(input: {
      templateId: number;
      userId: number;
      departmentId: number;
      status?: "PENDING" | "DONE" | "EXCUSED";
      periodKey?: string;
      periodStart?: string;
      periodEnd?: string;
      dueAt?: number | null;
    }) {
      return db
        .insert(schema.taskOccurrences)
        .values({
          templateId: input.templateId,
          userId: input.userId,
          sourceDepartmentId: input.departmentId,
          periodKey: input.periodKey ?? dailyPeriodKey(DAY),
          periodStart: input.periodStart ?? DAY,
          periodEnd: input.periodEnd ?? DAY,
          dueAt: input.dueAt == null ? null : new Date(input.dueAt),
          status: input.status ?? "PENDING",
        })
        .returning({ id: schema.taskOccurrences.id })
        .get();
    }
    return { db, schema, cafe, kitchen, office, staff, peer, other, manager, template, occurrence };
  }

  it("پرسنل خلاصهٔ مدیر را در تنظیمات نمی‌بیند", () => {
    expect(notificationTypesForRole("STAFF")).not.toContain("task.manager_summary");
    expect(notificationTypesForRole("MANAGER")).toContain("task.manager_summary");
  });

  it("خلاصهٔ صبح، تعطیل، مرخصی، EXCUSED و اجرای دوباره", async () => {
    const { db, schema, cafe, staff, template, occurrence } = await seed();
    const daily = template("نظافت", null);
    occurrence({ templateId: daily.id, userId: staff.id, departmentId: cafe.id });
    const { previewTaskNotices, runTaskNotificationJob } = await import("./task-notify");
    const preview = previewTaskNotices({ type: "task.daily_digest", userId: staff.id, now: AT_9 });
    expect(preview[0]?.willSend).toBe(true);
    expect(preview[0]?.title).toBe("امروز ۱ کار دارید");
    expect(db.select().from(schema.notifications).all()).toHaveLength(0);

    runTaskNotificationJob(AT_9);
    runTaskNotificationJob(AT_9);
    const rows = db.select().from(schema.notifications).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dedupeKey).toBe(`task.daily_digest:${staff.id}:${DAY}`);

    db.update(schema.taskOccurrences).set({ status: "EXCUSED" }).run();
    const excused = previewTaskNotices({ type: "task.daily_digest", userId: staff.id, now: AT_9 });
    expect(excused[0]?.willSend).toBe(false);

    db.update(schema.taskOccurrences).set({ status: "PENDING" }).run();
    db.insert(schema.holidays).values({ date: DAY, title: "تعطیل" }).run();
    expect(previewTaskNotices({ type: "task.daily_digest", userId: staff.id, now: AT_9 })[0]?.willSend).toBe(
      false,
    );
    const weekStart = startOfJalaliWeek(DAY);
    const weekEnd = endOfJalaliWeek(DAY);
    const weekly = db
      .insert(schema.taskTemplates)
      .values({
        title: "هفتگی",
        recurrenceType: "WEEKLY",
        recurrenceConfig: {},
        startDate: weekStart,
        createdBy: staff.id,
      })
      .returning({ id: schema.taskTemplates.id })
      .get();
    occurrence({
      templateId: weekly.id,
      userId: staff.id,
      departmentId: cafe.id,
      periodKey: weeklyPeriodKey(DAY),
      periodStart: weekStart,
      periodEnd: weekEnd,
      dueAt: null,
    });
    const withWeekly = previewTaskNotices({ type: "task.daily_digest", userId: staff.id, now: AT_9 });
    expect(withWeekly[0]?.willSend).toBe(true);
    expect(withWeekly[0]?.title).toContain("هفتگی یا ماهانه");

    db.delete(schema.holidays).run();
    db.insert(schema.staffLeaves)
      .values({ userId: staff.id, startDate: DAY, endDate: DAY, reason: "مرخصی", createdBy: staff.id })
      .run();
    expect(previewTaskNotices({ type: "task.daily_digest", userId: staff.id, now: AT_9 })[0]?.willSend).toBe(
      false,
    );
    expect(previewTaskNotices({ type: "task.daily_digest", userId: staff.id, now: AT_12 })[0]?.reason).toContain(
      "دو ساعت",
    );
  });

  it("مهلت، کار SHARED، کار بدون ساعت و تأخیر بعد از خاموشی", async () => {
    const { db, schema, cafe, staff, peer, template, occurrence } = await seed();
    const timed = template("اسپرسو", "10:00");
    const open = occurrence({
      templateId: timed.id,
      userId: staff.id,
      departmentId: cafe.id,
      dueAt: dueAtTehranMs(DAY, "10:00"),
    });
    const { previewTaskNotices, runTaskNotificationJob } = await import("./task-notify");
    expect(previewTaskNotices({ type: "task.due_soon", userId: staff.id, now: AT_940 })[0]?.willSend).toBe(
      true,
    );
    expect(previewTaskNotices({ type: "task.due_soon", userId: staff.id, now: AT_1030 })[0]?.willSend).toBe(
      false,
    );
    expect(previewTaskNotices({ type: "task.overdue", userId: staff.id, now: AT_940 })[0]?.willSend).toBe(
      false,
    );
    const overdueAt = dueAtTehranMs(DAY, "10:00") + 15 * 60 * 1000;
    expect(previewTaskNotices({ type: "task.overdue", userId: staff.id, now: overdueAt })[0]?.willSend).toBe(
      true,
    );
    expect(previewTaskNotices({ type: "task.overdue", userId: staff.id, now: overdueAt })[0]?.url).toBe(
      `/me?focus=${open.id}`,
    );

    const plain = template("بدون ساعت", null);
    occurrence({ templateId: plain.id, userId: staff.id, departmentId: cafe.id, dueAt: null });
    const noDue = previewTaskNotices({ type: "task.overdue", userId: peer.id, now: overdueAt });
    expect(noDue.every((item) => item.willSend === false || item.entityId !== null)).toBe(true);

    const shared = template("مشترک", "10:00", "SHARED");
    occurrence({
      templateId: shared.id,
      userId: peer.id,
      departmentId: cafe.id,
      status: "DONE",
      dueAt: dueAtTehranMs(DAY, "10:00"),
    });
    occurrence({
      templateId: shared.id,
      userId: staff.id,
      departmentId: cafe.id,
      dueAt: dueAtTehranMs(DAY, "10:00"),
    });
    const blocked = previewTaskNotices({ type: "task.due_soon", userId: staff.id, now: AT_940 });
    expect(blocked.some((item) => item.title === "مشترک" && item.willSend)).toBe(false);

    runTaskNotificationJob(AT_1030);
    const dueRows = db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.type, "task.due_soon"))
      .all();
    expect(dueRows).toHaveLength(0);
  });

  it("خلاصهٔ مدیر فقط دپارتمان‌های خودش را می‌بیند", async () => {
    const { cafe, kitchen, office, staff, peer, other, manager, template, occurrence } = await seed();
    const task = template("روزانه", "10:00");
    occurrence({
      templateId: task.id,
      userId: staff.id,
      departmentId: cafe.id,
      dueAt: dueAtTehranMs(DAY, "10:00"),
    });
    occurrence({
      templateId: task.id,
      userId: peer.id,
      departmentId: kitchen.id,
      dueAt: dueAtTehranMs(DAY, "10:00"),
    });
    occurrence({
      templateId: task.id,
      userId: other.id,
      departmentId: office.id,
      dueAt: dueAtTehranMs(DAY, "10:00"),
    });
    const { previewTaskNotices } = await import("./task-notify");
    const plan = previewTaskNotices({ type: "task.manager_summary", userId: manager.id, now: AT_18 })[0];
    expect(plan?.willSend).toBe(true);
    expect(plan?.body).toContain("ali");
    expect(plan?.body).toContain("sara");
    expect(plan?.body).not.toContain("reza");
    expect(plan?.url).toContain("/admin/board");
  });

  it("ساعات سکوت due را حذف و خلاصه را به پایان سکوت می‌برد", async () => {
    const { db, schema, cafe, staff, template, occurrence } = await seed();
    db.update(schema.users)
      .set({ quietHoursStart: "08:00", quietHoursEnd: "20:00" })
      .where(eq(schema.users.id, staff.id))
      .run();
    const task = template("اسپرسو", "10:00");
    occurrence({
      templateId: task.id,
      userId: staff.id,
      departmentId: cafe.id,
      dueAt: dueAtTehranMs(DAY, "10:00"),
    });
    const { runTaskNotificationJob } = await import("./task-notify");
    runTaskNotificationJob(AT_9);
    const digestPush = db
      .select()
      .from(schema.notificationDeliveries)
      .innerJoin(
        schema.notifications,
        eq(schema.notifications.id, schema.notificationDeliveries.notificationId),
      )
      .where(
        and(
          eq(schema.notifications.type, "task.daily_digest"),
          eq(schema.notificationDeliveries.channel, "PUSH"),
        ),
      )
      .all();
    expect(digestPush[0]?.notification_deliveries.status).toBe("PENDING");
    expect(digestPush[0]?.notification_deliveries.nextAttemptAt?.getTime()).toBe(
      dueAtTehranMs(DAY, "20:00"),
    );

    runTaskNotificationJob(AT_940);
    const duePush = db
      .select()
      .from(schema.notificationDeliveries)
      .innerJoin(
        schema.notifications,
        eq(schema.notifications.id, schema.notificationDeliveries.notificationId),
      )
      .where(
        and(
          eq(schema.notifications.type, "task.due_soon"),
          eq(schema.notificationDeliveries.channel, "PUSH"),
        ),
      )
      .all();
    expect(duePush[0]?.notification_deliveries.status).toBe("SKIPPED");
    expect(db.select().from(schema.notifications).where(eq(schema.notifications.type, "task.due_soon")).all()).toHaveLength(1);
  });

  it("اساین چند کار در دو دقیقه یک اعلان می‌شود و کلید یکتا همزمان یکی می‌ماند", async () => {
    const { db, schema, staff } = await seed();
    const { recordTaskAssigned } = await import("./task-notify");
    for (let i = 0; i < 21; i += 1) {
      recordTaskAssigned({
        userId: staff.id,
        title: `کار ${i}`,
        startDate: "2026-10-12",
        now: AT_9 + i,
      });
    }
    const rows = db.select().from(schema.notifications).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("۲۱ کار جدید به شما اختصاص داده شد");
    expect(rows[0]?.bundleCount).toBe(21);

    const raw = new Database(dbPath);
    expect(() =>
      raw
        .prepare(
          "insert into notifications (user_id, type, title, body, dedupe_key, priority) values (?, 'task.assigned', 'x', '', ?, 'NORMAL')",
        )
        .run(staff.id, rows[0]?.dedupeKey),
    ).toThrow();
    raw.close();
  });

  it("خلاصهٔ صبح کار ساعت‌دار را جدا می‌شمارد و مهلت قبل از شروع نمی‌رود", async () => {
    const { db, schema, cafe, staff, template, occurrence } = await seed();
    const nowTask = template("الان", null);
    const later = template("عصر", "18:00", "INDIVIDUAL", "14:00");
    occurrence({ templateId: nowTask.id, userId: staff.id, departmentId: cafe.id });
    occurrence({
      templateId: later.id,
      userId: staff.id,
      departmentId: cafe.id,
      dueAt: dueAtTehranMs(DAY, "18:00"),
    });
    const { previewTaskNotices, runTaskNotificationJob } = await import("./task-notify");
    const digest = previewTaskNotices({ type: "task.daily_digest", userId: staff.id, now: AT_9 })[0];
    expect(digest?.willSend).toBe(true);
    expect(digest?.title).toBe("۱ کار الان، ۱ کار از ساعت ۱۴");

    const beforeStart = Date.parse("2026-10-09T06:25:00.000Z");
    const hiddenDue = template("پنهان", "10:20", "INDIVIDUAL", "10:00");
    occurrence({
      templateId: hiddenDue.id,
      userId: staff.id,
      departmentId: cafe.id,
      dueAt: dueAtTehranMs(DAY, "10:20"),
    });
    expect(
      previewTaskNotices({ type: "task.due_soon", userId: staff.id, now: beforeStart }).some(
        (item) => item.willSend && item.title === "پنهان",
      ),
    ).toBe(false);
    const visibleSoon = Date.parse("2026-10-09T06:35:00.000Z");
    expect(
      previewTaskNotices({ type: "task.due_soon", userId: staff.id, now: visibleSoon }).some(
        (item) => item.willSend && item.title === "پنهان",
      ),
    ).toBe(true);

    const hiddenOverdue = template("دیر", "10:00", "INDIVIDUAL", "11:00");
    occurrence({
      templateId: hiddenOverdue.id,
      userId: staff.id,
      departmentId: cafe.id,
      dueAt: dueAtTehranMs(DAY, "10:00"),
    });
    const overdueEarly = dueAtTehranMs(DAY, "10:00") + 15 * 60 * 1000;
    expect(
      previewTaskNotices({ type: "task.overdue", userId: staff.id, now: overdueEarly }).some(
        (item) => item.willSend && item.title === "دیر",
      ),
    ).toBe(false);
    const overdueVisible = dueAtTehranMs(DAY, "11:00") + 5 * 60 * 1000;
    expect(
      previewTaskNotices({ type: "task.overdue", userId: staff.id, now: overdueVisible }).some(
        (item) => item.willSend && item.title === "دیر",
      ),
    ).toBe(true);

    expect(previewTaskNotices({ type: "task.visible", userId: staff.id, now: AT_9 })[0]?.willSend).toBe(
      false,
    );
    db.insert(schema.notificationPreferences)
      .values({ userId: staff.id, type: "task.visible", push: true })
      .run();
    const opened = previewTaskNotices({
      type: "task.visible",
      userId: staff.id,
      now: dueAtTehranMs(DAY, "14:00") + 5 * 60 * 1000,
    });
    expect(opened.some((item) => item.willSend && item.body === "از الان قابل انجام است")).toBe(true);
    runTaskNotificationJob(dueAtTehranMs(DAY, "14:00") + 5 * 60 * 1000);
    runTaskNotificationJob(dueAtTehranMs(DAY, "14:00") + 6 * 60 * 1000);
    expect(
      db.select().from(schema.notifications).where(eq(schema.notifications.type, "task.visible")).all(),
    ).toHaveLength(1);
  });
});
