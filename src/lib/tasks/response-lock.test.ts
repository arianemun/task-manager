import { describe, expect, it } from "vitest";
import { isStaffResponseLocked } from "./response-lock";

describe("قفل پاسخ پرسنل", () => {
  it("PENDING بعد از period_end قفل است، حتی اگر هنوز MISSED نشده باشد", () => {
    expect(
      isStaffResponseLocked({
        status: "PENDING",
        periodEnd: "2026-10-05",
        today: "2026-10-06",
      }),
    ).toBe(true);
  });

  it("در همان روز دوره، گذشتن due_at پاسخ را قفل نمی‌کند", () => {
    expect(
      isStaffResponseLocked({
        status: "PENDING",
        periodEnd: "2026-10-06",
        today: "2026-10-06",
      }),
    ).toBe(false);
  });

  it("MISSED حتی در دوره جاری قفل است", () => {
    expect(
      isStaffResponseLocked({
        status: "MISSED",
        periodEnd: "2026-10-06",
        today: "2026-10-06",
      }),
    ).toBe(true);
  });
});
