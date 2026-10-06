import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { taskAssignments, taskOccurrences } from "@/db/schema";
import { activeMembersOfDepartment } from "@/lib/departments/membership";

/**
 * اعضای دپارتمان که تخصیص شخصی ندارند.
 * اگر کار تخصیص دپارتمان نداشته باشد، یا همه اعضا جداگانه به خودشان تخصیص شده باشند، آرایه خالی است.
 */
export function groupMemberUserIds(templateId: number): number[] {
  const assignments = db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.templateId, templateId))
    .all();

  const personal = new Set<number>();
  const departmentIds: number[] = [];
  for (const assignment of assignments) {
    if (assignment.assigneeType === "USER" && assignment.userId) {
      personal.add(assignment.userId);
    }
    if (assignment.assigneeType === "DEPARTMENT" && assignment.departmentId) {
      departmentIds.push(assignment.departmentId);
    }
  }
  if (departmentIds.length === 0) return [];

  const memberIds = new Set<number>();
  for (const departmentId of departmentIds) {
    for (const member of activeMembersOfDepartment(departmentId)) {
      memberIds.add(member.user.id);
    }
  }

  return [...memberIds].filter((id) => !personal.has(id));
}

/** ردیفی که باید در نرخ شخصی شمرده شود: خود فرد ثبت کرده، یا هنوز کسی گروه را نبسته. */
export function personalCreditSql() {
  return sql`(${taskOccurrences.completedByUserId} is null or ${taskOccurrences.completedByUserId} = ${taskOccurrences.userId})`;
}
