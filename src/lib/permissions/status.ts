export const PERMISSION_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export const PERMISSION_KINDS = ["notifications", "microphone", "camera"] as const;
export type PermissionKind = (typeof PERMISSION_KINDS)[number];
export type PermissionStatus = "granted" | "prompt" | "denied" | "unknown";
export type PermissionMap = Record<PermissionKind, PermissionStatus>;
export type MediaKind = "microphone" | "camera";
export type MediaDisplay = "granted" | "denied" | "ask-on-use";
export type ShownPermissions = {
  notifications: PermissionStatus;
  microphone: MediaDisplay;
  camera: MediaDisplay;
};
export type CaptureUi = "record" | "hold-again" | "drawer" | "missing" | "error";

export type TrackLike = { readyState: string; stop: () => void };
export type TrackStream = { getTracks: () => TrackLike[] };

export function mapPermissionState(state: string | null | undefined): PermissionStatus {
  if (state === "granted" || state === "denied" || state === "prompt") return state;
  return "unknown";
}

export function fromNotificationPermission(
  value: string | null | undefined,
): PermissionStatus {
  if (value === "granted" || value === "denied") return value;
  if (value === "default") return "prompt";
  return "unknown";
}

export function permissionSnoozeUntil(now: number): number {
  return now + PERMISSION_SNOOZE_MS;
}

export function shouldShowPermissionPrep(input: {
  snoozeUntil: number | null;
  now: number;
  setupCompleted: boolean;
  statuses: PermissionMap;
}): boolean {
  if (input.setupCompleted) return false;
  if (input.snoozeUntil != null && input.snoozeUntil > input.now) return false;
  return PERMISSION_KINDS.some((kind) => input.statuses[kind] !== "granted");
}

/** Permissions API is only a hint. Skip the capture itself only when it is definitely denied. */
export function shouldCaptureMedia(queried: PermissionStatus, sessionGranted: boolean): boolean {
  if (sessionGranted) return true;
  return queried !== "denied";
}

export function mediaDisplayStatus(
  queried: PermissionStatus,
  sessionGranted: boolean,
): MediaDisplay {
  if (sessionGranted || queried === "granted") return "granted";
  if (queried === "denied") return "denied";
  return "ask-on-use";
}

export function interpretGetUserMedia(input: {
  ok: boolean;
  errorName?: string;
  fingerDown: boolean;
}): CaptureUi {
  if (input.ok) return input.fingerDown ? "record" : "hold-again";
  if (
    input.errorName === "NotAllowedError" ||
    input.errorName === "SecurityError" ||
    input.errorName === "PermissionDeniedError"
  ) {
    return "drawer";
  }
  if (input.errorName === "NotFoundError") return "missing";
  return "error";
}

export function constraintsForKind(kind: MediaKind): MediaStreamConstraints {
  if (kind === "microphone") return { audio: true };
  return { audio: true, video: true };
}

export function isIosUserAgent(
  userAgent: string,
  platform = "",
  maxTouchPoints = 0,
): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function showsIosInstallGuide(input: {
  ios: boolean;
  standalone: boolean;
}): boolean {
  return input.ios && !input.standalone;
}

export function stopAllTracks(stream: TrackStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export function activeTrackCount(stream: TrackStream): number {
  return stream.getTracks().filter((track) => track.readyState === "live").length;
}

export function mediaConstraintsForRequest(statuses: Pick<PermissionMap, "microphone" | "camera">):
  | { audio: true; video: true }
  | { audio: true }
  | { video: true }
  | null {
  const audio = statuses.microphone !== "denied";
  const video = statuses.camera !== "denied";
  if (audio && video) return { audio: true, video: true };
  if (audio) return { audio: true };
  if (video) return { video: true };
  return null;
}

export async function captureAndRelease(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<TrackStream>,
  constraints: MediaStreamConstraints,
): Promise<void> {
  let stream: TrackStream | null = null;
  try {
    stream = await getUserMedia(constraints);
  } finally {
    if (stream) stopAllTracks(stream);
  }
}

export type MediaDevice = "microphone" | "camera" | "both";

export type MediaAttemptError = {
  name: string;
  elapsedMs: number;
  device: MediaDevice;
};

export type EnableAllResult = {
  statuses: PermissionMap;
  mediaGranted: boolean;
  mediaError: MediaAttemptError | null;
  notificationError: string | null;
};

export function deviceForConstraints(constraints: MediaStreamConstraints): MediaDevice {
  const audio = "audio" in constraints && Boolean(constraints.audio);
  const video = "video" in constraints && Boolean(constraints.video);
  if (audio && video) return "both";
  if (video) return "camera";
  return "microphone";
}

export async function enableAllPermissions(deps: {
  includeNotifications: boolean;
  statuses: PermissionMap;
  requestNotification: () => Promise<string>;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<TrackStream>;
}): Promise<EnableAllResult> {
  const next: PermissionMap = { ...deps.statuses };
  let mediaGranted = false;
  let notificationError: string | null = null;

  if (deps.includeNotifications && next.notifications !== "denied") {
    try {
      next.notifications = fromNotificationPermission(await deps.requestNotification());
      if (next.notifications === "denied") notificationError = "denied";
    } catch (error) {
      next.notifications = "unknown";
      notificationError = error instanceof Error && error.name ? error.name : "Error";
    }
  }

  const constraints = mediaConstraintsForRequest(next);
  if (!constraints) {
    return {
      statuses: next,
      mediaGranted,
      mediaError: { name: "NotAllowedError", elapsedMs: 0, device: "both" },
      notificationError,
    };
  }

  const started = Date.now();
  try {
    await captureAndRelease(deps.getUserMedia, constraints);
    mediaGranted = true;
    if ("audio" in constraints && constraints.audio) next.microphone = "granted";
    if ("video" in constraints && constraints.video) next.camera = "granted";
  } catch (error) {
    const name = error instanceof Error && error.name ? error.name : "Error";
    const denied =
      name === "NotAllowedError" ||
      name === "PermissionDeniedError" ||
      name === "SecurityError";
    if ("audio" in constraints && constraints.audio) {
      next.microphone = denied ? "denied" : "prompt";
    }
    if ("video" in constraints && constraints.video) {
      next.camera = denied ? "denied" : "prompt";
    }
    return {
      statuses: next,
      mediaGranted,
      mediaError: {
        name,
        elapsedMs: Date.now() - started,
        device: deviceForConstraints(constraints),
      },
      notificationError,
    };
  }

  return { statuses: next, mediaGranted, mediaError: null, notificationError };
}
