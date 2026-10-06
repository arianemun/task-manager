import { describe, expect, it } from "vitest";
import { classifySourceBackfill } from "./source-backfill";

const memberships = [
  { departmentId: 1, joinedAt: "2026-01-01" },
  { departmentId: 2, joinedAt: "2026-06-01" },
];

describe("classifySourceBackfill", () => {
  it("یک اساین دپارتمان را قطعی می‌داند", () => {
    const verdict = classifySourceBackfill({
      periodStart: "2026-10-01",
      primaryDepartmentId: 1,
      memberships,
      assignments: [{ assigneeType: "DEPARTMENT", departmentId: 2 }],
    });
    expect(verdict.kind).toBe("definite");
    expect(verdict.sourceDepartmentId).toBe(2);
  });

  it("اساین مستقیم را به دپارتمان اصلی قطعی می‌برد", () => {
    const verdict = classifySourceBackfill({
      periodStart: "2026-10-01",
      primaryDepartmentId: 1,
      memberships,
      assignments: [{ assigneeType: "USER", departmentId: null }],
    });
    expect(verdict.kind).toBe("definite");
    expect(verdict.sourceDepartmentId).toBe(1);
  });

  it("دو دپارتمان واجد شرایط را مبهم گزارش می‌کند و پیشنهاد قاعده را جدا می‌گذارد", () => {
    const verdict = classifySourceBackfill({
      periodStart: "2026-10-01",
      primaryDepartmentId: 2,
      memberships,
      assignments: [
        { assigneeType: "DEPARTMENT", departmentId: 1 },
        { assigneeType: "DEPARTMENT", departmentId: 2 },
      ],
    });
    expect(verdict.kind).toBe("ambiguous");
    expect(verdict.sourceDepartmentId).toBeNull();
    expect(verdict.candidateDepartmentIds).toEqual([1, 2]);
    expect(verdict.proposedDepartmentId).toBe(2);
  });

  it("عضویت بعد از period_start را مسیر معتبر حساب نمی‌کند", () => {
    const verdict = classifySourceBackfill({
      periodStart: "2026-03-01",
      primaryDepartmentId: 2,
      memberships,
      assignments: [{ assigneeType: "DEPARTMENT", departmentId: 2 }],
    });
    expect(verdict.kind).toBe("ambiguous");
    expect(verdict.candidateDepartmentIds).toEqual([]);
    expect(verdict.reason).toContain("پیدا نشد");
  });
});
