"use server";

import { NOTIFICATION_TYPES, type NotificationType } from "@/db/schema";
import { requireUser } from "@/lib/auth/user";
import {
  commitAssignedForUser,
  commitTaskNotices,
  previewTaskNotices,
} from "@/lib/notifications/task-notify";
import type { TaskNoticePlan } from "@/lib/notifications/task-notify";

function typeOf(value: FormDataEntryValue | null): NotificationType | null {
  const raw = String(value ?? "");
  return NOTIFICATION_TYPES.includes(raw as NotificationType) ? (raw as NotificationType) : null;
}

export async function previewTaskNotifyAction(formData: FormData): Promise<TaskNoticePlan[]> {
  await requireUser({ roles: ["ADMIN"] });
  const type = typeOf(formData.get("type"));
  const userId = Number(formData.get("userId"));
  if (!type || !Number.isInteger(userId)) return [];
  return previewTaskNotices({ type, userId });
}

export async function sendTaskNotifyAction(formData: FormData): Promise<TaskNoticePlan[]> {
  await requireUser({ roles: ["ADMIN"] });
  const type = typeOf(formData.get("type"));
  const userId = Number(formData.get("userId"));
  if (!type || !Number.isInteger(userId)) return [];
  const plans = previewTaskNotices({ type, userId });
  if (type === "task.assigned") {
    if (plans.some((plan) => plan.willSend)) commitAssignedForUser(userId);
    return plans;
  }
  commitTaskNotices(plans);
  return plans;
}
