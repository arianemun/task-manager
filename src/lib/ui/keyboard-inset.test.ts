import { describe, expect, it } from "vitest";
import { keyboardOverlap } from "./keyboard-inset";

describe("جبران کیبورد", () => {
  it("offset اسکرول visual viewport را دوباره به ارتفاع کیبورد اضافه نمی‌کند", () => {
    const innerHeight = 800;
    const height = 420;
    const offsetTop = 180;
    expect(keyboardOverlap({ innerHeight, offsetTop, height })).toBe(200);
    expect(innerHeight - height).toBe(380);
  });
});
