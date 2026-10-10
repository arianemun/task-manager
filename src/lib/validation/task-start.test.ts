import { describe, expect, it } from "vitest";
import { taskFormSchema } from "./task";

const base = {
  title: "نظافت",
  priority: "SCHEDULE",
  startDate: "2026-10-10",
  userIds: [1],
  departmentIds: [],
  recurrenceType: "DAILY" as const,
  recurrenceConfig: { interval: 1, excludeWeekdays: [] },
};

describe("ساعت شروع و مهلت", () => {
  it("اگر هر دو پر باشند ساعت شروع باید قبل از مهلت باشد", () => {
    const late = taskFormSchema.safeParse({ ...base, startTime: "14:00", dueTime: "09:00" });
    expect(late.success).toBe(false);
    if (!late.success) {
      expect(late.error.issues.some((issue) => issue.message.includes("ساعت شروع"))).toBe(true);
    }

    const ok = taskFormSchema.safeParse({ ...base, startTime: "09:00", dueTime: "14:00" });
    expect(ok.success).toBe(true);

    expect(taskFormSchema.safeParse({ ...base, startTime: "09:00" }).success).toBe(true);
    expect(taskFormSchema.safeParse({ ...base, dueTime: "14:00" }).success).toBe(true);
    expect(taskFormSchema.safeParse({ ...base, startTime: "09:00", dueTime: "09:00" }).success).toBe(
      false,
    );
  });
});
