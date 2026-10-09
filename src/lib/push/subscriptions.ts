import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { subscriptionHostAllowed } from "./hosts";

export type PushDevice = {
  id: number;
  endpoint: string;
  deviceLabel: string | null;
  userAgent: string | null;
  createdAt: number;
  lastSuccessAt: number | null;
  failedCount: number;
};

export function upsertPushSubscription(input: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  deviceLabel?: string | null;
  previousEndpoint?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!subscriptionHostAllowed(input.endpoint)) {
    return { ok: false, error: "مقصد اشتراک مجاز نیست" };
  }
  if (!input.p256dh || !input.auth) return { ok: false, error: "کلید اشتراک ناقص است" };
  const now = new Date();
  const previous = input.previousEndpoint?.trim();
  if (previous && previous !== input.endpoint) {
    db.delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, input.userId), eq(pushSubscriptions.endpoint, previous)))
      .run();
  }
  const existing = db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, input.endpoint))
    .get();
  if (existing) {
    db.update(pushSubscriptions)
      .set({
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        deviceLabel: input.deviceLabel ?? null,
        failedCount: 0,
        disabledAt: null,
      })
      .where(eq(pushSubscriptions.id, existing.id))
      .run();
    return { ok: true };
  }
  db.insert(pushSubscriptions)
    .values({
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      deviceLabel: input.deviceLabel ?? null,
      createdAt: now,
    })
    .run();
  return { ok: true };
}

export function deletePushSubscription(userId: number, endpoint: string): void {
  db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .run();
}

export function deletePushSubscriptionByEndpoint(endpoint: string): void {
  db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
}

export function listPushDevices(userId: number): PushDevice[] {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .all()
    .map((row) => ({
      id: row.id,
      endpoint: row.endpoint,
      deviceLabel: row.deviceLabel,
      userAgent: row.userAgent,
      createdAt: row.createdAt.getTime(),
      lastSuccessAt: row.lastSuccessAt?.getTime() ?? null,
      failedCount: row.failedCount,
    }));
}

export function activePushSubscriptions(userId: number) {
  return db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), isNull(pushSubscriptions.disabledAt)))
    .all();
}

export function notePushSuccess(id: number, now = Date.now()): void {
  db.update(pushSubscriptions)
    .set({ lastSuccessAt: new Date(now), failedCount: 0 })
    .where(eq(pushSubscriptions.id, id))
    .run();
}

export function notePushFailure(id: number, now = Date.now(), disableAfter: number): void {
  const row = db
    .select({ failedCount: pushSubscriptions.failedCount })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.id, id))
    .get();
  if (!row) return;
  const failedCount = row.failedCount + 1;
  db.update(pushSubscriptions)
    .set({
      failedCount,
      disabledAt: failedCount >= disableAfter ? new Date(now) : null,
    })
    .where(eq(pushSubscriptions.id, id))
    .run();
}
