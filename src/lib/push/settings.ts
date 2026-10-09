import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export const HIDE_CHAT_PREVIEW_KEY = "push_hide_chat_preview";

function quietDigestKey(userId: number): string {
  return `quiet_digest:${userId}`;
}

export function quietDigestMarked(userId: number): string | null {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, quietDigestKey(userId)))
    .get();
  return row?.value ?? null;
}

export function markQuietDigest(userId: number, periodEnd: number): void {
  const key = quietDigestKey(userId);
  const value = String(periodEnd);
  const existing = db.select({ key: settings.key }).from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key)).run();
    return;
  }
  db.insert(settings).values({ key, value }).run();
}

export function chatPreviewHidden(): boolean {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, HIDE_CHAT_PREVIEW_KEY))
    .get();
  return row?.value === "1";
}

export function setChatPreviewHidden(hidden: boolean): void {
  const value = hidden ? "1" : "0";
  const existing = db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, HIDE_CHAT_PREVIEW_KEY))
    .get();
  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, HIDE_CHAT_PREVIEW_KEY))
      .run();
    return;
  }
  db.insert(settings).values({ key: HIDE_CHAT_PREVIEW_KEY, value }).run();
}
