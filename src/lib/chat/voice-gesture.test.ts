import { describe, expect, it } from "vitest";
import { voiceGesture } from "./voice-gesture";

describe("حرکت ضبط صدا", () => {
  it("نگه داشتن، لغو افقی و قفل به بالا را جدا می‌کند", () => {
    expect(voiceGesture(0, 0)).toBe("recording");
    expect(voiceGesture(40, -20)).toBe("recording");
    expect(voiceGesture(88, 0)).toBe("cancel");
    expect(voiceGesture(-88, 10)).toBe("cancel");
    expect(voiceGesture(10, -72)).toBe("lock");
  });
});
