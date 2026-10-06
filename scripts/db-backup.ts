/**
 * بکاپ با better-sqlite3 .backup() + zip آپلودها
 * نگهداری ۱۴ نسخه آخر
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { toJalali, todayTehran } from "@/lib/dates";

function resolvePath(envVal: string | undefined, fallback: string): string {
  const v = envVal ?? fallback;
  return path.isAbsolute(v) ? v : path.join(process.cwd(), v);
}

function dbFilePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const filePath = url.startsWith("file:") ? url.slice(5) : url;
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
}

async function main() {
  const backupDir = resolvePath(process.env.BACKUP_DIR, "./backups");
  const uploadDir = resolvePath(process.env.UPLOAD_DIR, "./uploads");
  fs.mkdirSync(backupDir, { recursive: true });

  const j = toJalali(todayTehran()).jDate.replace(/-/g, "");
  const stamp = `${j}_${Date.now()}`;
  const dbBackup = path.join(backupDir, `app_${stamp}.db`);
  const zipPath = path.join(backupDir, `uploads_${stamp}.zip`);

  const srcDb = dbFilePath();
  if (!fs.existsSync(srcDb)) {
    throw new Error(`دیتابیس یافت نشد: ${srcDb}`);
  }

  const db = new Database(srcDb, { readonly: true });
  try {
    await db.backup(dbBackup);
  } finally {
    db.close();
  }
  console.log("✓ DB backup:", dbBackup);

  if (fs.existsSync(uploadDir)) {
    try {
      // zip با PowerShell روی ویندوز / zip روی لینوکس
      if (process.platform === "win32") {
        execFileSync(
          "powershell",
          [
            "-NoProfile",
            "-Command",
            `Compress-Archive -Path '${uploadDir}\\*' -DestinationPath '${zipPath}' -Force`,
          ],
          { stdio: "inherit" },
        );
      } else {
        execFileSync("zip", ["-r", zipPath, "."], {
          cwd: uploadDir,
          stdio: "inherit",
        });
      }
      console.log("✓ uploads zip:", zipPath);
    } catch (e) {
      console.warn("⚠ zip آپلودها ناموفق:", e);
    }
  }

  // نگهداری ۱۴ نسخه آخر (بر اساس نام app_*.db)
  const dbs = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("app_") && f.endsWith(".db"))
    .map((f) => ({
      f,
      t: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.t - a.t);

  for (const old of dbs.slice(14)) {
    fs.unlinkSync(path.join(backupDir, old.f));
    const zipTwin = old.f.replace(/^app_/, "uploads_").replace(/\.db$/, ".zip");
    const zp = path.join(backupDir, zipTwin);
    if (fs.existsSync(zp)) fs.unlinkSync(zp);
    console.log("حذف بکاپ قدیمی:", old.f);
  }

  console.log("بکاپ کامل شد.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
