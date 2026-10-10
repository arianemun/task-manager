/**
 * داده حجیم برای بنچمارک گزارش‌ها:
 * ۵۰ پرسنل، ۲۰ کار، ≈۱۸۰ روز تاریخچه occurrence
 *
 * اجرا: npm run db:seed:large
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  taskAssignments,
  taskCategories,
  taskOccurrences,
  taskTemplates,
  users,
} from "@/db/schema";
import {
  addGregorianDays,
  todayTehran,
  type GDate,
} from "@/lib/dates";
import { normalizePersianText } from "@/lib/validation/normalize";

async function main() {
  console.log("… seed:large شروع");
  const hash = await bcrypt.hash("Staff@123456", 4);
  const today = todayTehran();
  const start = addGregorianDays(today, -179);

  let deptIds = db.select().from(departments).all().map((d) => d.id);
  if (deptIds.length < 3) {
    for (const name of ["عملیات", "پشتیبانی", "مالی"]) {
      const existing = db
        .select()
        .from(departments)
        .where(eq(departments.name, name))
        .get();
      if (!existing) {
        db.insert(departments).values({ name }).run();
      }
    }
    deptIds = db.select().from(departments).all().map((d) => d.id);
  }

  let admin = db.select().from(users).where(eq(users.role, "ADMIN")).get();
  if (!admin) {
    admin = db
      .insert(users)
      .values({
        username: "admin_large",
        passwordHash: hash,
        role: "ADMIN",
        fullName: "ادمین بنچمارک",
        fullNameNormalized: normalizePersianText("ادمین بنچمارک"),
        mustChangePassword: false,
        isActive: true,
      })
      .returning()
      .get();
  }

  const staffIds: number[] = [];
  const staffDepartment = new Map<number, number>();
  for (let i = 1; i <= 50; i++) {
    const username = `bench_staff_${i}`;
    let u = db.select().from(users).where(eq(users.username, username)).get();
    if (!u) {
      u = db
        .insert(users)
        .values({
          username,
          passwordHash: hash,
          role: "STAFF",
          fullName: `پرسنل بنچ ${i}`,
          fullNameNormalized: normalizePersianText(`پرسنل بنچ ${i}`),
          departmentId: deptIds[i % deptIds.length]!,
          departmentJoinedAt: start,
          hireDate: start,
          mustChangePassword: false,
          isActive: true,
        })
        .returning()
        .get();
    }
    staffIds.push(u.id);
    staffDepartment.set(u.id, u.departmentId ?? deptIds[i % deptIds.length]!);
  }

  let cats = db.select().from(taskCategories).all();
  if (cats.length === 0) {
    db.insert(taskCategories)
      .values([
        { name: "عمومی", color: "#64748b" },
        { name: "ایمنی", color: "#ef4444" },
      ])
      .run();
    cats = db.select().from(taskCategories).all();
  }

  const templateIds: number[] = [];
  for (let i = 1; i <= 20; i++) {
    const title = `کار بنچمارک ${i}`;
    let t = db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.title, title))
      .get();
    if (!t) {
      t = db
        .insert(taskTemplates)
        .values({
          title,
          categoryId: cats[i % cats.length]!.id,
          priority: (["ELIMINATE", "SCHEDULE", "DO"] as const)[i % 3]!,
          recurrenceType: "DAILY",
          recurrenceConfig: { interval: 1 },
          startDate: start,
          skipHolidays: false,
          isActive: true,
          createdBy: admin.id,
        })
        .returning()
        .get();
      // اساین به چند دپارتمان / کاربر
      if (i % 2 === 0) {
        db.insert(taskAssignments)
          .values({
            templateId: t.id,
            assigneeType: "DEPARTMENT",
            departmentId: deptIds[i % deptIds.length]!,
          })
          .run();
      } else {
        db.insert(taskAssignments)
          .values({
            templateId: t.id,
            assigneeType: "USER",
            userId: staffIds[i % staffIds.length]!,
          })
          .run();
      }
    }
    templateIds.push(t.id);
  }

  const statuses = [
    "DONE",
    "DONE",
    "DONE_LATE",
    "NOT_DONE",
    "MISSED",
    "PENDING",
    "EXCUSED",
  ] as const;

  let inserted = 0;
  const batch: Array<{
    templateId: number;
    userId: number;
    periodKey: string;
    periodStart: GDate;
    periodEnd: GDate;
    sourceDepartmentId: number;
    status: (typeof statuses)[number];
    completedAt: Date | null;
    reasonCode: string | null;
    note: string | null;
  }> = [];

  for (let dayOffset = 0; dayOffset < 180; dayOffset++) {
    const day = addGregorianDays(start, dayOffset);
    for (let ti = 0; ti < templateIds.length; ti++) {
      // هر کار به ~۸ پرسنل در روز (نمونه)
      for (let s = 0; s < 8; s++) {
        const userId = staffIds[(ti * 8 + s + dayOffset) % staffIds.length]!;
        const st = statuses[(ti + s + dayOffset) % statuses.length]!;
        batch.push({
          templateId: templateIds[ti]!,
          userId,
          periodKey: `D:${day}`,
          periodStart: day,
          periodEnd: day,
          sourceDepartmentId: staffDepartment.get(userId)!,
          status: st,
          completedAt:
            st === "DONE" || st === "DONE_LATE" || st === "NOT_DONE"
              ? new Date(`${day}T${String(8 + (s % 10)).padStart(2, "0")}:30:00+03:30`)
              : null,
          reasonCode: st === "NOT_DONE" ? ["no_time", "equipment", "other"][s % 3]! : null,
          note: st === "NOT_DONE" ? "توضیح نمونه" : null,
        });
        if (batch.length >= 400) {
          db.insert(taskOccurrences).values(batch).onConflictDoNothing().run();
          inserted += batch.length;
          batch.length = 0;
        }
      }
    }
  }
  if (batch.length) {
    db.insert(taskOccurrences).values(batch).onConflictDoNothing().run();
    inserted += batch.length;
  }

  console.log(`✓ seed:large — حدود ${inserted} occurrence تلاش درج (با onConflictDoNothing)`);
  console.log(`  پرسنل: ${staffIds.length}، کار: ${templateIds.length}، از ${start} تا ${today}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
