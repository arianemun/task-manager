import { describe, expect, it } from "vitest";
import { avatarCropLayout, avatarCropSourceRect } from "./avatar-crop";

describe("avatarCropLayout", () => {
  it("مربع را در زوم ۱ بدون جابه‌جایی کامل می‌پوشاند", () => {
    const layout = avatarCropLayout(400, 400, 1, 0, 0, 200);
    expect(layout.displayW).toBe(200);
    expect(layout.displayH).toBe(200);
    expect(layout.panX).toBe(0);
    expect(layout.panY).toBe(0);
    const src = avatarCropSourceRect(400, 400, 1, 0, 0, 200);
    expect(src.x).toBeCloseTo(0);
    expect(src.y).toBeCloseTo(0);
    expect(src.size).toBeCloseTo(400);
  });

  it("زوم وسط تصویر را برش می‌دهد", () => {
    const src = avatarCropSourceRect(400, 400, 2, 0, 0, 200);
    expect(src.size).toBeCloseTo(200);
    expect(src.x).toBeCloseTo(100);
    expect(src.y).toBeCloseTo(100);
  });

  it("جابه‌جایی را داخل تصویر نگه می‌دارد", () => {
    const layout = avatarCropLayout(800, 400, 1, 9999, -9999, 200);
    expect(layout.panX).toBeLessThanOrEqual(100);
    expect(layout.panX).toBeGreaterThanOrEqual(-100);
    expect(layout.panY).toBe(0);
    const src = avatarCropSourceRect(800, 400, 1, layout.panX, layout.panY, 200);
    expect(src.x).toBeGreaterThanOrEqual(0);
    expect(src.y).toBeGreaterThanOrEqual(0);
    expect(src.x + src.size).toBeLessThanOrEqual(800.01);
    expect(src.y + src.size).toBeLessThanOrEqual(400.01);
  });
});
