import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { AuthError } from "@/lib/auth/errors";

const MAX_BYTES = 2 * 1024 * 1024;

const SIGNATURES: { ext: "jpg" | "png" | "webp"; check: (b: Buffer) => boolean }[] =
  [
    {
      ext: "jpg",
      check: (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    {
      ext: "png",
      check: (b) =>
        b.length > 7 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47,
    },
    {
      ext: "webp",
      check: (b) =>
        b.length > 11 &&
        b.toString("ascii", 0, 4) === "RIFF" &&
        b.toString("ascii", 8, 12) === "WEBP",
    },
  ];

function uploadRoot(): string {
  const dir = process.env.UPLOAD_DIR ?? "./uploads";
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

export async function saveAvatarFile(
  userId: number,
  file: File,
): Promise<string> {
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new AuthError("VALIDATION", "حجم تصویر حداکثر ۲ مگابایت است");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const match = SIGNATURES.find((s) => s.check(buf));
  if (!match) {
    throw new AuthError(
      "VALIDATION",
      "فقط فایل‌های jpg، png یا webp مجاز است",
    );
  }

  const relDir = path.join("avatars", String(userId));
  const absDir = path.join(uploadRoot(), relDir);
  await fs.mkdir(absDir, { recursive: true });

  const filename = `${randomBytes(8).toString("hex")}.${match.ext}`;
  const absPath = path.join(absDir, filename);
  await fs.writeFile(absPath, buf);

  // مسیر نسبی ذخیره‌شده در DB — سرو از طریق route محافظت‌شده
  return path.join(relDir, filename).replace(/\\/g, "/");
}

export function resolveUploadPath(relativePath: string): string {
  const safe = relativePath
    .replace(/\0/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((p) => p && p !== "." && p !== "..")
    .join("/");
  const abs = path.resolve(uploadRoot(), safe);
  const root = path.resolve(uploadRoot());
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new AuthError("VALIDATION", "مسیر فایل نامعتبر است");
  }
  return abs;
}
