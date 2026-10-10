import { describe, expect, it } from "vitest";
import {
  isOccurrenceNotStarted,
  isTaskVisibleAt,
  responseBlockedBeforeStart,
} from "./start-time";

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

  it("ثبت پاسخ قبل از ساعت شروع رد می‌شود", () => {
    expect(responseBlockedBeforeStart("09:00", BEFORE)).toBe("این کار هنوز شروع نشده");
    expect(responseBlockedBeforeStart("09:00", AT)).toBeNull();
    expect(responseBlockedBeforeStart(null, BEFORE)).toBeNull();
  });

  it("هنوز شروع نشده فقط برای امروز و قبل از ساعت است", () => {
    expect(
      isOccurrenceNotStarted({
        status: "PENDING",
        startTime: "09:00",
        periodStart: DAY,
        periodEnd: DAY,
        now: BEFORE,
      }),
    ).toBe(true);
    expect(
      isOccurrenceNotStarted({
        status: "PENDING",
        startTime: "09:00",
        periodStart: DAY,
        periodEnd: DAY,
        now: AT,
      }),
    ).toBe(false);
    expect(
      isOccurrenceNotStarted({
        status: "DONE",
        startTime: "09:00",
        periodStart: DAY,
        periodEnd: DAY,
        now: BEFORE,
      }),
    ).toBe(false);
    expect(
      isOccurrenceNotStarted({
        status: "PENDING",
        startTime: "09:00",
        periodStart: "2026-10-09",
        periodEnd: "2026-10-09",
        now: BEFORE,
      }),
    ).toBe(false);
  });
});