"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  taskAssignments,
  taskOccurrences,
  taskTemplates,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { activeMembersOfDepartment } from "@/lib/departments/membership";
import { isAuthError } from "@/lib/auth/errors";
import { requirePermission, requireUser } from "@/lib/auth/user";
import {
  assertAssigneeInScope,
  assertCanEditTemplate,
} from "@/lib/scope/tasks";
import { taskFormSchema } from "@/lib/validation/task";
import {
  generateForTemplate,
  removePendingOnUnassign,
} from "@/server/services/occurrence-generate";
import type { ActionResult } from "./auth";

function parseJsonField<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseTaskForm(formData: FormData) {
  const recurrenceType = String(formData.get("recurrenceType") || "DAILY");
  return taskFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    categoryId: formData.get("categoryId") || null,
    priority: formData.get("priority") || "MEDIUM",
    requiresNote: formData.get("requiresNote") === "true",
    requiresAttachment: formData.get("requiresAttachment") === "true",
    skipHolidays: formData.get("skipHolidays") !== "false",
    completionMode:
      formData.get("completionMode") === "SHARED" ? "SHARED" : "INDIVIDUAL",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || null,
    dueTime: formData.get("dueTime") || null,
    userIds: parseJsonField<number[]>(formData.get("userIds"), []),
    departmentIds: parseJsonField<number[]>(formData.get("departmentIds"), []),
    recurrenceType,
    recurrenceConfig: parseJsonField(formData.get("recurrenceConfig"), {}),
  });
}

function syncAssignments(
  templateId: number,
  userIds: number[],
  departmentIds: number[],
) {
  const existing = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .all();

  const prevUserIds = existing
    .filter((a) => a.assigneeType === "USER" && a.userId)
    .map((a) => a.userId!);

  db.delete(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .run();

  for (const userId of userIds) {
    db.insert(taskAssignments)
      .values({ templateId, assigneeType: "USER", userId })
      .run();
  }
  for (const departmentId of departmentIds) {
    db.insert(taskAssignments)
      .values({ templateId, assigneeType: "DEPARTMENT", departmentId })
      .run();
  }

  const removedUsers = prevUserIds.filter((id) => !userIds.includes(id));
  // کاربرانی که دیگر نه مستقیم و نه از دپارتمان پوشش داده نمی‌شوند
  const stillCovered = new Set<number>();
  for (const departmentId of departmentIds) {
    activeMembersOfDepartment(departmentId).forEach((member) =>
      stillCovered.add(member.user.id),
    );
  }
  userIds.forEach((id) => stillCovered.add(id));

  const toClear = removedUsers.filter((id) => !stillCovered.has(id));
  if (toClear.length) {
    removePendingOnUnassign({ templateId, userIds: toClear });
  }
}

export async function createTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { taskId?: number; recurrenceChangedHint?: string }> {
  try {
    const actor = await requirePermission("tasks.create");
    const parsed = parseTaskForm(formData);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }
    const data = parsed.data;
    if (actor.role === "MANAGER") {
      data.departmentIds = data.departmentIds.filter((id) =>
        actor.departmentIds.includes(id),
      );
    }
    assertAssigneeInScope(actor, data.userIds, data.departmentIds);

    const row = db
      .insert(taskTemplates)
      .values({
        title: data.title,
        description: data.description || null,
        categoryId: data.categoryId ?? null,
        priority: data.priority,
        requiresNote: data.requiresNote,
        requiresAttachment: data.requiresAttachment,
        skipHolidays: data.skipHolidays,
        completionMode: data.completionMode,
        recurrenceType: data.recurrenceType,
        recurrenceConfig: data.recurrenceConfig,
        startDate: data.startDate,
        endDate: data.endDate || null,
        dueTime: data.dueTime || null,
        isActive: true,
        createdBy: actor.id,
      })
      .returning({ id: taskTemplates.id })
      .get();

    syncAssignments(row.id, data.userIds, data.departmentIds);
    generateForTemplate(row.id);

    writeAuditLog({
      actorId: actor.id,
      action: "task.create",
      entity: "task_template",
      entityId: row.id,
      meta: { title: data.title, recurrenceType: data.recurrenceType },
    });

    revalidatePath("/admin/tasks");
    revalidatePath("/admin/board");
    return { ok: true, taskId: row.id };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { recurrenceChangedHint?: string }> {
  try {
    const actor = await requirePermission("tasks.create");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return { ok: false, error: "شناسه نامعتبر" };

    assertCanEditTemplate(actor, id);
    const existing = db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, id))
      .get();
    if (!existing) return { ok: false, error: "کار یافت نشد" };

    const parsed = parseTaskForm(formData);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }
    const data = parsed.data;
    if (actor.role === "MANAGER") {
      data.departmentIds = data.departmentIds.filter((id) =>
        actor.departmentIds.includes(id),
      );
    }
    assertAssigneeInScope(actor, data.userIds, data.departmentIds);

    const recurrenceChanged =
      existing.recurrenceType !== data.recurrenceType ||
      JSON.stringify(existing.recurrenceConfig) !==
        JSON.stringify(data.recurrenceConfig);

    db.update(taskTemplates)
      .set({
        title: data.title,
        description: data.description || null,
        categoryId: data.categoryId ?? null,
        priority: data.priority,
        requiresNote: data.requiresNote,
        requiresAttachment: data.requiresAttachment,
        skipHolidays: data.skipHolidays,
        completionMode: data.completionMode,
        recurrenceType: data.recurrenceType,
        recurrenceConfig: data.recurrenceConfig,
        startDate: data.startDate,
        endDate: data.endDate || null,
        dueTime: data.dueTime || null,
        updatedAt: new Date(),
      })
      .where(eq(taskTemplates.id, id))
      .run();

    syncAssignments(id, data.userIds, data.departmentIds);
    generateForTemplate(id);

    writeAuditLog({
      actorId: actor.id,
      action: "task.update",
      entity: "task_template",
      entityId: id,
      meta: { recurrenceChanged },
    });

    revalidatePath("/admin/tasks");
    revalidatePath(`/admin/tasks/${id}`);
    revalidatePath("/admin/board");

    return {
      ok: true,
      recurrenceChangedHint: recurrenceChanged
        ? "تغییر الگوی تکرار از فردا (دوره‌های آینده) اعمال می‌شود؛ تاریخچه حفظ شده است."
        : undefined,
    };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function archiveTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.create");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return { ok: false, error: "شناسه نامعتبر" };
    assertCanEditTemplate(actor, id);

    const occCount =
      db
        .select({ c: count() })
        .from(taskOccurrences)
        .where(eq(taskOccurrences.templateId, id))
        .get()?.c ?? 0;

    // همیشه آرشیو — حتی بدون occurrence حذف فیزیکی نداریم
    db.update(taskTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(taskTemplates.id, id))
      .run();

    const assignees = db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.templateId, id))
      .all();
    const userIds = new Set<number>();
    for (const a of assignees) {
      if (a.userId) userIds.add(a.userId);
      if (a.departmentId) {
        activeMembersOfDepartment(a.departmentId).forEach((member) =>
          userIds.add(member.user.id),
        );
      }
    }
    removePendingOnUnassign({ templateId: id, userIds: [...userIds] });

    writeAuditLog({
      actorId: actor.id,
      action: "task.archive",
      entity: "task_template",
      entityId: id,
      meta: { hadOccurrences: occCount > 0 },
    });

    revalidatePath("/admin/tasks");
    revalidatePath("/admin/board");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function activateTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.create");
    const id = Number(formData.get("id"));
    assertCanEditTemplate(actor, id);
    db.update(taskTemplates)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(taskTemplates.id, id))
      .run();
    generateForTemplate(id);
    writeAuditLog({
      actorId: actor.id,
      action: "task.activate",
      entity: "task_template",
      entityId: id,
    });
    revalidatePath("/admin/tasks");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function countUniqueAssigneesAction(
  userIds: number[],
  departmentIds: number[],
): Promise<number> {
  await requireUser({ roles: ["ADMIN", "MANAGER"] });
  const set = new Set(userIds);
  for (const departmentId of departmentIds) {
    activeMembersOfDepartment(departmentId).forEach((member) =>
      set.add(member.user.id),
    );
  }
  return set.size;
}
