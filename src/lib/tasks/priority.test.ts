import { describe, expect, it } from "vitest";
import { normalizeTaskPriority, nudgePriority, quadrantAt } from "./priority";

describe("ماتریس آیزنهاور", () => {
  it("نیمهٔ راست و بالا انجام فوری است", () => {
    expect(quadrantAt(150, 20, 200, 200)).toBe("DO");
    expect(quadrantAt(20, 20, 200, 200)).toBe("SCHEDULE");
    expect(quadrantAt(150, 160, 200, 200)).toBe("DELEGATE");
    expect(quadrantAt(20, 160, 200, 200)).toBe("ELIMINATE");
    expect(quadrantAt(100, 100, 200, 200)).toBe("DO");
  });

  it("جهت‌های ماوس و صفحه‌کلید خانه را عوض می‌کنند", () => {
    expect(nudgePriority("SCHEDULE", "ArrowRight")).toBe("DO");
    expect(nudgePriority("DO", "ArrowDown")).toBe("DELEGATE");
    expect(nudgePriority("DELEGATE", "ArrowLeft")).toBe("ELIMINATE");
    expect(nudgePriority("ELIMINATE", "ArrowUp")).toBe("SCHEDULE");
  });

  it("اولویت قبلی را به خانهٔ ماتریس برمی‌گرداند", () => {
    expect(normalizeTaskPriority("HIGH")).toBe("DO");
    expect(normalizeTaskPriority("MEDIUM")).toBe("SCHEDULE");
    expect(normalizeTaskPriority("LOW")).toBe("ELIMINATE");
    expect(normalizeTaskPriority("")).toBe("SCHEDULE");
  });
});