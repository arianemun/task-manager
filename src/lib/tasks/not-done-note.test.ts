import { describe, expect, it } from "vitest";
import { notDoneNoteRequired } from "./not-done-note";

describe("توضیح انجام‌نشدن", () => {
  it("فقط برای سایر یا وقتی کار توضیح می‌خواهد الزامی است", () => {
    expect(
      notDoneNoteRequired({
        requiresNote: false,
        reason: { code: "no_time", label: "وقت نشد" },
      }),
    ).toBe(false);
    expect(
      notDoneNoteRequired({
        requiresNote: false,
        reason: { code: "other", label: "سایر" },
      }),
    ).toBe(true);
    expect(
      notDoneNoteRequired({
        requiresNote: true,
        reason: { code: "no_time", label: "وقت نشد" },
      }),
    ).toBe(true);
  });
});
