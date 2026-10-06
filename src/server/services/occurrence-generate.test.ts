import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import { and, eq } from "drizzle-orm";

describe("تولید occurrence — DB", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-occ-"));
    dbPath = path.join(tmpDir, "test.db");
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
    vi.resetModules();

    execSync("npx drizzle-kit migrate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
  });

  afterEach(async () => {
    try {
      const dates = await import("@/lib/dates");
      dates.resetNowProvider();
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  async function loadDates() {
    return import("@/lib/dates");
  }

  async function seedBase(opts: {
    assignMs: number;
    startDate: string;
    staffActive?: boolean;
    staffDeleted?: boolean;
    deptId?: number;
    alsoDeptAssign?: boolean;
    hireDate?: string;
    deptJoinedAt?: string;
  }) {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("x", 4);

    const admin = db
      .insert(schema.users)
      .values({
        username: `admin_${Date.now()}_${Math.random()}`,
        passwordHash: hash,
        role: "ADMIN",
        fullName: "ادمین",
        fullNameNormalized: "ادمین",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();

    let deptId = opts.deptId;
    if (!deptId) {
      deptId = db
        .insert(schema.departments)
        .values({ name: `دپ_${Date.now()}`, managerId: admin.id })
        .returning({ id: schema.departments.id })
        .get().id;
    }

    const staff = db
      .insert(schema.users)
      .values({
        username: `staff_${Date.now()}_${Math.random()}`,
        passwordHash: hash,
        role: "STAFF",
        fullName: "پرسنل",
        fullNameNormalized: "پرسنل",
        mustChangePassword: false,
        isActive: opts.staffActive !== false,
        deletedAt: opts.staffDeleted ? new Date() : null,
        departmentId: deptId,
        departmentJoinedAt: opts.deptJoinedAt ?? opts.startDate,
        hireDate: opts.hireDate ?? opts.startDate,
      })
      .returning({ id: schema.users.id })
      .get();

    const template = db
      .insert(schema.taskTemplates)
      .values({
        title: "کار روزانه",
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 1 },
        startDate: opts.startDate,
        skipHolidays: false,
        isActive: true,
        createdBy: admin.id,
        dueTime: "17:00",
      })
      .returning({ id: schema.taskTemplates.id })
      .get();

    db.insert(schema.taskAssignments)
      .values({
        templateId: template.id,
        assigneeType: "USER",
        userId: staff.id,
        createdAt: new Date(opts.assignMs),
      })
      .run();

    if (opts.alsoDeptAssign) {
      db.insert(schema.taskAssignments)
        .values({
          templateId: template.id,
          assigneeType: "DEPARTMENT",
          departmentId: deptId,
          createdAt: new Date(opts.assignMs),
        })
        .run();
    }

    return { db, schema, adminId: admin.id, staffId: staff.id, templateId: template.id, deptId };
  }

  it("کاری که امروز اساین شده occurrence گذشته نمی‌سازد", async () => {
    const dates = await loadDates();
    dates.setNowProvider(() => new Date("2026-04-01T08:00:00.000Z"));
    const today = dates.todayTehran();
    const start = dates.fromJalali(1404, 1, 1);
    const assignMs = fromZonedTime(`${today}T12:00:00`, "Asia/Tehran").getTime();
    const { db, schema, staffId, templateId } = await seedBase({
      assignMs,
      startDate: start,
    });
    const { generateOccurrences } = await import("./occurrence-generate");
    generateOccurrences({ from: start, to: today, skipCursorUpdate: true });
    const rows = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.templateId, templateId))
      .all()
      .filter((r) => r.userId === staffId);
    expect(rows.every((r) => r.periodStart >= today)).toBe(true);
  });

  it("idempotency: دو بار generate تعداد را تغییر نمی‌دهد", async () => {
    const dates = await loadDates();
    dates.setNowProvider(() => new Date("2026-03-25T08:00:00.000Z"));
    const today = dates.todayTehran();
    const start = dates.fromJalali(1404, 1, 1);
    const assignMs = fromZonedTime(`${start}T12:00:00`, "Asia/Tehran").getTime();
    const { db, schema } = await seedBase({ assignMs, startDate: start });
    const { generateOccurrences } = await import("./occurrence-generate");
    const first = generateOccurrences({ from: start, to: today, skipCursorUpdate: true });
    const count1 = db.select().from(schema.taskOccurrences).all().length;
    expect(first.inserted).toBeGreaterThan(0);
    const second = generateOccurrences({ from: start, to: today, skipCursorUpdate: true });
    expect(second.inserted).toBe(0);
    expect(db.select().from(schema.taskOccurrences).all().length).toBe(count1);
  });

  it("catch-up بعد از ۵ روز خاموشی", async () => {
    const dates = await loadDates();
    const startG = dates.fromJalali(1404, 1, 1);
    dates.setNowProvider(() =>
      fromZonedTime(`${dates.fromJalali(1404, 1, 10)}T08:00:00`, "Asia/Tehran"),
    );
    const assignMs = fromZonedTime(`${startG}T12:00:00`, "Asia/Tehran").getTime();
    await seedBase({ assignMs, startDate: startG });
    const mod = await import("./occurrence-generate");
    mod.writeLastGeneratedDate(dates.fromJalali(1404, 1, 5));
    const result = mod.generateOccurrences();
    expect(result.from).toBe(dates.fromJalali(1404, 1, 6));
    expect(result.to).toBe(dates.todayTehran());
    expect(result.inserted).toBeGreaterThan(0);
  });

  it("close-periods: گذشته MISSED؛ دوره جاری دست نخورده", async () => {
    const dates = await loadDates();
    const todayJ = dates.fromJalali(1404, 1, 10);
    dates.setNowProvider(() =>
      fromZonedTime(`${todayJ}T08:00:00`, "Asia/Tehran"),
    );
    const start = dates.fromJalali(1404, 1, 1);
    const assignMs = fromZonedTime(`${start}T12:00:00`, "Asia/Tehran").getTime();
    const { db, schema, staffId, templateId } = await seedBase({
      assignMs,
      startDate: start,
    });
    const mod = await import("./occurrence-generate");
    mod.generateOccurrences({ from: start, to: todayJ, skipCursorUpdate: true });
    const closed = mod.closeMissedPeriods();
    expect(closed.closed).toBeGreaterThan(0);

    const rows = db
      .select()
      .from(schema.taskOccurrences)
      .where(
        and(
          eq(schema.taskOccurrences.templateId, templateId),
          eq(schema.taskOccurrences.userId, staffId),
        ),
      )
      .all();

    const past = rows.filter((r) => r.periodEnd < todayJ);
    const current = rows.filter((r) => r.periodEnd >= todayJ);
    expect(past.every((r) => r.status === "MISSED")).toBe(true);
    expect(current.every((r) => r.status === "PENDING")).toBe(true);
  });

  it("لغو اساین: PENDING بدون پاسخ حذف؛ DONE/NOT_DONE حفظ", async () => {
    const dates = await loadDates();
    const todayJ = dates.fromJalali(1404, 1, 10);
    dates.setNowProvider(() =>
      fromZonedTime(`${todayJ}T08:00:00`, "Asia/Tehran"),
    );
    const start = dates.fromJalali(1404, 1, 1);
    const assignMs = fromZonedTime(`${start}T12:00:00`, "Asia/Tehran").getTime();
    const { db, schema, staffId, templateId, deptId } = await seedBase({
      assignMs,
      startDate: start,
    });
    const mod = await import("./occurrence-generate");
    mod.generateOccurrences({ from: todayJ, to: todayJ, skipCursorUpdate: true });

    const occ = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.userId, staffId))
      .all()[0]!;

    db.insert(schema.taskOccurrences)
      .values({
        templateId,
        userId: staffId,
        periodKey: "D:done-keep",
        periodStart: todayJ,
        periodEnd: todayJ,
        sourceDepartmentId: deptId,
        status: "DONE",
        completedAt: new Date(),
        note: null,
      })
      .run();
    db.insert(schema.taskOccurrences)
      .values({
        templateId,
        userId: staffId,
        periodKey: "D:notdone-keep",
        periodStart: todayJ,
        periodEnd: todayJ,
        sourceDepartmentId: deptId,
        status: "NOT_DONE",
        note: "دلیل",
      })
      .run();

    mod.removePendingOnUnassign({ templateId, userIds: [staffId] });

    const left = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.userId, staffId))
      .all();
    expect(left.some((r) => r.id === occ.id && r.status === "PENDING")).toBe(
      false,
    );
    expect(left.some((r) => r.status === "DONE")).toBe(true);
    expect(left.some((r) => r.status === "NOT_DONE")).toBe(true);
  });

  it("کاربر غیرفعال/حذف‌شده occurrence جدید نمی‌گیرد", async () => {
    const dates = await loadDates();
    dates.setNowProvider(() => new Date("2026-03-25T08:00:00.000Z"));
    const today = dates.todayTehran();
    const start = dates.fromJalali(1404, 1, 1);
    const assignMs = fromZonedTime(`${start}T12:00:00`, "Asia/Tehran").getTime();

    const inactive = await seedBase({
      assignMs,
      startDate: start,
      staffActive: false,
    });
    const deleted = await seedBase({
      assignMs,
      startDate: start,
      staffDeleted: true,
    });
    const { generateOccurrences } = await import("./occurrence-generate");
    generateOccurrences({ from: start, to: today, skipCursorUpdate: true });

    expect(
      inactive.db
        .select()
        .from(inactive.schema.taskOccurrences)
        .where(eq(inactive.schema.taskOccurrences.userId, inactive.staffId))
        .all(),
    ).toHaveLength(0);
    expect(
      deleted.db
        .select()
        .from(deleted.schema.taskOccurrences)
        .where(eq(deleted.schema.taskOccurrences.userId, deleted.staffId))
        .all(),
    ).toHaveLength(0);
  });

  it("catch-up بیش از ۶۲ روز به ۶۲ روز محدود شود", async () => {
    const dates = await loadDates();
    const todayJ = dates.fromJalali(1404, 6, 1);
    dates.setNowProvider(() =>
      fromZonedTime(`${todayJ}T08:00:00`, "Asia/Tehran"),
    );
    const start = dates.fromJalali(1403, 1, 1);
    const assignMs = fromZonedTime(
      `${dates.fromJalali(1404, 1, 1)}T12:00:00`,
      "Asia/Tehran",
    ).getTime();
    await seedBase({ assignMs, startDate: start });
    const mod = await import("./occurrence-generate");
    mod.writeLastGeneratedDate(dates.fromJalali(1403, 1, 1));
    const result = mod.generateOccurrences();
    const span =
      (await import("@/lib/dates")).diffGregorianDays(result.from, result.to) +
      1;
    expect(span).toBeLessThanOrEqual(62);
    expect(result.from).toBe(
      dates.addGregorianDays(todayJ, -(62 - 1)),
    );
  });

  it("دو generate هم‌زمان رکورد تکراری یا خطا نمی‌دهد", async () => {
    const dates = await loadDates();
    dates.setNowProvider(() => new Date("2026-03-25T08:00:00.000Z"));
    const today = dates.todayTehran();
    const start = dates.fromJalali(1404, 1, 1);
    const assignMs = fromZonedTime(`${start}T12:00:00`, "Asia/Tehran").getTime();
    const { db, schema } = await seedBase({ assignMs, startDate: start });
    const { generateOccurrences } = await import("./occurrence-generate");

    await Promise.all([
      Promise.resolve(
        generateOccurrences({ from: start, to: today, skipCursorUpdate: true }),
      ),
      Promise.resolve(
        generateOccurrences({ from: start, to: today, skipCursorUpdate: true }),
      ),
    ]);

    const rows = db.select().from(schema.taskOccurrences).all();
    const keys = rows.map((r) => `${r.templateId}:${r.userId}:${r.periodKey}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("اساین مستقیم + دپارتمان فقط یک occurrence", async () => {
    const dates = await loadDates();
    dates.setNowProvider(() => new Date("2026-03-25T08:00:00.000Z"));
    const today = dates.todayTehran();
    const start = dates.fromJalali(1404, 1, 1);
    const assignMs = fromZonedTime(`${start}T12:00:00`, "Asia/Tehran").getTime();
    const { db, schema, staffId, templateId } = await seedBase({
      assignMs,
      startDate: start,
      alsoDeptAssign: true,
    });
    const { generateOccurrences } = await import("./occurrence-generate");
    generateOccurrences({ from: today, to: today, skipCursorUpdate: true });
    const rows = db
      .select()
      .from(schema.taskOccurrences)
      .where(
        and(
          eq(schema.taskOccurrences.templateId, templateId),
          eq(schema.taskOccurrences.userId, staffId),
          eq(schema.taskOccurrences.periodStart, today),
        ),
      )
      .all();
    expect(rows).toHaveLength(1);
  });

  it("انتقال دپارتمان: PENDING فقط‌دپارتمانی حذف؛ برای دپارتمان جدید ساخته شود", async () => {
    const dates = await loadDates();
    const todayJ = dates.fromJalali(1404, 1, 15);
    dates.setNowProvider(() =>
      fromZonedTime(`${todayJ}T08:00:00`, "Asia/Tehran"),
    );
    const start = dates.fromJalali(1404, 1, 1);
    const assignMs = fromZonedTime(`${start}T12:00:00`, "Asia/Tehran").getTime();

    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("x", 4);

    const admin = db
      .insert(schema.users)
      .values({
        username: `a_${Date.now()}`,
        passwordHash: hash,
        role: "ADMIN",
        fullName: "ا",
        fullNameNormalized: "ا",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();

    const deptA = db
      .insert(schema.departments)
      .values({ name: "A", managerId: admin.id })
      .returning({ id: schema.departments.id })
      .get();
    const deptB = db
      .insert(schema.departments)
      .values({ name: "B", managerId: admin.id })
      .returning({ id: schema.departments.id })
      .get();

    const staff = db
      .insert(schema.users)
      .values({
        username: `s_${Date.now()}`,
        passwordHash: hash,
        role: "STAFF",
        fullName: "پ",
        fullNameNormalized: "پ",
        mustChangePassword: false,
        isActive: true,
        departmentId: deptA.id,
        departmentJoinedAt: start,
        hireDate: start,
      })
      .returning({ id: schema.users.id })
      .get();

    const tplA = db
      .insert(schema.taskTemplates)
      .values({
        title: "کار A",
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 1 },
        startDate: start,
        skipHolidays: false,
        isActive: true,
        createdBy: admin.id,
      })
      .returning({ id: schema.taskTemplates.id })
      .get();
    const tplB = db
      .insert(schema.taskTemplates)
      .values({
        title: "کار B",
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 1 },
        startDate: start,
        skipHolidays: false,
        isActive: true,
        createdBy: admin.id,
      })
      .returning({ id: schema.taskTemplates.id })
      .get();

    db.insert(schema.taskAssignments)
      .values({
        templateId: tplA.id,
        assigneeType: "DEPARTMENT",
        departmentId: deptA.id,
        createdAt: new Date(assignMs),
      })
      .run();
    db.insert(schema.taskAssignments)
      .values({
        templateId: tplB.id,
        assigneeType: "DEPARTMENT",
        departmentId: deptB.id,
        createdAt: new Date(assignMs),
      })
      .run();

    const mod = await import("./occurrence-generate");
    mod.generateOccurrences({
      templateId: tplA.id,
      userId: staff.id,
      from: todayJ,
      to: todayJ,
      skipCursorUpdate: true,
    });
    expect(
      db
        .select()
        .from(schema.taskOccurrences)
        .where(eq(schema.taskOccurrences.templateId, tplA.id))
        .all().length,
    ).toBe(1);

    db.update(schema.users)
      .set({ departmentId: deptB.id })
      .where(eq(schema.users.id, staff.id))
      .run();

    const result = mod.onUserDepartmentChanged({
      userId: staff.id,
      oldDepartmentId: deptA.id,
      newDepartmentId: deptB.id,
    });
    expect(result.removed).toBe(1);
    expect(result.generated).toBeGreaterThanOrEqual(1);
    expect(
      db
        .select()
        .from(schema.taskOccurrences)
        .where(eq(schema.taskOccurrences.templateId, tplA.id))
        .all(),
    ).toHaveLength(0);
    expect(
      db
        .select()
        .from(schema.taskOccurrences)
        .where(eq(schema.taskOccurrences.templateId, tplB.id))
        .all().length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("منبع occurrence: دپارتمان، مستقیم، و اولویت بین چند مسیر", async () => {
    const dates = await loadDates();
    dates.setNowProvider(() => new Date("2026-10-06T10:00:00+03:30"));
    const today = dates.todayTehran();
    const assignMs = fromZonedTime(`${today}T08:00:00`, "Asia/Tehran").getTime();
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("x", 4);

    const admin = db
      .insert(schema.users)
      .values({
        username: `src_${Date.now()}`,
        passwordHash: hash,
        role: "ADMIN",
        fullName: "ا",
        fullNameNormalized: "ا",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: schema.users.id })
      .get();
    const dept = (name: string) =>
      db
        .insert(schema.departments)
        .values({ name, managerId: admin.id })
        .returning({ id: schema.departments.id })
        .get();
    const deptA = dept("منبع-الف");
    const deptB = dept("منبع-ب");
    const deptC = dept("منبع-ج");

    const staff = db
      .insert(schema.users)
      .values({
        username: `src_s_${Date.now()}`,
        passwordHash: hash,
        role: "STAFF",
        fullName: "پ",
        fullNameNormalized: "پ",
        mustChangePassword: false,
        isActive: true,
        departmentId: deptB.id,
        departmentJoinedAt: "2026-06-01",
        hireDate: "2026-01-01",
      })
      .returning({ id: schema.users.id })
      .get();
    db.insert(schema.userDepartments)
      .values([
        { userId: staff.id, departmentId: deptA.id, joinedAt: "2026-01-01" },
        { userId: staff.id, departmentId: deptB.id, joinedAt: "2026-06-01" },
      ])
      .run();

    const templateFor = (title: string, departmentIds: number[], direct: boolean) => {
      const template = db
        .insert(schema.taskTemplates)
        .values({
          title,
          recurrenceType: "DAILY",
          recurrenceConfig: { interval: 1 },
          startDate: "2026-10-01",
          skipHolidays: false,
          isActive: true,
          createdBy: admin.id,
        })
        .returning({ id: schema.taskTemplates.id })
        .get();
      if (direct) {
        db.insert(schema.taskAssignments)
          .values({
            templateId: template.id,
            assigneeType: "USER",
            userId: staff.id,
            createdAt: new Date(assignMs),
          })
          .run();
      }
      for (const departmentId of departmentIds) {
        db.insert(schema.taskAssignments)
          .values({
            templateId: template.id,
            assigneeType: "DEPARTMENT",
            departmentId,
            createdAt: new Date(assignMs),
          })
          .run();
      }
      return template.id;
    };

    const onlyDept = templateFor("فقط دپارتمان", [deptA.id], false);
    const onlyDirect = templateFor("فقط مستقیم", [], true);
    const primaryWins = templateFor("اصلی مقدم است", [deptA.id, deptB.id], true);

    const { generateOccurrences } = await import("./occurrence-generate");
    generateOccurrences({
      userId: staff.id,
      from: today,
      to: today,
      skipCursorUpdate: true,
    });

    db.update(schema.users)
      .set({ departmentId: deptC.id })
      .where(eq(schema.users.id, staff.id))
      .run();
    const oldestWins = templateFor("قدیمی‌ترین عضویت", [deptA.id, deptB.id], true);
    generateOccurrences({
      userId: staff.id,
      from: today,
      to: today,
      skipCursorUpdate: true,
    });

    const sourceOf = (templateId: number) => {
      const rows = db
        .select()
        .from(schema.taskOccurrences)
        .where(eq(schema.taskOccurrences.templateId, templateId))
        .all();
      expect(rows).toHaveLength(1);
      return rows[0]?.sourceDepartmentId;
    };

    expect(sourceOf(onlyDept)).toBe(deptA.id);
    expect(sourceOf(onlyDirect)).toBe(deptB.id);
    expect(sourceOf(primaryWins)).toBe(deptB.id);
    expect(sourceOf(oldestWins)).toBe(deptA.id);
  });

  it("خروج از یک دپارتمان: PENDING همان منبع حذف یا به مسیر بعدی منتقل می‌شود", async () => {
    const dates = await loadDates();
    dates.setNowProvider(() => new Date("2026-10-06T10:00:00+03:30"));
    const today = dates.todayTehran();
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const bcrypt = await import("bcryptjs");
    const { setUserDepartments } = await import("@/lib/departments/membership");
    const { removeDeptOnlyPendingOnTransfer } = await import(
      "./occurrence-generate"
    );
    const hash = await bcrypt.hash("x", 4);

    const admin = db
      .insert(schema.users)
      .values({
        username: `leave_${Date.now()}`,
        passwordHash: hash,
        role: "ADMIN",
        fullName: "ا",
        fullNameNormalized: "ا",
        mustChangePassword: false,
        isActive: true,
      })
      .returning()
      .get();
    const deptA = db
      .insert(schema.departments)
      .values({ name: "خروج-الف", managerId: admin.id })
      .returning()
      .get();
    const deptB = db
      .insert(schema.departments)
      .values({ name: "خروج-ب", managerId: admin.id })
      .returning()
      .get();
    const staff = db
      .insert(schema.users)
      .values({
        username: `leave_s_${Date.now()}`,
        passwordHash: hash,
        role: "STAFF",
        fullName: "پ",
        fullNameNormalized: "پ",
        departmentId: deptA.id,
        departmentJoinedAt: "2026-01-01",
        hireDate: "2026-01-01",
        mustChangePassword: false,
        isActive: true,
      })
      .returning()
      .get();
    setUserDepartments(staff.id, [deptA.id, deptB.id]);

    const onlyA = db
      .insert(schema.taskTemplates)
      .values({
        title: "فقط الف",
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 1 },
        startDate: "2026-10-01",
        skipHolidays: false,
        isActive: true,
        createdBy: admin.id,
      })
      .returning()
      .get();
    const both = db
      .insert(schema.taskTemplates)
      .values({
        title: "هر دو",
        recurrenceType: "DAILY",
        recurrenceConfig: { interval: 1 },
        startDate: "2026-10-01",
        skipHolidays: false,
        isActive: true,
        createdBy: admin.id,
      })
      .returning()
      .get();
    db.insert(schema.taskAssignments)
      .values([
        {
          templateId: onlyA.id,
          assigneeType: "DEPARTMENT",
          departmentId: deptA.id,
        },
        {
          templateId: both.id,
          assigneeType: "DEPARTMENT",
          departmentId: deptA.id,
        },
        {
          templateId: both.id,
          assigneeType: "DEPARTMENT",
          departmentId: deptB.id,
        },
      ])
      .run();

    const pendingOnly = db
      .insert(schema.taskOccurrences)
      .values({
        templateId: onlyA.id,
        userId: staff.id,
        periodKey: `D:${today}`,
        periodStart: today,
        periodEnd: today,
        status: "PENDING",
        sourceDepartmentId: deptA.id,
      })
      .returning()
      .get();
    db.insert(schema.taskOccurrences)
      .values({
        templateId: onlyA.id,
        userId: staff.id,
        periodKey: "D:2026-10-01",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-01",
        status: "DONE",
        completedAt: new Date("2026-10-01T12:00:00+03:30"),
        sourceDepartmentId: deptA.id,
      })
      .run();
    const pendingBoth = db
      .insert(schema.taskOccurrences)
      .values({
        templateId: both.id,
        userId: staff.id,
        periodKey: `D:${today}`,
        periodStart: today,
        periodEnd: today,
        status: "PENDING",
        sourceDepartmentId: deptA.id,
      })
      .returning()
      .get();

    setUserDepartments(staff.id, [deptB.id]);
    const removed = removeDeptOnlyPendingOnTransfer({
      userId: staff.id,
      oldDepartmentId: deptA.id,
    });

    expect(removed).toBe(1);
    expect(
      db
        .select()
        .from(schema.taskOccurrences)
        .where(eq(schema.taskOccurrences.id, pendingOnly.id))
        .get(),
    ).toBeUndefined();
    const keptDone = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.templateId, onlyA.id))
      .all();
    expect(keptDone).toHaveLength(1);
    expect(keptDone[0]?.status).toBe("DONE");
    const moved = db
      .select()
      .from(schema.taskOccurrences)
      .where(eq(schema.taskOccurrences.id, pendingBoth.id))
      .get();
    expect(moved?.sourceDepartmentId).toBe(deptB.id);
    expect(moved?.status).toBe("PENDING");
  });
});
