"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { taskOccurrences, taskTemplates, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { isAuthError } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/user";
import { compareGDate, todayTehran } from "@/lib/dates";
import { statusFromCompletion } from "@/lib/recurrence";
import { isStaffResponseLocked } from "@/lib/tasks/response-lock";
import { notDoneNoteRequired } from "@/lib/tasks/not-done-note";
import { responseBlockedBeforeStart } from "@/lib/tasks/start-time";
import { saveOccurrenceAttachment } from "@/lib/uploads/attachment";
import { getNotDoneReasonsForDepartments } from "@/lib/settings/not-done-reasons";
import { recordGroupOutcome } from "@/server/services/group-completion";
import type { ActionResult } from "./auth";

export type SubmitResult = ActionResult & {
  occurrence?: {
    id: number;
    status: string;
    completedAt: number | null;
    note: string | null;
    reasonCode: string | null;
    attachmentPath: string | null;
    editedAt: number | null;
  };
};

function assertCanMutateOccurrence(
  occ: typeof taskOccurrences.$inferSelect,
  userId: number,
) {
  const today = todayTehran();
  if (occ.userId !== userId) {
    throw new Error("FORBIDDEN");
  }
  if (compareGDate(occ.periodStart, today) > 0) {
    throw new Error("FUTURE");
  }
  // قفل با period_end است، نه با انتظار برای MISSED در close-periods.
  // due_at اینجا دخیل نیست؛ statusFromCompletion ثبت دیرهنگام را DONE_LATE می‌کند.
  if (
    isStaffResponseLocked({
      status: occ.status,
      periodEnd: occ.periodEnd,
      today,
    })
  ) {
    throw new Error("LOCKED");
  }
}

export async function submitOccurrenceAction(
  formData: FormData,
): Promise<SubmitResult> {
  try {
    const actor = await requireUser({
      roles: ["STAFF", "ADMIN", "MANAGER"],
    });
    const occurrenceId = Number(formData.get("occurrenceId"));
    const intent = String(formData.get("intent") || ""); // done | not_done
    if (!Number.isInteger(occurrenceId)) {
      return { ok: false, error: "شناسه نامعتبر" };
    }
    if (intent !== "done" && intent !== "not_done") {
      return { ok: false, error: "عملیات نامعتبر" };
    }

    const occ = db
      .select()
      .from(taskOccurrences)
      .where(eq(taskOccurrences.id, occurrenceId))
      .get();
    if (!occ) return { ok: false, error: "یافت نشد" };

    try {
      assertCanMutateOccurrence(occ, actor.id);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "FUTURE") {
        return { ok: false, error: "ثبت برای دوره آینده مجاز نیست" };
      }
      if (code === "LOCKED") {
        return { ok: false, error: "این کار قفل شده و فقط خواندنی است" };
      }
      return { ok: false, error: "دسترسی غیرمجاز" };
    }

    const template = db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, occ.templateId))
      .get();
    if (!template) return { ok: false, error: "قالب یافت نشد" };

    const notStarted = responseBlockedBeforeStart(template.startTime);
    if (notStarted) return { ok: false, error: notStarted };

    if (occ.completedByUserId && occ.completedByUserId !== actor.id) {
      const person = db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, occ.completedByUserId))
        .get();
      return {
        ok: false,
        error: `این کار گروهی را ${person?.fullName ?? "همکار"} ثبت کرده است`,
      };
    }

    const note = String(formData.get("note") || "").trim();
    const reasonCode = String(formData.get("reasonCode") || "").trim() || null;
    const file = formData.get("attachment");

    const departmentReasons =
      intent === "not_done" ? getNotDoneReasonsForDepartments(actor.departmentIds) : [];
    if (intent === "not_done") {
      if (!reasonCode) {
        return { ok: false, error: "دلیل انجام‌نشدن الزامی است" };
      }
      const selected = departmentReasons.find((reason) => reason.code === reasonCode);
      if (reasonCode !== occ.reasonCode && !selected) {
        return { ok: false, error: "این دلیل برای دپارتمان شما مجاز نیست" };
      }
      if (
        notDoneNoteRequired({
          requiresNote: template.requiresNote,
          reason: selected ?? { code: reasonCode, label: "" },
        }) &&
        !note
      ) {
        return { ok: false, error: "توضیح برای این کار الزامی است" };
      }
    } else if (template.requiresNote && !note) {
      return { ok: false, error: "توضیح برای این کار الزامی است" };
    }

    let attachmentPath = occ.attachmentPath;
    if (file instanceof File && file.size > 0) {
      attachmentPath = await saveOccurrenceAttachment(
        actor.id,
        occurrenceId,
        file,
      );
    }
    if (template.requiresAttachment && !attachmentPath) {
      return { ok: false, error: "پیوست برای این کار الزامی است" };
    }

    const now = new Date();
    const wasResponded = occ.status !== "PENDING";
    let status: typeof occ.status;
    if (intent === "done") {
      status = statusFromCompletion(
        now.getTime(),
        occ.dueAt ? occ.dueAt.getTime() : null,
      );
    } else {
      status = "NOT_DONE";
    }

    if (status !== "DONE" && status !== "DONE_LATE" && status !== "NOT_DONE") {
      return { ok: false, error: "وضعیت نامعتبر است" };
    }

    const group = recordGroupOutcome({
      templateId: occ.templateId,
      periodKey: occ.periodKey,
      completerUserId: actor.id,
      sourceOccurrenceId: occurrenceId,
      status,
      completedAt: now,
      note: note || null,
      reasonCode: intent === "not_done" ? reasonCode : null,
      attachmentPath,
      editedAt: wasResponded ? now : occ.editedAt,
    });
    if (group.mode === "blocked") {
      return {
        ok: false,
        error: `این کار گروهی را ${group.name} ثبت کرده است`,
      };
    }
    if (group.mode === "personal") {
      db.update(taskOccurrences)
        .set({
          status,
          completedAt: now,
          note: note || null,
          reasonCode: intent === "not_done" ? reasonCode : null,
          attachmentPath,
          editedAt: wasResponded ? now : occ.editedAt,
          updatedAt: now,
        })
        .where(eq(taskOccurrences.id, occurrenceId))
        .run();
    }

    writeAuditLog({
      actorId: actor.id,
      action: wasResponded ? "occurrence.edit" : "occurrence.submit",
      entity: "task_occurrence",
      entityId: occurrenceId,
      meta: { intent, status, reasonCode },
    });

    revalidatePath("/me");
    revalidatePath("/me/calendar");
    revalidatePath("/me/report");
    revalidatePath("/admin/board");

    return {
      ok: true,
      occurrence: {
        id: occurrenceId,
        status,
        completedAt: now.getTime(),
        note: note || null,
        reasonCode: intent === "not_done" ? reasonCode : null,
        attachmentPath,
        editedAt: wasResponded ? now.getTime() : null,
      },
    };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}
