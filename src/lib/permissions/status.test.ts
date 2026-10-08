import { describe, expect, it } from "vitest";
import {
  activeTrackCount,
  captureAndRelease,
  enableAllPermissions,
  fromNotificationPermission,
  mapPermissionState,
  mediaConstraintsForRequest,
  permissionSnoozeUntil,
  PERMISSION_SNOOZE_MS,
  interpretGetUserMedia,
  mediaDisplayStatus,
  shouldCaptureMedia,
  shouldShowPermissionPrep,
  showsIosInstallGuide,
  type PermissionMap,
  type TrackLike,
  type TrackStream,
} from "./status";

const prompt: PermissionMap = {
  notifications: "prompt",
  microphone: "prompt",
  camera: "prompt",
};

const granted: PermissionMap = {
  notifications: "granted",
  microphone: "granted",
  camera: "granted",
};

function liveStream(): TrackStream & { tracks: TrackLike[] } {
  const tracks = [0, 1].map(() => {
    const track: TrackLike = {
      readyState: "live",
      stop() {
        track.readyState = "ended";
      },
    };
    return track;
  });
  return { tracks, getTracks: () => tracks };
}

describe("permission prep", () => {
  it("shows on first login when a permission is still needed", () => {
    expect(
      shouldShowPermissionPrep({
        snoozeUntil: null,
        now: 1_000,
        setupCompleted: false,
        statuses: prompt,
      }),
    ).toBe(true);
  });

  it("hides for seven days after later, then shows again", () => {
    const now = 1_700_000_000_000;
    const until = permissionSnoozeUntil(now);
    expect(until - now).toBe(PERMISSION_SNOOZE_MS);
    expect(
      shouldShowPermissionPrep({
        snoozeUntil: until,
        now: until - 1,
        setupCompleted: false,
        statuses: prompt,
      }),
    ).toBe(false);
    expect(
      shouldShowPermissionPrep({
        snoozeUntil: until,
        now: until,
        setupCompleted: false,
        statuses: prompt,
      }),
    ).toBe(true);
  });

  it("hides when every permission is granted", () => {
    expect(
      shouldShowPermissionPrep({
        snoozeUntil: null,
        now: 1_000,
        setupCompleted: false,
        statuses: granted,
      }),
    ).toBe(false);
  });

  it("stays hidden after setup even when iOS still reports prompt", () => {
    expect(
      shouldShowPermissionPrep({
        snoozeUntil: null,
        now: 1_000,
        setupCompleted: true,
        statuses: prompt,
      }),
    ).toBe(false);
  });

  it("keeps showing when the browser cannot report status", () => {
    expect(
      shouldShowPermissionPrep({
        snoozeUntil: null,
        now: 1_000,
        setupCompleted: false,
        statuses: { ...granted, camera: "unknown" },
      }),
    ).toBe(true);
    expect(mapPermissionState("granted")).toBe("granted");
    expect(mapPermissionState(undefined)).toBe("unknown");
    expect(fromNotificationPermission("default")).toBe("prompt");
  });

  it("records when the query is prompt or unsupported and capture succeeds", () => {
    for (const queried of ["prompt", "unknown"] as const) {
      expect(shouldCaptureMedia(queried, false)).toBe(true);
      expect(interpretGetUserMedia({ ok: true, fingerDown: true })).toBe("record");
    }
    expect(shouldCaptureMedia("denied", false)).toBe(false);
  });

  it("opens the manual drawer only after a denied capture", () => {
    expect(
      interpretGetUserMedia({ ok: false, errorName: "NotAllowedError", fingerDown: true }),
    ).toBe("drawer");
    expect(
      interpretGetUserMedia({ ok: false, errorName: "SecurityError", fingerDown: true }),
    ).toBe("drawer");
    expect(
      interpretGetUserMedia({ ok: true, fingerDown: false }),
    ).toBe("hold-again");
    expect(
      interpretGetUserMedia({ ok: false, errorName: "NotFoundError", fingerDown: true }),
    ).toBe("missing");
  });

  it("shows ask-on-use when microphone status is not definite", () => {
    expect(mediaDisplayStatus("prompt", false)).toBe("ask-on-use");
    expect(mediaDisplayStatus("unknown", false)).toBe("ask-on-use");
    expect(mediaDisplayStatus("prompt", true)).toBe("granted");
    expect(mediaDisplayStatus("denied", false)).toBe("denied");
    expect(mediaDisplayStatus("granted", false)).toBe("granted");
  });

  it("asks for microphone and camera together unless one is already denied", () => {
    expect(mediaConstraintsForRequest(prompt)).toEqual({ audio: true, video: true });
    expect(
      mediaConstraintsForRequest({ microphone: "prompt", camera: "denied" }),
    ).toEqual({ audio: true });
    expect(
      mediaConstraintsForRequest({ microphone: "denied", camera: "denied" }),
    ).toBeNull();
  });

  it("stops every track after the permission request", async () => {
    const stream = liveStream();
    await captureAndRelease(async () => stream, { audio: true, video: true });
    expect(activeTrackCount(stream)).toBe(0);
    expect(stream.tracks.every((track) => track.readyState === "ended")).toBe(true);
  });

  it("stops tracks when notification permission is requested first", async () => {
    const stream = liveStream();
    const order: string[] = [];
    const next = await enableAllPermissions({
      includeNotifications: true,
      statuses: prompt,
      requestNotification: async () => {
        order.push("notification");
        return "granted";
      },
      getUserMedia: async (constraints) => {
        order.push("media");
        expect(constraints).toEqual({ audio: true, video: true });
        return stream;
      },
    });
    expect(order).toEqual(["notification", "media"]);
    expect(activeTrackCount(stream)).toBe(0);
    expect(next.mediaGranted).toBe(true);
    expect(next.statuses).toEqual(granted);
  });

  it("skips the install-only notification prompt and a denied browser prompt", async () => {
    const stream = liveStream();
    let asked = false;
    await enableAllPermissions({
      includeNotifications: false,
      statuses: { ...prompt, camera: "denied" },
      requestNotification: async () => {
        asked = true;
        return "granted";
      },
      getUserMedia: async (constraints) => {
        expect(constraints).toEqual({ audio: true });
        return stream;
      },
    });
    expect(asked).toBe(false);
    expect(activeTrackCount(stream)).toBe(0);
  });

  it("returns the media error name instead of dropping it", async () => {
    const error = new Error("blocked");
    error.name = "NotAllowedError";
    const next = await enableAllPermissions({
      includeNotifications: false,
      statuses: prompt,
      requestNotification: async () => "granted",
      getUserMedia: async () => {
        throw error;
      },
    });
    expect(next.mediaGranted).toBe(false);
    expect(next.mediaError?.name).toBe("NotAllowedError");
    expect(next.mediaError?.device).toBe("both");
    expect(next.statuses.microphone).toBe("denied");
    expect(next.statuses.camera).toBe("denied");
  });

  it("reports a skipped capture when both devices are already denied", async () => {
    const next = await enableAllPermissions({
      includeNotifications: false,
      statuses: { ...prompt, microphone: "denied", camera: "denied" },
      requestNotification: async () => "granted",
      getUserMedia: async () => {
        throw new Error("should not run");
      },
    });
    expect(next.mediaError).toEqual({ name: "NotAllowedError", elapsedMs: 0, device: "both" });
  });

  it("shows the iPhone install guide only outside the installed web app", () => {
    expect(showsIosInstallGuide({ ios: true, standalone: false })).toBe(true);
    expect(showsIosInstallGuide({ ios: true, standalone: true })).toBe(false);
    expect(showsIosInstallGuide({ ios: false, standalone: false })).toBe(false);
  });
});
