/**
 * بازیابی از فایل بکاپ .db
 * استفاده: npm run db:restore -- ./backups/app_14040101_123.db
 *
 * هشدار: دیتابیس فعلی با فایل بکاپ جایگزین می‌شود.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

function dbFilePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const filePath = url.startsWith("file:") ? url.slice(5) : url;
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
}

function main() {
  const src = process.argv[2];
  if (!src) {
    console.error(
      "استفاده: npm run db:restore -- <مسیر-فایل-بکاپ.db>\nمثال: npm run db:restore -- ./backups/app_14040101_1.db",
    );
    process.exit(1);
  }
  const absSrc = path.isAbsolute(src) ? src : path.join(process.cwd(), src);
  if (!fs.existsSync(absSrc)) {
    console.error("فایل بکاپ یافت نشد:", absSrc);
    process.exit(1);
  }

  const dest = dbFilePath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // حذف WAL/SHM فعلی
  for (const side of ["", "-wal", "-shm"]) {
    const p = dest + side;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  fs.copyFileSync(absSrc, dest);
  console.log("✓ بازیابی شد →", dest);
  console.log("سپس: npm run db:migrate && pm2 reload (در صورت نیاز)");
}

main();
