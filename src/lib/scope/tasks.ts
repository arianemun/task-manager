import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { taskAssignments, taskTemplates, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import type { AuthUser } from "@/lib/auth/user";

/** آیا همه گیرنده‌های کار در محدوده MANAGER هستند؟ */
export function canManagerEditTemplate(
  actor: AuthUser,
  templateId: number,
): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "MANAGER" || !actor.departmentId) return false;

  const assignments = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .all();

  if (assignments.length === 0) return false;

  for (const a of assignments) {
    if (a.assigneeType === "DEPARTMENT") {
      if (a.departmentId !== actor.departmentId) return false;
    } else if (a.userId) {
      const u = db.select().from(users).where(eq(users.id, a.userId)).get();
      if (!u || u.departmentId !== actor.departmentId) return false;
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
  if (actor.role !== "MANAGER" || !actor.departmentId) return [];

  const deptId = actor.departmentId;
  const staffIds = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.departmentId, deptId), isNull(users.deletedAt)))
    .all()
    .map((u) => u.id);

  const byDept = db
    .select({ templateId: taskAssignments.templateId })
    .from(taskAssignments)
    .where(
      and(
        eq(taskAssignments.assigneeType, "DEPARTMENT"),
        eq(taskAssignments.departmentId, deptId),
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
  if (actor.role !== "MANAGER" || !actor.departmentId) {
    throw new AuthError("FORBIDDEN", "دسترسی ندارید");
  }
  if (departmentIds.some((d) => d !== actor.departmentId)) {
    throw new AuthError(
      "FORBIDDEN",
      "سرپرست فقط دپارتمان خودش را می‌تواند انتخاب کند",
    );
  }
  for (const uid of userIds) {
    const u = db.select().from(users).where(eq(users.id, uid)).get();
    if (!u || u.departmentId !== actor.departmentId) {
      throw new AuthError(
        "FORBIDDEN",
        "سرپرست فقط به پرسنل دپارتمان خودش اساین می‌کند",
      );
    }
  }
}
