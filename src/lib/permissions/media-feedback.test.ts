import { describe, expect, it } from "vitest";
import { fa } from "@/lib/i18n/fa";
import { describeMediaFailure, feedbackForEnable } from "./media-feedback";

const android = { ios: false, installed: false, device: "microphone" as const };

describe("media permission feedback", () => {
  it("names NotAllowedError and the Android steps", () => {
    const view = describeMediaFailure({
      ...android,
      errorName: "NotAllowedError",
      elapsedMs: 800,
    });
    expect(view.lines[0]).toBe(fa.permissions.notAllowed);
    expect(view.lines[1]).toContain("Apps ← Chrome ← Permissions ← Microphone روی Allow");
    expect(view.lines[1]).toContain("Site settings ← Microphone ← این سایت را Allow کنید");
    expect(view.lines[1]).not.toContain("App info");
    expect(view.errorName).toBeNull();
  });

  it("adds the installed web app path", () => {
    const view = describeMediaFailure({
      ...android,
      installed: true,
      errorName: "PermissionDeniedError",
      elapsedMs: 900,
    });
    expect(view.lines.join(" ")).toContain(fa.permissions.androidInstalled);
  });

  it("says the browser rejected without a prompt when the failure is immediate", () => {
    const view = describeMediaFailure({
      ...android,
      errorName: "NotAllowedError",
      elapsedMs: 120,
    });
    expect(view.lines[0]).toBe(fa.permissions.silentReject);
    expect(view.lines).toContain(fa.permissions.notAllowed);
    expect(view.lines.join(" ")).toContain("Site settings");
  });

  it("maps NotReadableError and NotFoundError for the microphone and the camera", () => {
    expect(
      describeMediaFailure({ ...android, errorName: "NotReadableError", elapsedMs: 40 }).lines,
    ).toEqual([fa.permissions.micBusy]);
    expect(
      describeMediaFailure({
        ...android,
        device: "camera",
        errorName: "NotReadableError",
        elapsedMs: 40,
      }).lines,
    ).toEqual([fa.permissions.cameraBusy]);
    expect(
      describeMediaFailure({ ...android, errorName: "NotFoundError", elapsedMs: 20 }).lines,
    ).toEqual([fa.chat.micMissing]);
    expect(
      describeMediaFailure({
        ...android,
        device: "camera",
        errorName: "NotFoundError",
        elapsedMs: 20,
      }).lines,
    ).toEqual([fa.chat.cameraMissing]);
  });

  it("keeps AbortError, SecurityError and unknown names visible", () => {
    for (const errorName of ["AbortError", "SecurityError", "InvalidStateError"]) {
      const view = describeMediaFailure({ ...android, errorName, elapsedMs: 700 });
      expect(view.lines).toEqual([fa.permissions.requestFailed]);
      expect(view.errorName).toBe(errorName);
    }
  });

  it("never leaves a failed enable-all without a message", () => {
    const missed = feedbackForEnable({
      mediaError: null,
      notificationError: null,
      mediaGranted: false,
      ios: false,
      installed: false,
    });
    expect(missed?.lines.length).toBeGreaterThan(0);
    const denied = feedbackForEnable({
      mediaError: { name: "NotReadableError", elapsedMs: 80, device: "both" },
      notificationError: null,
      mediaGranted: false,
      ios: false,
      installed: true,
    });
    expect(denied?.lines).toEqual([fa.permissions.mediaBusy]);
  });

  it("still shows a message for every error name", () => {
    for (const errorName of [
      "NotAllowedError",
      "NotReadableError",
      "NotFoundError",
      "AbortError",
      "SecurityError",
      "",
    ]) {
      const view = describeMediaFailure({ ...android, errorName, elapsedMs: 50 });
      expect(view.lines.length).toBeGreaterThan(0);
      expect(view.lines.every((line) => line.trim().length > 0)).toBe(true);
    }
  });
});
