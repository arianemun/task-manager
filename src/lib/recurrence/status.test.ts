import { describe, expect, it } from "vitest";
import { dueAtTehranMs, fromJalali } from "@/lib/dates";
import { statusFromCompletion } from "./status";

describe("DONE / DONE_LATE", () => {
  it("بدون due_time — پایان روز تهران؛ قبل از مهلت DONE و بعد DONE_LATE", () => {
    const day = fromJalali(1404, 1, 10);
    const dueAt = dueAtTehranMs(day, null); // 23:59:59 تهران
    expect(statusFromCompletion(dueAt - 1000, dueAt)).toBe("DONE");
    expect(statusFromCompletion(dueAt + 1000, dueAt)).toBe("DONE_LATE");
  });

  it("با due_time=14:00", () => {
    const day = fromJalali(1404, 1, 10);
    const dueAt = dueAtTehranMs(day, "14:00");
    expect(statusFromCompletion(dueAt - 60_000, dueAt)).toBe("DONE");
    expect(statusFromCompletion(dueAt + 60_000, dueAt)).toBe("DONE_LATE");
  });

  it("dueAt خالی → همیشه DONE", () => {
    expect(statusFromCompletion(Date.now(), null)).toBe("DONE");
    expect(statusFromCompletion(Date.now(), undefined)).toBe("DONE");
  });
});
