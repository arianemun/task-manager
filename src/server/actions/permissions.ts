"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/user";
import { permissionSnoozeUntil } from "@/lib/permissions/status";

export async function snoozePermissionPrepAction(): Promise<
  { ok: true; until: number } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    const until = permissionSnoozeUntil(Date.now());
    db.update(users)
      .set({
        permissionsSnoozeUntil: new Date(until),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .run();
    return { ok: true, until };
  } catch {
    return { ok: false, error: "ذخیره نشد. دوباره تلاش کنید" };
  }
}

export async function completePermissionSetupAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    db.update(users)
      .set({
        permissionsSetupCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .run();
    return { ok: true };
  } catch {
    return { ok: false, error: "ذخیره نشد. دوباره تلاش کنید" };
  }
}
