import { fa } from "@/lib/i18n/fa";
import type { MediaAttemptError, MediaDevice } from "./status";

/** Faster than a system prompt can appear. Chrome's permission embargo rejects in this window. */
export const MEDIA_EMBARGO_MS = 300;

export type MediaFailureView = {
  lines: string[];
  errorName: string | null;
};

const PERMISSION_DENIED = new Set(["NotAllowedError", "PermissionDeniedError"]);

function deviceLabel(device: MediaDevice): string {
  if (device === "camera") return "Camera";
  if (device === "both") return "Microphone و Camera";
  return "Microphone";
}

export function androidPermissionGuide(device: MediaDevice, installed: boolean): string {
  const label = deviceLabel(device);
  const steps = `۱. تنظیمات گوشی ← Apps ← Chrome ← Permissions ← ${label} روی Allow. ۲. Chrome ← Settings ← Site settings ← ${label} ← این سایت را Allow کنید.`;
  return installed ? `${steps} ${fa.permissions.androidInstalled}` : steps;
}

function manualGuide(input: {
  device: MediaDevice;
  ios: boolean;
  installed: boolean;
}): string {
  if (input.ios) {
    if (input.device === "both") {
      return `${fa.permissions.deniedIos.microphone} ${fa.permissions.deniedIos.camera}`;
    }
    if (input.device === "camera") return fa.permissions.deniedIos.camera;
    return fa.permissions.deniedIos.microphone;
  }
  return androidPermissionGuide(input.device, input.installed);
}

export function describeMediaFailure(input: {
  errorName: string;
  elapsedMs: number;
  device: MediaDevice;
  ios: boolean;
  installed: boolean;
}): MediaFailureView {
  const name = input.errorName || "Error";
  const silent = input.elapsedMs < MEDIA_EMBARGO_MS;
  const guide = manualGuide(input);

  if (name === "NotFoundError") {
    const missing =
      input.device === "camera"
        ? fa.chat.cameraMissing
        : input.device === "both"
          ? fa.permissions.mediaMissing
          : fa.chat.micMissing;
    return { lines: [missing], errorName: null };
  }

  if (name === "NotReadableError") {
    const busy =
      input.device === "camera"
        ? fa.permissions.cameraBusy
        : input.device === "both"
          ? fa.permissions.mediaBusy
          : fa.permissions.micBusy;
    return { lines: [busy], errorName: null };
  }

  if (PERMISSION_DENIED.has(name)) {
    const lines = silent
      ? [fa.permissions.silentReject, fa.permissions.notAllowed, guide]
      : [fa.permissions.notAllowed, guide];
    return { lines, errorName: null };
  }

  const lines = silent
    ? [fa.permissions.silentReject, guide, fa.permissions.requestFailed]
    : [fa.permissions.requestFailed];
  return { lines, errorName: name };
}

export function feedbackForEnable(input: {
  mediaError: MediaAttemptError | null;
  notificationError: string | null;
  mediaGranted: boolean;
  ios: boolean;
  installed: boolean;
}): MediaFailureView | null {
  if (input.mediaError) {
    return describeMediaFailure({
      errorName: input.mediaError.name,
      elapsedMs: input.mediaError.elapsedMs,
      device: input.mediaError.device,
      ios: input.ios,
      installed: input.installed,
    });
  }
  if (input.notificationError) {
    return {
      lines: [
        fa.permissions.notAllowed,
        input.ios ? fa.permissions.deniedIos.notifications : fa.permissions.deniedOther.notifications,
      ],
      errorName: input.notificationError === "denied" ? null : input.notificationError,
    };
  }
  if (!input.mediaGranted) {
    return describeMediaFailure({
      errorName: "Error",
      elapsedMs: 0,
      device: "both",
      ios: input.ios,
      installed: input.installed,
    });
  }
  return null;
}
