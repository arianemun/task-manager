import fs from "node:fs";
import path from "node:path";

/** الگوهایی که zip روزانه نباید از پوشهٔ آپلود بردارد. */
export const UPLOAD_ZIP_EXCLUDES = ["chat", "chat/*"];

export function copyNewFiles(sourceDir: string, destDir: string): { copied: number; skipped: number } {
  let copied = 0;
  let skipped = 0;
  if (!fs.existsSync(sourceDir)) return { copied, skipped };
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const from = path.join(current, entry.name);
      const rel = path.relative(sourceDir, from);
      const to = path.join(destDir, rel);
      if (entry.isDirectory()) {
        walk(from);
        continue;
      }
      if (!entry.isFile()) continue;
      if (fs.existsSync(to)) {
        skipped += 1;
        continue;
      }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied += 1;
    }
  };
  walk(sourceDir);
  return { copied, skipped };
}
