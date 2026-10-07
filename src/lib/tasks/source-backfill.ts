import type { GDate } from "@/lib/dates";
import { periodInsideMembership } from "@/lib/departments/intervals";
import {
  resolveOccurrenceSource,
  type OccurrenceSourcePath,
} from "@/lib/tasks/occurrence-source";

export type SourceBackfillAssignment = {
  assigneeType: "USER" | "DEPARTMENT";
  departmentId: number | null;
};

export type SourceBackfillMembership = {
  departmentId: number;
  joinedAt: GDate | null;
  leftAt?: GDate | null;
};

export type SourceBackfillVerdict = {
  kind: "definite" | "ambiguous";
  /** فقط وقتی یک دپارتمان ممکن است پر می‌شود. */
  sourceDepartmentId: number | null;
  /** نتیجهٔ همان قاعدهٔ تولید، حتی اگر چند نامزد باشد. */
  proposedDepartmentId: number | null;
  candidateDepartmentIds: number[];
  reason: string;
};

function memberAt(
  memberships: SourceBackfillMembership[],
  departmentId: number,
  periodStart: GDate,
): boolean {
  return memberships.some(
    (item) =>
      item.departmentId === departmentId &&
      periodInsideMembership(periodStart, {
        joinedAt: item.joinedAt,
        leftAt: item.leftAt ?? null,
      }),
  );
}

/**
 * بازسازی منبع یک occurrence از اساین و عضویت فعلی.
 * قطعی: دقیقاً یک دپارتمان از مسیرهای معتبر در period_start به دست بیاید.
 * مبهم: هیچ مسیر معتبری نباشد، یا بیش از یک دپارتمان نامزد باشد.
 */
export function classifySourceBackfill(input: {
  periodStart: GDate;
  primaryDepartmentId: number | null;
  memberships: SourceBackfillMembership[];
  assignments: SourceBackfillAssignment[];
}): SourceBackfillVerdict {
  const paths: OccurrenceSourcePath[] = [];
  const candidates = new Set<number>();

  for (const assignment of input.assignments) {
    if (
      assignment.assigneeType === "DEPARTMENT" &&
      assignment.departmentId != null &&
      memberAt(input.memberships, assignment.departmentId, input.periodStart)
    ) {
      paths.push({
        kind: "department",
        departmentId: assignment.departmentId,
      });
      candidates.add(assignment.departmentId);
    }
  }

  const hasDirect = input.assignments.some(
    (assignment) => assignment.assigneeType === "USER",
  );
  if (
    hasDirect &&
    input.primaryDepartmentId != null &&
    memberAt(input.memberships, input.primaryDepartmentId, input.periodStart)
  ) {
    paths.push({ kind: "direct" });
    candidates.add(input.primaryDepartmentId);
  }

  const proposedDepartmentId = resolveOccurrenceSource({
    paths,
    primaryDepartmentId: input.primaryDepartmentId,
    memberships: input.memberships,
  });
  const candidateDepartmentIds = [...candidates].sort((a, b) => a - b);

  if (candidateDepartmentIds.length === 1 && proposedDepartmentId != null) {
    return {
      kind: "definite",
      sourceDepartmentId: proposedDepartmentId,
      proposedDepartmentId,
      candidateDepartmentIds,
      reason: "یک دپارتمان",
    };
  }
  if (candidateDepartmentIds.length === 0) {
    return {
      kind: "ambiguous",
      sourceDepartmentId: null,
      proposedDepartmentId,
      candidateDepartmentIds,
      reason: "مسیر واجد شرایط در period_start پیدا نشد",
    };
  }
  return {
    kind: "ambiguous",
    sourceDepartmentId: null,
    proposedDepartmentId,
    candidateDepartmentIds,
    reason: "بیش از یک دپارتمان نامزد است",
  };
}
