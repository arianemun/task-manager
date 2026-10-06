import { describe, expect, it } from "vitest";
import { resolveOccurrenceSource } from "./occurrence-source";

const memberships = [
  { departmentId: 1, joinedAt: "2026-01-01" },
  { departmentId: 2, joinedAt: "2026-06-01" },
];

describe("resolveOccurrenceSource", () => {
  it("اساین دپارتمان را همان دپارتمان می‌گذارد", () => {
    expect(
      resolveOccurrenceSource({
        paths: [{ kind: "department", departmentId: 2 }],
        primaryDepartmentId: 1,
        memberships,
      }),
    ).toBe(2);
  });

  it("اساین مستقیم را به دپارتمان اصلی می‌برد", () => {
    expect(
      resolveOccurrenceSource({
        paths: [{ kind: "direct" }],
        primaryDepartmentId: 1,
        memberships,
      }),
    ).toBe(1);
    expect(
      resolveOccurrenceSource({
        paths: [{ kind: "direct" }],
        primaryDepartmentId: null,
        memberships,
      }),
    ).toBeNull();
  });

  it("بین چند مسیر، دپارتمان اصلی را به عضویت قدیمی‌تر ترجیح می‌دهد", () => {
    expect(
      resolveOccurrenceSource({
        paths: [
          { kind: "direct" },
          { kind: "department", departmentId: 1 },
          { kind: "department", departmentId: 2 },
        ],
        primaryDepartmentId: 2,
        memberships,
      }),
    ).toBe(2);
  });

  it("بدون عضویت اصلی در مسیرها، قدیمی‌ترین عضویت را برمی‌گزیند", () => {
    expect(
      resolveOccurrenceSource({
        paths: [
          { kind: "department", departmentId: 2 },
          { kind: "department", departmentId: 1 },
          { kind: "direct" },
        ],
        primaryDepartmentId: 9,
        memberships,
      }),
    ).toBe(1);
  });
});
