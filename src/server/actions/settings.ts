"use server";

import { requireUser } from "@/lib/auth/user";
import {
  getNotDoneReasons,
  type NotDoneReason,
} from "@/lib/settings/not-done-reasons";

export async function loadNotDoneReasonsAction(): Promise<NotDoneReason[]> {
  await requireUser({ roles: ["STAFF", "ADMIN", "MANAGER"] });
  return getNotDoneReasons();
}
