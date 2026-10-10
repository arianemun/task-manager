import { describe, expect, it } from "vitest";
import { isSettledOccurrence, splitSettled } from "./settled";

describe("بایگانی کارهای پاسخ‌داده‌شده", () => {
  it("انجام‌شده، انجام‌نشده و انجام همکار را بایگانی می‌کند", () => {
    expect(isSettledOccurrence("DONE")).toBe(true);
    expect(isSettledOccurrence("DONE_LATE")).toBe(true);
    expect(isSettledOccurrence("NOT_DONE")).toBe(true);
    expect(isSettledOccurrence("DONE_BY_PEER")).toBe(true);
    expect(isSettledOccurrence("PENDING")).toBe(false);
    expect(isSettledOccurrence("MISSED")).toBe(false);
    expect(isSettledOccurrence("EXCUSED")).toBe(false);
  });

  it("فهرست باز را از بایگانی جدا می‌کند و ترتیب هر کدام را نگه می‌دارد", () => {
    const { open, archive } = splitSettled([
      { id: 1, status: "PENDING" },
      { id: 2, status: "DONE" },
      { id: 3, status: "NOT_DONE" },
      { id: 4, status: "PENDING" },
      { id: 5, status: "DONE_BY_PEER" },
    ]);
    expect(open.map((item) => item.id)).toEqual([1, 4]);
    expect(archive.map((item) => item.id)).toEqual([2, 3, 5]);
  });
});