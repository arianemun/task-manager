/**
 * اندازه‌گیری زمان واقعی کوئری‌های گزارش روی داده seed:large
 * اجرا: npm run bench:reports
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { taskOccurrences, users } from "@/db/schema";
import type { AuthUser } from "@/lib/auth/user";
import { parseReportFilters } from "@/lib/reports";
import {
  aggregateByDay,
  aggregateByDepartment,
  aggregateByStaff,
  aggregateCompletionHours,
  aggregateReasons,
  aggregateStatusDonut,
  aggregateWeekdayRates,
  aggregateWorstTasks,
  listOccurrenceDetails,
  staffDayHeatmap,
} from "@/server/queries/admin-reports";

function actorAdmin(): AuthUser {
  const admin = db.select().from(users).where(eq(users.role, "ADMIN")).get();
  if (!admin) {
    throw new Error("ADMIN یافت نشد — ابتدا db:seed یا db:seed:large");
  }
  return {
    id: admin.id,
    username: admin.username,
    fullName: admin.fullName,
    role: "ADMIN",
    departmentId: admin.departmentId,
    departmentIds: admin.departmentId ? [admin.departmentId] : [],
    isActive: true,
    mustChangePassword: false,
    sessionVersion: admin.sessionVersion,
    permissions: [],
    avatarPath: null,
  };
}

function measure(name: string, fn: () => void, rounds = 5): number {
  fn(); // warm-up
  const times: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  console.log(
    `${name.padEnd(28)} avg=${avg.toFixed(1)}ms  min=${min.toFixed(1)}ms  max=${max.toFixed(1)}ms`,
  );
  return avg;
}

function main() {
  const n =
    db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(taskOccurrences)
      .get()?.c ?? 0;

  console.log(`bench:reports — تعداد occurrence: ${n}`);
  if (n < 1000) {
    console.warn("⚠ داده کم است؛ برای بنچمارک واقعی: npm run db:seed:large");
  }

  const actor = actorAdmin();
  const filters = parseReportFilters({ range: "last_3_months" });
  filters.granularity = "day";
  filters.pageSize = 25;

  const results: Record<string, number> = {};
  results.aggregateByDay = measure("aggregateByDay", () =>
    aggregateByDay(actor, filters),
  );
  results.aggregateStatusDonut = measure("aggregateStatusDonut", () =>
    aggregateStatusDonut(actor, filters),
  );
  results.aggregateByStaff = measure("aggregateByStaff", () =>
    aggregateByStaff(actor, filters),
  );
  results.aggregateByDepartment = measure("aggregateByDepartment", () =>
    aggregateByDepartment(actor, filters),
  );
  results.aggregateWorstTasks = measure("aggregateWorstTasks", () =>
    aggregateWorstTasks(actor, filters),
  );
  results.aggregateWeekdayRates = measure("aggregateWeekdayRates", () =>
    aggregateWeekdayRates(actor, filters),
  );
  results.aggregateCompletionHours = measure("aggregateCompletionHours", () =>
    aggregateCompletionHours(actor, filters),
  );
  results.aggregateReasons = measure("aggregateReasons", () =>
    aggregateReasons(actor, filters),
  );
  results.staffDayHeatmap = measure("staffDayHeatmap", () =>
    staffDayHeatmap(actor, filters),
  );
  results.listOccurrenceDetails = measure("listOccurrenceDetails", () =>
    listOccurrenceDetails(actor, filters),
  );

  const slow = Object.entries(results).filter(([, ms]) => ms >= 500);
  console.log("");
  if (slow.length) {
    console.error("✗ کوئری‌های ≥۵۰۰ms:", slow.map(([k]) => k).join(", "));
    process.exitCode = 1;
  } else {
    console.log("✓ همه کوئری‌ها زیر ۵۰۰ms (میانگین ۵ اجرا)");
  }

  const out = path.join(process.cwd(), "docs", "BENCH_REPORTS.md");
  const lines = [
    "# بنچمارک گزارش‌ها (اندازه‌گیری‌شده)",
    "",
    `تاریخ اجرا: ${new Date().toISOString()}`,
    `تعداد occurrence: ${n}`,
    "بازه فیلتر: `last_3_months`",
    "میانگین ۵ اجرا پس از warm-up",
    "",
    "| کوئری | میانگین (ms) |",
    "|---|---:|",
    ...Object.entries(results).map(
      ([k, v]) => `| \`${k}\` | ${v.toFixed(1)} |`,
    ),
    "",
    slow.length
      ? `هشدار: ${slow.length} کوئری ≥۵۰۰ms`
      : "همه کوئری‌ها زیر هدف ۵۰۰ms بودند.",
    "",
  ];
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  console.log("گزارش نوشته شد: docs/BENCH_REPORTS.md");
}

main();
