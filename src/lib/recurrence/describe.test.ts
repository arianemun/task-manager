import { describe, expect, it } from "vitest";
import { describeRecurrence } from "./describe";

describe("describeRecurrence", () => {
  it("هر روز به‌جز جمعه", () => {
    expect(
      describeRecurrence("DAILY", { interval: 1, excludeWeekdays: [6] }),
    ).toBe("هر روز به‌جز جمعه");
  });

  it("هر ۲ هفته، دوشنبه", () => {
    expect(
      describeRecurrence("CUSTOM", {
        unit: "week",
        interval: 2,
        weekdays: [2],
      }),
    ).toBe("هر ۲ هفته، دوشنبه");
  });

  it("آخرین روز هر ماه", () => {
    expect(
      describeRecurrence("MONTHLY", { mode: "last_day" }),
    ).toBe("آخرین روز هر ماه");
  });

  it("یک‌بار در طول هفته", () => {
    expect(
      describeRecurrence("WEEKLY", { mode: "any_day_in_week" }),
    ).toBe("یک‌بار در طول هفته");
  });
});
