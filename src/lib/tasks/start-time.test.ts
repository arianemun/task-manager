import { describe, expect, it } from "vitest";
import { isTaskVisibleAt } from "./start-time";

const DAY = "2026-10-10";
const BEFORE = Date.parse(`${DAY}T05:29:00.000Z`);
const AT = Date.parse(`${DAY}T05:30:00.000Z`);

describe("ساعت شروع کار", () => {
  it("بدون ساعت از ابتدای روز دیده می‌شود", () => {
    expect(isTaskVisibleAt(null, BEFORE)).toBe(true);
    expect(isTaskVisibleAt("", BEFORE)).toBe(true);
    expect(isTaskVisibleAt("25:00", BEFORE)).toBe(true);
  });

  it("قبل از ساعت پنهان است و با رسیدن ساعت دیده می‌شود", () => {
    expect(isTaskVisibleAt("09:00", BEFORE)).toBe(false);
    expect(isTaskVisibleAt("09:00", AT)).toBe(true);
    expect(isTaskVisibleAt("09:00", AT + 60_000)).toBe(true);
  });
});