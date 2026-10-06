/**
 * بررسی فقط‌خواندنی سلامت داده.
 * تنها نوشتن این فرمان، ذخیرهٔ خلاصهٔ همین اجرا در settings است.
 * ردیف‌های کار، کاربر و occurrence عوض نمی‌شوند.
 *
 * بررسی «ثبت بسته‌شده به نام شخص دیگر» جایگزین scripts/report-copied-group-done.ts است.
 */
import "dotenv/config";
import {
  formatHealthReport,
  runHealthChecks,
  saveHealthReport,
} from "../src/lib/health/db-check";

const report = runHealthChecks();
saveHealthReport(report);
process.stdout.write(formatHealthReport(report));
process.exit(report.ok ? 0 : 1);
