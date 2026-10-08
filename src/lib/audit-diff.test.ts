import { describe, expect, it } from "vitest";
import { changedFields, publicSnapshot, viewAuditMeta } from "./audit-diff";

describe("changedFields", () => {
  it("فقط فیلد عوض‌شده را با قبل و بعد برمی‌گرداند", () => {
    const diff = changedFields(
      { title: "قدیم", userIds: [1], description: "" },
      { title: "جدید", userIds: [1, 2], description: null },
      ["title", "userIds", "description"],
    );
    expect(diff).toEqual({
      title: { from: "قدیم", to: "جدید" },
      userIds: { from: [1], to: [1, 2] },
    });
  });

  it("ترتیب آرایهٔ شناسه را تغییر حساب نمی‌کند", () => {
    const diff = changedFields(
      { userIds: [2, 1] },
      { userIds: [1, 2] },
      ["userIds"],
    );
    expect(diff).toEqual({});
  });

  it("رمز و کلید حساس را در تصویر ثبت نمی‌کند", () => {
    expect(
      publicSnapshot({
        username: "a",
        passwordHash: "secret",
        generatedPassword: "x",
        token: "t",
      }),
    ).toEqual({ username: "a" });
  });
});

describe("viewAuditMeta", () => {
  it("diff و snapshot را از بقیه جدا می‌کند", () => {
    const view = viewAuditMeta({
      title: { from: "الف", to: "ب" },
      snapshot: { title: "الف" },
      ids: [1, 2],
    });
    expect(view.changes).toEqual([{ field: "title", from: "الف", to: "ب" }]);
    expect(view.snapshot).toEqual([{ field: "title", value: "الف" }]);
    expect(view.extra).toEqual({ ids: [1, 2] });
  });
});
