import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  departments,
  settings,
  taskCategories,
  users,
} from "./schema";
import { todayTehran } from "@/lib/dates";
import { normalizePersianText } from "@/lib/validation/normalize";

const isDev = process.env.NODE_ENV !== "production";

async function seed() {
  console.log("🌱 شروع seed اولیه…");

  const adminPassword =
    process.env.ADMIN_INITIAL_PASSWORD ?? "Admin@123456";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const existingAdmin = db
    .select()
    .from(users)
    .where(eq(users.username, "admin"))
    .get();

  let adminId: number;

  if (existingAdmin) {
    adminId = existingAdmin.id;
    console.log("✓ کاربر admin از قبل وجود دارد");
  } else {
    const inserted = db
      .insert(users)
      .values({
        username: "admin",
        passwordHash,
        role: "ADMIN",
        fullName: "مدیر سیستم",
        fullNameNormalized: normalizePersianText("مدیر سیستم"),
        mustChangePassword: true,
        sessionVersion: 1,
        isActive: true,
      })
      .returning({ id: users.id })
      .get();
    adminId = inserted.id;
    console.log("✓ کاربر admin ایجاد شد (تغییر رمز در اولین ورود الزامی است)");
  }

  let opsDeptId: number | undefined;
  let supportDeptId: number | undefined;

  if (isDev) {
    const existingDepts = db.select().from(departments).all();
    if (existingDepts.length === 0) {
      const created = db
        .insert(departments)
        .values([
          { name: "عملیات", managerId: adminId },
          { name: "پشتیبانی", managerId: adminId },
        ])
        .returning({ id: departments.id })
        .all();
      opsDeptId = created[0]?.id;
      supportDeptId = created[1]?.id;
      console.log("✓ ۲ دپارتمان نمونه ایجاد شد");
    } else {
      opsDeptId = existingDepts[0]?.id;
      supportDeptId = existingDepts[1]?.id ?? existingDepts[0]?.id;
    }
    await ensureDevUser({
      username: "staff1",
      fullName: "علی محمدی",
      role: "STAFF",
      position: "کارشناس",
      departmentId: opsDeptId,
      password: "Staff@123456",
    });
    await ensureDevUser({
      username: "manager1",
      fullName: "سارا احمدی",
      role: "MANAGER",
      position: "سرپرست عملیات",
      departmentId: opsDeptId,
      password: "Manager@123456",
    });
    await ensureDevUser({
      username: "staff2",
      fullName: "رضا کریمی",
      role: "STAFF",
      position: "کارشناس",
      departmentId: supportDeptId,
      password: "Staff@123456",
    });

    if (opsDeptId) {
      const mgr = db
        .select()
        .from(users)
        .where(eq(users.username, "manager1"))
        .get();
      if (mgr) {
        db.update(departments)
          .set({ managerId: mgr.id })
          .where(eq(departments.id, opsDeptId))
          .run();
      }
    }
  } else {
    console.log("ℹ production: فقط admin (+ تنظیمات/دسته‌ها)؛ بدون دپارتمان/کاربر نمونه");
  }

  const catCount = db.select().from(taskCategories).all().length;
  if (catCount === 0) {
    db.insert(taskCategories)
      .values([
        { name: "عمومی", color: "#64748b" },
        { name: "ایمنی", color: "#ef4444" },
        { name: "نگهداری", color: "#f59e0b" },
        { name: "گزارش‌گیری", color: "#3b82f6" },
      ])
      .run();
    console.log("✓ دسته‌های کار ایجاد شد");
  }

  const defaultSettings: Record<string, string> = {
    organization_name: "سازمان نمونه",
    logo_path: "",
    workday_start: "08:00",
    default_due_time: "17:00",
    not_done_reasons: JSON.stringify([
      { code: "no_time", label: "وقت نشد" },
      { code: "equipment", label: "نبود تجهیزات" },
      { code: "waiting", label: "منتظر هماهنگی" },
      { code: "other", label: "سایر" },
    ]),
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .get();
    if (!existing) {
      db.insert(settings).values({ key, value }).run();
    }
  }
  console.log("✓ تنظیمات پیش‌فرض");

  console.log("");
  console.log("حساب‌های نمونه:");
  console.log(`  admin / ${adminPassword}  (ADMIN — تغییر رمز اجباری)`);
  if (isDev) {
    console.log("  manager1 / Manager@123456  (MANAGER — دپارتمان عملیات)");
    console.log("  staff1 / Staff@123456  (STAFF — عملیات)");
    console.log("  staff2 / Staff@123456  (STAFF — پشتیبانی)");
  }
  console.log("");
  console.log("✅ seed اولیه تمام شد.");
}

async function ensureDevUser(input: {
  username: string;
  fullName: string;
  role: "STAFF" | "MANAGER";
  position: string;
  departmentId?: number;
  password: string;
}) {
  const existing = db
    .select()
    .from(users)
    .where(eq(users.username, input.username))
    .get();
  if (existing) return;

  const passwordHash = await bcrypt.hash(input.password, 12);
  db.insert(users)
    .values({
      username: input.username,
      passwordHash,
      role: input.role,
      fullName: input.fullName,
      fullNameNormalized: normalizePersianText(input.fullName),
      position: input.position,
      departmentId: input.departmentId,
      departmentJoinedAt: input.departmentId ? todayTehran() : null,
      mustChangePassword: false,
      sessionVersion: 1,
      isActive: true,
    })
    .run();
  console.log(`✓ کاربر ${input.username} برای تست ایجاد شد`);
}

seed().catch((err) => {
  console.error("خطا در seed:", err);
  process.exit(1);
});
