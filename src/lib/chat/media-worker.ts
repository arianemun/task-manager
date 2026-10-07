import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaJobs, messageAttachments } from "@/db/schema";
import { resolveUploadPath } from "@/lib/uploads/avatar";
import { loadMessage } from "./store";
import { CHAT_VIDEO_MAX_MS, type ChatMessage } from "./types";

const execFileAsync = promisify(execFile);
let busy = false;

async function probeDurationMs(file: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  const seconds = Number(String(stdout).trim());
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
}

async function transcode(attachmentId: number): Promise<void> {
  const row = db
    .select()
    .from(messageAttachments)
    .where(eq(messageAttachments.id, attachmentId))
    .get();
  if (!row) throw new Error("پیوست پیدا نشد");
  const input = resolveUploadPath(row.path);
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  const outputName = row.kind === "video" ? `${base}.ready.mp4` : `${base}.ready.jpg`;
  const thumbName = `${base}.thumb.jpg`;
  const output = path.join(dir, outputName);
  const thumb = path.join(dir, thumbName);
  let durationMs: number | null = null;
  if (row.kind === "video") {
    durationMs = await probeDurationMs(input);
    if (durationMs > CHAT_VIDEO_MAX_MS) {
      throw new Error("ویدیو حداکثر ۵ دقیقه است");
    }
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      input,
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      output,
    ]);
  } else {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      input,
      "-vf",
      "scale='min(1920,iw)':-2",
      output,
    ]);
  }
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    "0.2",
    "-i",
    output,
    "-frames:v",
    "1",
    "-vf",
    "scale='min(480,iw)':-2",
    thumb,
  ]);
  const stat = await fs.stat(output);
  const relativeOut = path.posix.join(path.posix.dirname(row.path), outputName);
  const relativeThumb = path.posix.join(path.posix.dirname(row.path), thumbName);
  db.update(messageAttachments)
    .set({
      path: relativeOut,
      thumbPath: relativeThumb,
      mime: row.kind === "video" ? "video/mp4" : "image/jpeg",
      size: stat.size,
      durationMs,
      status: "READY",
    })
    .where(eq(messageAttachments.id, row.id))
    .run();
  if (input !== output) await fs.rm(input, { force: true });
}

export async function processNextMediaJob(): Promise<ChatMessage | null> {
  if (busy) return null;
  const job = db
    .select()
    .from(mediaJobs)
    .where(eq(mediaJobs.status, "PENDING"))
    .orderBy(mediaJobs.id)
    .limit(1)
    .get();
  if (!job) return null;
  busy = true;
  const now = new Date();
  db.update(mediaJobs)
    .set({ status: "PROCESSING", attempts: job.attempts + 1, updatedAt: now })
    .where(eq(mediaJobs.id, job.id))
    .run();
  try {
    await transcode(job.attachmentId);
    db.update(mediaJobs)
      .set({ status: "DONE", updatedAt: new Date() })
      .where(eq(mediaJobs.id, job.id))
      .run();
    const attachment = db
      .select({ messageId: messageAttachments.messageId })
      .from(messageAttachments)
      .where(eq(messageAttachments.id, job.attachmentId))
      .get();
    return attachment?.messageId ? loadMessage(attachment.messageId) : null;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "ffmpeg";
    db.update(mediaJobs)
      .set({ status: "FAILED", lastError: message, updatedAt: new Date() })
      .where(eq(mediaJobs.id, job.id))
      .run();
    db.update(messageAttachments)
      .set({ status: "FAILED" })
      .where(eq(messageAttachments.id, job.attachmentId))
      .run();
    const attachment = db
      .select({ messageId: messageAttachments.messageId })
      .from(messageAttachments)
      .where(eq(messageAttachments.id, job.attachmentId))
      .get();
    return attachment?.messageId ? loadMessage(attachment.messageId) : null;
  } finally {
    busy = false;
  }
}
