import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaJobs, messageAttachments } from "@/db/schema";
import { resolveUploadPath } from "@/lib/uploads/avatar";
import { loadMessage } from "./store";
import {
  convertHeicToJpeg,
  probeDurationMs,
  transcodeImageFile,
  transcodeVideoFile,
  writeThumbnail,
} from "./transcode";
import { CHAT_VIDEO_MAX_MS, type ChatMessage } from "./types";

let busy = false;

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
    await transcodeVideoFile(input, output);
  } else {
    let imageInput = input;
    if (/\.hei[cf]$/i.test(input)) {
      imageInput = path.join(dir, `${base}.decoded.jpg`);
      await convertHeicToJpeg(input, imageInput);
    }
    try {
      await transcodeImageFile(imageInput, output);
    } finally {
      if (imageInput !== input) await fs.rm(imageInput, { force: true });
    }
  }
  await writeThumbnail(output, thumb, row.kind === "video" ? { at: "0.2" } : undefined);
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
