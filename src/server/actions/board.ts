"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { staffLeaves, taskOccurrences, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { isAuthError } from "@/lib/auth/errors";
import { requirePermission } from "@/lib/auth/user";
import { compareGDate } from "@/lib/dates";
import { assertUserInScope } from "@/lib/scope/users";
import {
  excuseOccurrencesInRange,
  generateOccurrences,
} from "@/server/services/occurrence-generate";
import type { ActionResult } from "./auth";

const statusSchema = z.enum([
  "PENDING",
  "DONE",
  "DONE_LATE",
  "NOT_DONE",
  "MISSED",
  "EXCUSED",
]);

export async function updateOccurrenceStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.assign");
    const occurrenceId = Number(formData.get("occurrenceId"));
    const statusParsed = statusSchema.safeParse(
      String(formData.get("status") || ""),
    );
    if (!statusParsed.success) {
      return { ok: false, error: "وضعیت نامعتبر است" };
    }
    const status = statusParsed.data;
    const reason = String(formData.get("reason") || "").trim();
    if (!reason) return { ok: false, error: "دلیل تغییر وضعیت الزامی است" };
    if (!Number.isInteger(occurrenceId)) {
      return { ok: false, error: "شناسه نامعتبر" };
    }

    const occ = db
      .select()
      .from(taskOccurrences)
      .where(eq(taskOccurrences.id, occurrenceId))
      .get();
    if (!occ) return { ok: false, error: "یافت نشد" };

    assertUserInScope(actor, occ.userId);

    const prev = occ.status;
    db.update(taskOccurrences)
      .set({
        status,
        note: reason,
        completedAt:
          status === "DONE" || status === "DONE_LATE"
            ? (occ.completedAt ?? new Date())
            : occ.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(taskOccurrences.id, occurrenceId))
      .run();

    writeAuditLog({
      actorId: actor.id,
      action: "occurrence.status_change",
      entity: "task_occurrence",
      entityId: occurrenceId,
      meta: { from: prev, to: status, reason },
    });

    revalidatePath("/admin/board");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function createStaffLeaveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.assign");
    const userId = Number(formData.get("userId"));
    const startDate = String(formData.get("startDate") || "");
    const endDate = String(formData.get("endDate") || "");
    const reason = String(formData.get("reason") || "").trim();

    if (!Number.isInteger(userId)) return { ok: false, error: "پرسنل نامعتبر" };
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return { ok: false, error: "بازه تاریخ نامعتبر است" };
    }
    if (compareGDate(endDate, startDate) < 0) {
      return { ok: false, error: "پایان بازه قبل از شروع است" };
    }
    if (!reason) return { ok: false, error: "دلیل معافیت الزامی است" };

    assertUserInScope(actor, userId);
    const u = db.select().from(users).where(eq(users.id, userId)).get();
    if (!u || !u.isActive || u.deletedAt) {
      return { ok: false, error: "پرسنل فعال نیست" };
    }

    db.insert(staffLeaves)
      .values({
        userId,
        startDate,
        endDate,
        reason,
        createdBy: actor.id,
      })
      .run();

    const excused = excuseOccurrencesInRange({
      userId,
      startDate,
      endDate,
      reason,
    });

    generateOccurrences({
      userId,
      from: startDate,
      to: endDate,
      skipCursorUpdate: true,
    });
    excuseOccurrencesInRange({ userId, startDate, endDate, reason });

    writeAuditLog({
      actorId: actor.id,
      action: "staff_leave.create",
      entity: "staff_leave",
      entityId: userId,
      meta: { startDate, endDate, reason, excused },
    });

    revalidatePath("/admin/board");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}
