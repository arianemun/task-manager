"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { staffNotes } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { isAuthError } from "@/lib/auth/errors";
import { requirePermission } from "@/lib/auth/user";
import { assertUserInScope } from "@/lib/scope/users";
import type { ActionResult } from "./auth";

const noteSchema = z.object({
  userId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, "عنوان الزامی است").max(200),
  body: z.string().trim().min(1, "متن الزامی است").max(5000),
});

export async function createStaffNoteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("staff.manage");
    const parsed = noteSchema.safeParse({
      userId: formData.get("userId"),
      title: formData.get("title"),
      body: formData.get("body"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }

    assertUserInScope(actor, parsed.data.userId);

    const row = db
      .insert(staffNotes)
      .values({
        userId: parsed.data.userId,
        authorId: actor.id,
        title: parsed.data.title,
        body: parsed.data.body,
      })
      .returning({ id: staffNotes.id })
      .get();

    writeAuditLog({
      actorId: actor.id,
      action: "staff_note.create",
      entity: "staff_note",
      entityId: row.id,
      meta: { userId: parsed.data.userId },
    });

    revalidatePath(`/admin/staff/${parsed.data.userId}`);
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deleteStaffNoteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("staff.manage");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }

    const note = db.select().from(staffNotes).where(eq(staffNotes.id, id)).get();
    if (!note) return { ok: false, error: "یادداشت یافت نشد" };
    assertUserInScope(actor, note.userId);

    db.delete(staffNotes).where(eq(staffNotes.id, id)).run();
    writeAuditLog({
      actorId: actor.id,
      action: "staff_note.delete",
      entity: "staff_note",
      entityId: id,
      meta: { userId: note.userId },
    });

    revalidatePath(`/admin/staff/${note.userId}`);
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}
