/**
 * فایل‌های چت که قبلاً پردازش شده‌اند را دوباره با حذف متادیتا می‌نویسد.
 * مسیر دیتابیس عوض نمی‌شود. فایل اصلی فقط بعد از موفق بودن جایگزینی پاک می‌شود.
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { messageAttachments } from "../src/db/schema";
import { resolveUploadPath } from "../src/lib/uploads/avatar";
import { transcodeImageFile, transcodeVideoFile, transcodeVoiceFile, writeThumbnail } from "../src/lib/chat/transcode";

function tempBeside(file: string): string {
  const ext = path.extname(file);
  return `${file.slice(0, -ext.length)}.strip${ext}`;
}

async function replaceWith(input: string, output: string, run: (src: string, dest: string) => Promise<void>) {
  const tmp = tempBeside(output);
  await run(input, tmp);
  await fs.rename(tmp, output);
}

async function main() {
  const rows = db.select().from(messageAttachments).all();
  if (rows.length === 0) {
    process.stdout.write("هیچ پیوست گفتگویی روی سرور نیست.\n");
    return;
  }
  for (const row of rows) {
    const abs = resolveUploadPath(row.path);
    await fs.access(abs);
    if (row.kind === "video") await replaceWith(abs, abs, transcodeVideoFile);
    else if (row.kind === "voice") await replaceWith(abs, abs, async (src, dest) => {
      await transcodeVoiceFile(src, dest);
    });
    else await replaceWith(abs, abs, transcodeImageFile);
    if (row.thumbPath && row.kind !== "voice") {
      const thumb = resolveUploadPath(row.thumbPath);
      const tmpThumb = tempBeside(thumb);
      await writeThumbnail(abs, tmpThumb, row.kind === "video" ? { at: "0.2" } : undefined);
      await fs.rename(tmpThumb, thumb);
    }
    const stat = await fs.stat(abs);
    db.update(messageAttachments)
      .set({ size: stat.size })
      .where(eq(messageAttachments.id, row.id))
      .run();
    process.stdout.write(`id=${row.id} kind=${row.kind} bytes=${stat.size}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "reprocess";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
