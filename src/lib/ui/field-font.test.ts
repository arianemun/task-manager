import path from "node:path";
import { describe, expect, it } from "vitest";
import { findSmallFieldFonts, smallFieldFontTokens } from "./field-font";

describe("فونت فیلدهای قابل تایپ", () => {
  it("text-sm بدون پیشوند md پذیرفته نیست", () => {
    expect(smallFieldFontTokens("text-base md:text-sm")).toEqual([]);
    expect(smallFieldFontTokens("text-sm")).toEqual(["text-sm"]);
    expect(smallFieldFontTokens("file:text-sm")).toEqual(["file:text-sm"]);
  });

  it("هیچ input یا textarea یا select زیر md فونت کوچک ندارد", () => {
    expect(findSmallFieldFonts(path.join(process.cwd()))).toEqual([]);
  });
});