"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/user";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/store";

export async function markNotificationReadAction(id: number): Promise<void> {
  const user = await requireUser();
  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) return;
  markNotificationRead(user.id, parsed.data);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  markAllNotificationsRead(user.id);
  revalidatePath("/notifications");
}
