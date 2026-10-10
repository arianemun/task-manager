"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { parseClock } from "@/lib/push/policy";
import { saveTaskNotifySettings } from "@/lib/notifications/task-settings";

export async function saveTaskNotifySettingsAction(formData: FormData): Promise<void> {
  await requireUser({ roles: ["ADMIN"] });
  const digestTime = String(formData.get("digestTime") ?? "");
  const summaryTime = String(formData.get("summaryTime") ?? "");
  const dueSoonMinutes = Number(formData.get("dueSoonMinutes"));
  const overdueAfterMinutes = Number(formData.get("overdueAfterMinutes"));
  if (parseClock(digestTime) == null || parseClock(summaryTime) == null) return;
  if (
    !Number.isInteger(dueSoonMinutes) ||
    dueSoonMinutes < 1 ||
    dueSoonMinutes > 240 ||
    !Number.isInteger(overdueAfterMinutes) ||
    overdueAfterMinutes < 1 ||
    overdueAfterMinutes > 240
  ) {
    return;
  }
  saveTaskNotifySettings({ digestTime, summaryTime, dueSoonMinutes, overdueAfterMinutes });
  revalidatePath("/admin/settings");
}
