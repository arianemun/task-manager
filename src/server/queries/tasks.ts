import { and, asc, count, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  taskAssignments,
  taskCategories,
  taskOccurrences,
  taskTemplates,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth/user";
import { describeRecurrence } from "@/lib/recurrence";
import { templatesVisibleToActor } from "@/lib/scope/tasks";
import { toSearchNeedle } from "@/lib/validation/iran";

export type TaskListFilters = {
  q?: string;
  categoryId?: number | null;
  recurrenceType?: string | null;
  status?: "active" | "archived" | "all";
  departmentId?: number | null;
  departmentIds?: number[];
};

export function listTasksForActor(actor: AuthUser, filters: TaskListFilters = {}) {
  const visible = templatesVisibleToActor(actor);
  if (visible.length === 0) {
    return [];
  }

  const conditions: SQL[] = [inArray(taskTemplates.id, visible)];

  if (filters.status === "archived") {
    conditions.push(eq(taskTemplates.isActive, false));
  } else if (filters.status !== "all") {
    conditions.push(eq(taskTemplates.isActive, true));
  }

  if (filters.categoryId) {
    conditions.push(eq(taskTemplates.categoryId, filters.categoryId));
  }
  if (filters.recurrenceType) {
    conditions.push(
      eq(
        taskTemplates.recurrenceType,
        filters.recurrenceType as typeof taskTemplates.$inferSelect.recurrenceType,
      ),
    );
  }
  if (filters.q?.trim()) {
    const needle = `%${toSearchNeedle(filters.q)}%`;
    const raw = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        like(taskTemplates.title, raw),
        sql`replace(replace(${taskTemplates.title}, 'ي', 'ی'), 'ك', 'ک') like ${needle}`,
      )!,
    );
  }
  const departmentFilter = filters.departmentIds?.length
    ? filters.departmentIds
    : filters.departmentId
      ? [filters.departmentId]
      : [];
  if (departmentFilter.length > 0) {
    const ids = db
      .select({ templateId: taskAssignments.templateId })
      .from(taskAssignments)
      .where(
        and(
          eq(taskAssignments.assigneeType, "DEPARTMENT"),
          inArray(taskAssignments.departmentId, departmentFilter),
        ),
      )
      .all()
      .map((r) => r.templateId);
    if (ids.length === 0) return [];
    conditions.push(inArray(taskTemplates.id, ids));
  }

  const rows = db
    .select({
      id: taskTemplates.id,
      title: taskTemplates.title,
      recurrenceType: taskTemplates.recurrenceType,
      recurrenceConfig: taskTemplates.recurrenceConfig,
      isActive: taskTemplates.isActive,
      priority: taskTemplates.priority,
      categoryName: taskCategories.name,
      startDate: taskTemplates.startDate,
    })
    .from(taskTemplates)
    .leftJoin(taskCategories, eq(taskTemplates.categoryId, taskCategories.id))
    .where(and(...conditions))
    .orderBy(asc(taskTemplates.title))
    .all();

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    recurrenceType: r.recurrenceType,
    recurrenceSummary: describeRecurrence(
      r.recurrenceType,
      (r.recurrenceConfig ?? {}) as Record<string, unknown>,
    ),
    isActive: r.isActive,
    priority: r.priority,
    categoryName: r.categoryName,
    startDate: r.startDate,
  }));
}

export function getTaskDetail(templateId: number) {
  const template = db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.id, templateId))
    .get();
  if (!template) return null;

  const assignments = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .all();

  const occurrenceCount =
    db
      .select({ c: count() })
      .from(taskOccurrences)
      .where(eq(taskOccurrences.templateId, templateId))
      .get()?.c ?? 0;

  return {
    template,
    assignments,
    occurrenceCount,
    userIds: assignments
      .filter((a) => a.assigneeType === "USER" && a.userId)
      .map((a) => a.userId!),
    departmentIds: assignments
      .filter((a) => a.assigneeType === "DEPARTMENT" && a.departmentId)
      .map((a) => a.departmentId!),
  };
}

export function listCategories() {
  return db.select().from(taskCategories).orderBy(asc(taskCategories.name)).all();
}

export function listDepartmentsSimple() {
  return db.select().from(departments).orderBy(asc(departments.name)).all();
}
