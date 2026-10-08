import { describe, expect, it } from "vitest";
import { allowTyping, assertSendRate, resetSendRate } from "./rate-limit";

describe("سقف نرخ چت", () => {
  it("بعد از ۳۰ تایپ در پنجره، تایپ بعدی را رد می‌کند", () => {
    resetSendRate();
    for (let index = 0; index < 30; index += 1) {
      expect(allowTyping(7, 1_000 + index)).toBe(true);
    }
    expect(allowTyping(7, 1_500)).toBe(false);
    expect(allowTyping(7, 12_000)).toBe(true);
  });

  it("ویرایش و ارسال از یک سقف مشترک استفاده می‌کنند", () => {
    resetSendRate();
    for (let index = 0; index < 20; index += 1) assertSendRate(3, 5_000);
    expect(() => assertSendRate(3, 5_100)).toThrow(/سریع/);
  });
});
