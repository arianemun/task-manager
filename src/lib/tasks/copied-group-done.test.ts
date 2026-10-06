import { describe, expect, it } from "vitest";
import { isCopiedForeignClose } from "./copied-group-done";

describe("سلامت داده کار گروهی", () => {
  it("DONE با completed_by شخص دیگر خطا است", () => {
    expect(
      isCopiedForeignClose({
        status: "DONE",
        userId: 9,
        completedByUserId: 16,
      }),
    ).toBe(true);
    expect(
      isCopiedForeignClose({
        status: "NOT_DONE",
        userId: 9,
        completedByUserId: 16,
      }),
    ).toBe(true);
  });

  it("DONE خود فرد و DONE_BY_PEER خطا نیست", () => {
    expect(
      isCopiedForeignClose({
        status: "DONE",
        userId: 16,
        completedByUserId: 16,
      }),
    ).toBe(false);
    expect(
      isCopiedForeignClose({
        status: "DONE_BY_PEER",
        userId: 9,
        completedByUserId: 16,
      }),
    ).toBe(false);
    expect(
      isCopiedForeignClose({
        status: "PENDING",
        userId: 9,
        completedByUserId: null,
      }),
    ).toBe(false);
  });
});
