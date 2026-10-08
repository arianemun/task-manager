import { describe, expect, it } from "vitest";
import { VOICE_TAP_MS, voiceStartMode } from "./voice-mode";

describe("voice start mode", () => {
  it("locks on a short tap even after the finger is up", () => {
    expect(voiceStartMode(VOICE_TAP_MS - 1, false)).toBe("locked");
    expect(voiceStartMode(0, false)).toBe("locked");
  });

  it("keeps a hold while the finger is down", () => {
    expect(voiceStartMode(40, true)).toBe("hold");
    expect(voiceStartMode(800, true)).toBe("hold");
  });

  it("does not auto-start when a hold is interrupted", () => {
    expect(voiceStartMode(VOICE_TAP_MS, false)).toBe("interrupted");
    expect(voiceStartMode(VOICE_TAP_MS + 40, false)).toBe("interrupted");
  });
});
