/**
 * بکاپ افزایشی رسانهٔ چت: فقط فایل‌هایی که در مقصد نیستند.
 * rsync در صورت وجود، وگرنه کپی فایل‌به‌فایل.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { copyNewFiles } from "@/lib/backup/uploads";
import { chatMediaDiskUsage, formatByteSize, uploadRoot } from "@/lib/chat/media-size";

function resolvePath(envVal: string | undefined, fallback: string): string {
  const value = envVal ?? fallback;
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function hasRsync(): boolean {
  try {
    execFileSync("rsync", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const source = path.join(uploadRoot(), "chat");
  const dest = path.join(resolvePath(process.env.BACKUP_DIR, "./backups"), "chat-media");
  fs.mkdirSync(dest, { recursive: true });
  if (!fs.existsSync(source)) {
    console.log("پوشهٔ رسانهٔ چت هنوز ساخته نشده است.");
    return;
  }
  if (hasRsync()) {
    execFileSync("rsync", ["-a", "--ignore-existing", `${source}/`, `${dest}/`], {
      stdio: "inherit",
    });
    console.log("✓ rsync افزایشی:", dest);
  } else {
    const result = copyNewFiles(source, dest);
    console.log(`✓ کپی فایل‌های جدید: ${result.copied} تازه، ${result.skipped} موجود`);
  }
  const media = chatMediaDiskUsage();
  console.log(`حجم فعلی رسانهٔ چت: ${formatByteSize(media.bytes)}`);
}

main();
