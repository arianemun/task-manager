import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { taskAssignments, taskTemplates } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import type { AuthUser } from "@/lib/auth/user";
import {
  departmentIdsForUser,
  sharesDepartment,
  userIdsInDepartments,
} from "@/lib/departments/membership";

/** آیا همه گیرنده‌های کار در محدوده MANAGER هستند؟ */
export function canManagerEditTemplate(
  actor: AuthUser,
  templateId: number,
): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "MANAGER" || actor.departmentIds.length === 0) return false;

  const assignments = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .all();

  if (assignments.length === 0) return false;

  for (const a of assignments) {
    if (a.assigneeType === "DEPARTMENT") {
      if (!a.departmentId || !actor.departmentIds.includes(a.departmentId)) {
        return false;
      }
    } else if (a.userId) {
      if (!sharesDepartment(actor.departmentIds, departmentIdsForUser(a.userId))) {
        return false;
      }
    }
  }
  return true;
}

export function assertCanEditTemplate(actor: AuthUser, templateId: number) {
  if (!canManagerEditTemplate(actor, templateId)) {
    throw new AuthError(
      "FORBIDDEN",
      "ویرایش این کار خارج از محدوده دپارتمان شماست",
    );
  }
}

/** کارهایی که حداقل یک گیرنده در محدوده دارند */
export function templatesVisibleToActor(actor: AuthUser): number[] {
  if (actor.role === "ADMIN") {
    return db
      .select({ id: taskTemplates.id })
      .from(taskTemplates)
      .all()
      .map((t) => t.id);
  }
  if (actor.role !== "MANAGER" || actor.departmentIds.length === 0) return [];

  const staffIds = userIdsInDepartments(actor.departmentIds);

  const byDept = db
    .select({ templateId: taskAssignments.templateId })
    .from(taskAssignments)
    .where(
      and(
        eq(taskAssignments.assigneeType, "DEPARTMENT"),
        inArray(taskAssignments.departmentId, actor.departmentIds),
      ),
    )
    .all()
    .map((r) => r.templateId);

  const byUser =
    staffIds.length === 0
      ? []
      : db
          .select({ templateId: taskAssignments.templateId })
          .from(taskAssignments)
          .where(
            and(
              eq(taskAssignments.assigneeType, "USER"),
              inArray(taskAssignments.userId, staffIds),
            ),
          )
          .all()
          .map((r) => r.templateId);

  return [...new Set([...byDept, ...byUser])];
}

export function assertAssigneeInScope(
  actor: AuthUser,
  userIds: number[],
  departmentIds: number[],
) {
  if (actor.role === "ADMIN") return;
  if (actor.role !== "MANAGER" || actor.departmentIds.length === 0) {
    throw new AuthError("FORBIDDEN", "دسترسی ندارید");
  }
  if (departmentIds.some((d) => !actor.departmentIds.includes(d))) {
    throw new AuthError(
      "FORBIDDEN",
      "سرپرست فقط دپارتمان خودش را می‌تواند انتخاب کند",
    );
  }
  for (const uid of userIds) {
    if (!sharesDepartment(actor.departmentIds, departmentIdsForUser(uid))) {
      throw new AuthError(
        "FORBIDDEN",
        "سرپرست فقط به پرسنل دپارتمان خودش اساین می‌کند",
      );
    }
  }
}
