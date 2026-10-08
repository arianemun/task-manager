import { describe, expect, it } from "vitest";
import { diskLevel, measureDiskSpace } from "./disk-space";

describe("سطح فضای دیسک", () => {
  it("زیر ۸ درصد قرمز و زیر ۱۵ درصد زرد است", () => {
    expect(diskLevel(0.079)).toBe("critical");
    expect(diskLevel(0.08)).toBe("warn");
    expect(diskLevel(0.149)).toBe("warn");
    expect(diskLevel(0.15)).toBe("ok");
    expect(diskLevel(0.5)).toBe("ok");
  });

  it("پوشه داده و بکاپ و حجم بخش‌ها را می‌خواند", () => {
    const report = measureDiskSpace();
    expect(report.volumes.map((item) => item.id)).toEqual(["data", "backups"]);
    expect(report.sections.map((item) => item.id)).toEqual([
      "database",
      "uploads",
      "chat_media",
      "backups",
    ]);
    for (const item of report.volumes) {
      expect(item.totalBytes).toBeGreaterThan(0);
      expect(item.freeRatio).toBeGreaterThanOrEqual(0);
      expect(item.freeRatio).toBeLessThanOrEqual(1);
    }
  });
});
