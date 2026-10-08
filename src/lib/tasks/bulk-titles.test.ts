import { describe, expect, it } from "vitest";
import { prepareBulkTitles } from "./bulk-titles";

describe("prepareBulkTitles", () => {
  it("خط خالی و عنوان تکراری را حذف می‌کند", () => {
    const rows = prepareBulkTitles(
      "نظافت\n\n  نظافت  \nجارو\nنظافت\nپولیش",
      ["پولیش"],
    );
    expect(rows.map((row) => row.title)).toEqual(["نظافت", "جارو", "پولیش"]);
    expect(rows.filter((row) => row.duplicateOfActive).map((row) => row.title)).toEqual([
      "پولیش",
    ]);
  });

  it("ی و ک عربی را با فارسی یکی می‌گیرد", () => {
    const rows = prepareBulkTitles("نظافت\nنظافت", []);
    expect(rows).toHaveLength(1);
    const arabic = prepareBulkTitles("كيك", ["کیک"]);
    expect(arabic[0]?.duplicateOfActive).toBe(true);
    expect(arabic[0]?.title).toBe("کیک");
  });
});
