"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notificationPreferences, users, NOTIFICATION_TYPES, type NotificationType } from "@/db/schema";
import { requireUser } from "@/lib/auth/user";
import { parseClock } from "@/lib/push/policy";
import { deletePushSubscription } from "@/lib/push/subscriptions";
import { setChatPreviewHidden } from "@/lib/push/settings";
import type { ActionResult } from "./auth";

export async function saveQuietHoursAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  if (parseClock(start) == null || parseClock(end) == null) {
    return { ok: false, error: "ساعت نامعتبر است" };
  }
  db.update(users)
    .set({ quietHoursStart: start, quietHoursEnd: end, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .run();
  revalidatePath("/me/profile");
  return { ok: true };
}

export async function savePushPreferencesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  for (const type of NOTIFICATION_TYPES) {
    const push = formData.get(`push:${type}`) === "on";
    const existing = db
      .select({ type: notificationPreferences.type })
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, user.id), eq(notificationPreferences.type, type)))
      .get();
    if (existing) {
      db.update(notificationPreferences)
        .set({ push })
        .where(and(eq(notificationPreferences.userId, user.id), eq(notificationPreferences.type, type as NotificationType)))
        .run();
    } else {
      db.insert(notificationPreferences)
        .values({ userId: user.id, type, push, sms: false })
        .run();
    }
  }
  revalidatePath("/me/profile");
  return { ok: true };
}

export async function removePushDeviceAction(endpoint: string): Promise<ActionResult> {
  const user = await requireUser();
  deletePushSubscription(user.id, endpoint);
  revalidatePath("/me/profile");
  return { ok: true };
}

export async function savePushPreviewAction(formData: FormData): Promise<void> {
  await requireUser({ roles: ["ADMIN"] });
  setChatPreviewHidden(formData.get("hide") === "on");
  revalidatePath("/admin/settings");
}
