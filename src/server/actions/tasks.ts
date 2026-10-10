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
import { changedFields } from "@/lib/audit-diff";
import { prepareBulkTitles } from "@/lib/tasks/bulk-titles";
import { activeMembersOfDepartment } from "@/lib/departments/membership";
import { isAuthError } from "@/lib/auth/errors";
import { requirePermission, requireUser } from "@/lib/auth/user";
import {
  assertAssigneeInScope,
  assertCanEditTemplate,
} from "@/lib/scope/tasks";
import { taskFormSchema, type TaskFormInput } from "@/lib/validation/task";
import {
  generateForTemplate,
  removePendingOnUnassign,
} from "@/server/services/occurrence-generate";
import {
  coveredAssigneeIds,
  notifyTemplateAssignees,
} from "@/lib/notifications/task-notify";
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
    priority: formData.get("priority") || "SCHEDULE",
    requiresNote: formData.get("requiresNote") === "true",
    requiresAttachment: formData.get("requiresAttachment") === "true",
    skipHolidays: formData.get("skipHolidays") !== "false",
    completionMode:
      formData.get("completionMode") === "SHARED" ? "SHARED" : "INDIVIDUAL",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || null,
    startTime: formData.get("startTime") || null,
    dueTime: formData.get("dueTime") || null,
    userIds: parseJsonField<number[]>(formData.get("userIds"), []),
    departmentIds: parseJsonField<number[]>(formData.get("departmentIds"), []),
    recurrenceType,
    recurrenceConfig: parseJsonField(formData.get("recurrenceConfig"), {}),
  });
}

function revalidateTaskSurfaces(id?: number) {
  revalidatePath("/admin/tasks");
  if (id) revalidatePath(`/admin/tasks/${id}`);
  revalidatePath("/admin/board");
  revalidatePath("/me");
}

function saveFailed(error: unknown): { ok: false; error: string } {
  if (isAuthError(error)) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "ذخیره کار انجام نشد" };
}

const TASK_AUDIT_FIELDS = [
  "title",
  "description",
  "categoryId",
  "priority",
  "recurrenceType",
  "recurrenceConfig",
  "startDate",
  "endDate",
  "startTime",
  "dueTime",
  "completionMode",
  "userIds",
  "departmentIds",
] as const;

function taskAuditRecord(data: TaskFormInput) {
  return {
    title: data.title,
    description: data.description || null,
    categoryId: data.categoryId ?? null,
    priority: data.priority,
    recurrenceType: data.recurrenceType,
    recurrenceConfig: data.recurrenceConfig,
    startDate: data.startDate,
    endDate: data.endDate || null,
    startTime: data.startTime || null,
    dueTime: data.dueTime || null,
    completionMode: data.completionMode,
    userIds: data.userIds,
    departmentIds: data.departmentIds,
  };
}

function currentAssignees(templateId: number) {
  const existing = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .all();
  return {
    userIds: existing
      .filter((row) => row.assigneeType === "USER" && row.userId)
      .map((row) => row.userId!),
    departmentIds: existing
      .filter((row) => row.assigneeType === "DEPARTMENT" && row.departmentId)
      .map((row) => row.departmentId!),
  };
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
): Promise<ActionResult & { taskId?: number; after?: "edit" | "new"; recurrenceChangedHint?: string }> {
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
        startTime: data.startTime || null,
        dueTime: data.dueTime || null,
        isActive: true,
        createdBy: actor.id,
      })
      .returning({ id: taskTemplates.id })
      .get();

    syncAssignments(row.id, data.userIds, data.departmentIds);
    generateForTemplate(row.id);
    try {
      notifyTemplateAssignees(row.id);
    } catch {
      /* اعلان نباید ساخت کار را متوقف کند */
    }

    writeAuditLog({
      actorId: actor.id,
      action: "task.create",
      entity: "task_template",
      entityId: row.id,
      meta: { snapshot: taskAuditRecord(data) },
    });

    revalidateTaskSurfaces(row.id);
    return {
      ok: true,
      taskId: row.id,
      after: formData.get("after") === "new" ? "new" : "edit",
    };
  } catch (e) {
    return saveFailed(e);
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

    const beforeAssignees = currentAssignees(id);
    const beforeUsers = new Set(
      coveredAssigneeIds(beforeAssignees.userIds, beforeAssignees.departmentIds),
    );
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
        startTime: data.startTime || null,
        dueTime: data.dueTime || null,
        updatedAt: new Date(),
      })
      .where(eq(taskTemplates.id, id))
      .run();

    syncAssignments(id, data.userIds, data.departmentIds);
    generateForTemplate(id);
    const addedUsers = coveredAssigneeIds(data.userIds, data.departmentIds).filter(
      (userId) => !beforeUsers.has(userId),
    );
    if (addedUsers.length > 0) {
      try {
        notifyTemplateAssignees(id, addedUsers);
      } catch {
        /* اعلان نباید ویرایش کار را متوقف کند */
      }
    }

    writeAuditLog({
      actorId: actor.id,
      action: "task.update",
      entity: "task_template",
      entityId: id,
      meta: changedFields(
        {
          title: existing.title,
          description: existing.description,
          categoryId: existing.categoryId,
          priority: existing.priority,
          recurrenceType: existing.recurrenceType,
          recurrenceConfig: existing.recurrenceConfig,
          startDate: existing.startDate,
          endDate: existing.endDate,
          startTime: existing.startTime,
          dueTime: existing.dueTime,
          completionMode: existing.completionMode,
          userIds: beforeAssignees.userIds,
          departmentIds: beforeAssignees.departmentIds,
        },
        taskAuditRecord(data),
        TASK_AUDIT_FIELDS,
      ),
    });

    revalidateTaskSurfaces(id);

    return {
      ok: true,
      recurrenceChangedHint: recurrenceChanged
        ? "تغییر الگوی تکرار از فردا (دوره‌های آینده) اعمال می‌شود؛ تاریخچه حفظ شده است."
        : undefined,
    };
  } catch (e) {
    return saveFailed(e);
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

const BULK_TITLE_LIMIT = 200;

export async function bulkCreateTasksAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { taskIds?: number[] }> {
  try {
    const actor = await requirePermission("tasks.create");
    const prepared = prepareBulkTitles(String(formData.get("titles") ?? ""));
    if (prepared.length === 0) {
      return { ok: false, error: "حداقل یک عنوان لازم است" };
    }
    if (prepared.length > BULK_TITLE_LIMIT) {
      return { ok: false, error: "در هر بار حداکثر ۲۰۰ عنوان می‌توان ساخت" };
    }

    if (!String(formData.get("title") ?? "").trim()) {
      formData.set("title", prepared[0]!.title);
    }
    const parsed = parseTaskForm(formData);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((item) => item.path[0] !== "title");
      return { ok: false, error: issue?.message ?? parsed.error.issues[0]?.message ?? "نامعتبر" };
    }
    const shared = parsed.data;
    if (actor.role === "MANAGER") {
      shared.departmentIds = shared.departmentIds.filter((id) =>
        actor.departmentIds.includes(id),
      );
    }
    assertAssigneeInScope(actor, shared.userIds, shared.departmentIds);

    const ids: number[] = [];
    db.transaction(() => {
      for (const item of prepared) {
        const data = { ...shared, title: item.title };
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
            startTime: data.startTime || null,
            dueTime: data.dueTime || null,
            isActive: true,
            createdBy: actor.id,
          })
          .returning({ id: taskTemplates.id })
          .get();
        syncAssignments(row.id, data.userIds, data.departmentIds);
        generateForTemplate(row.id);
        try {
          notifyTemplateAssignees(row.id);
        } catch {
          /* اعلان نباید ساخت گروهی را متوقف کند */
        }
        writeAuditLog({
          actorId: actor.id,
          action: "task.create",
          entity: "task_template",
          entityId: row.id,
          meta: { snapshot: taskAuditRecord(data) },
        });
        ids.push(row.id);
      }
      writeAuditLog({
        actorId: actor.id,
        action: "task.bulk_create",
        entity: "task_template",
        entityId: null,
        meta: { ids },
      });
    });

    revalidateTaskSurfaces();
    return { ok: true, taskIds: ids };
  } catch (e) {
    return saveFailed(e);
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
