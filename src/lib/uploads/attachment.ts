import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { AuthError } from "@/lib/auth/errors";

const MAX_BYTES = 5 * 1024 * 1024;

const SIGNATURES: {
  ext: "jpg" | "png" | "webp" | "pdf";
  check: (b: Buffer) => boolean;
}[] = [
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
  {
    ext: "pdf",
    check: (b) => b.length > 4 && b.toString("ascii", 0, 4) === "%PDF",
  },
];

function uploadRoot(): string {
  const dir = process.env.UPLOAD_DIR ?? "./uploads";
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

export async function saveOccurrenceAttachment(
  userId: number,
  occurrenceId: number,
  file: File,
): Promise<string> {
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new AuthError("VALIDATION", "حجم فایل حداکثر ۵ مگابایت است");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const match = SIGNATURES.find((s) => s.check(buf));
  if (!match) {
    throw new AuthError(
      "VALIDATION",
      "فقط jpg، png، webp یا pdf مجاز است",
    );
  }

  const relDir = path.join(
    "attachments",
    String(userId),
    String(occurrenceId),
  );
  const absDir = path.join(uploadRoot(), relDir);
  await fs.mkdir(absDir, { recursive: true });

  const filename = `${randomBytes(8).toString("hex")}.${match.ext}`;
  await fs.writeFile(path.join(absDir, filename), buf);

  return path.join(relDir, filename).replace(/\\/g, "/");
}

export function parseAttachmentPath(relative: string): {
  userId: number;
  occurrenceId: number;
} | null {
  const parts = relative.replace(/\\/g, "/").split("/");
  if (parts[0] !== "attachments" || parts.length < 4) return null;
  const userId = Number(parts[1]);
  const occurrenceId = Number(parts[2]);
  if (!Number.isInteger(userId) || !Number.isInteger(occurrenceId)) return null;
  return { userId, occurrenceId };
}
