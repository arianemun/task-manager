import { describe, expect, it } from "vitest";
import { bumpVersion, parseChangelog } from "./changelog";

describe("نسخه‌بندی", () => {
  it("بخش منتشرنشده و نسخه‌های تاریخ‌دار را جدا می‌کند", () => {
    const releases = parseChangelog(`# تغییرات

## [منتشرنشده]

### افزوده‌شده
- مورد تازه

## [1.2.0] - ۱۴۰۵/۰۷/۱۵

### رفع‌شده
- مورد قدیمی
`);
    expect(releases.map((row) => row.version)).toEqual(["منتشرنشده", "1.2.0"]);
    expect(releases[0]?.sections[0]?.items).toEqual(["مورد تازه"]);
    expect(releases[1]?.date).toBe("۱۴۰۵/۰۷/۱۵");
  });

  it("SemVer را بالا می‌برد", () => {
    expect(bumpVersion("1.2.0", "patch")).toBe("1.2.1");
    expect(bumpVersion("1.2.1", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.3.0", "major")).toBe("2.0.0");
  });
});
