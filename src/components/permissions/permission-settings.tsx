"use client";

import { useEffect, useState } from "react";
import { fa } from "@/lib/i18n/fa";
import {
  clearPermissionError,
  readPermissionErrors,
  readShownPermissions,
  rememberMediaError,
  rememberMediaResult,
  rememberPermissionError,
  subscribeSessionMedia,
  type PermissionErrorLog,
} from "@/lib/permissions/browser";
import { feedbackForEnable, type MediaFailureView } from "@/lib/permissions/media-feedback";
import {
  enableAllPermissions,
  isIosUserAgent,
  type PermissionKind,
  type PermissionStatus,
  type ShownPermissions,
} from "@/lib/permissions/status";
import { MediaFailureText, PermissionButton } from "./permission-button";
import { PermissionRows } from "./permission-rows";

const empty: ShownPermissions = {
  notifications: "unknown",
  microphone: "ask-on-use",
  camera: "ask-on-use",
};

function requestStatuses(shown: ShownPermissions): Record<
  "notifications" | "microphone" | "camera",
  PermissionStatus
> {
  return {
    notifications: shown.notifications,
    microphone: shown.microphone === "ask-on-use" ? "unknown" : shown.microphone,
    camera: shown.camera === "ask-on-use" ? "unknown" : shown.camera,
  };
}

export function PermissionSettings() {
  const [statuses, setStatuses] = useState<ShownPermissions>(empty);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<PermissionKind, PermissionErrorLog>>>({});
  const [failure, setFailure] = useState<MediaFailureView | null>(null);

  useEffect(() => {
    const agent = isIosUserAgent(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints,
    );
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setIos(agent);
    setStandalone(installed);
    let cancelled = false;
    const refresh = () => {
      void readShownPermissions().then((next) => {
        if (!cancelled) setStatuses(next);
      });
      if (!cancelled) setErrors(readPermissionErrors());
    };
    refresh();
    const unsubscribe = subscribeSessionMedia(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const requestable =
    (!(ios && !standalone) &&
      (statuses.notifications === "prompt" || statuses.notifications === "unknown")) ||
    statuses.microphone === "ask-on-use" ||
    statuses.camera === "ask-on-use";
  const deniedSomewhere =
    statuses.notifications === "denied" ||
    statuses.microphone === "denied" ||
    statuses.camera === "denied";

  async function requestAgain() {
    if (!requestable) return;
    setBusy(true);
    setFailure(null);
    try {
      const agent = isIosUserAgent(
        navigator.userAgent,
        navigator.platform,
        navigator.maxTouchPoints,
      );
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      const next = await enableAllPermissions({
        includeNotifications: !(agent && !installed),
        statuses: requestStatuses(statuses),
        requestNotification: () => Notification.requestPermission(),
        getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
      });
      rememberMediaResult(next.statuses);
      if (next.mediaGranted) {
        clearPermissionError("microphone");
        clearPermissionError("camera");
      } else if (next.mediaError) {
        rememberMediaError(next.mediaError.device, next.mediaError);
      }
      if (next.notificationError) {
        rememberPermissionError("notifications", next.notificationError);
      }
      const shown = await readShownPermissions();
      shown.notifications = next.statuses.notifications;
      setStatuses(shown);
      setErrors(readPermissionErrors());
      setFailure(
        feedbackForEnable({
          mediaError: next.mediaError,
          notificationError: next.notificationError,
          mediaGranted: next.mediaGranted,
          ios: agent,
          installed,
        }),
      );
    } catch (error) {
      const name = error instanceof Error && error.name ? error.name : "Error";
      setFailure(
        feedbackForEnable({
          mediaError: { name, elapsedMs: 0, device: "both" },
          notificationError: null,
          mediaGranted: false,
          ios,
          installed: standalone,
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PermissionRows statuses={statuses} ios={ios} standalone={standalone} errors={errors} />
      {deniedSomewhere ? (
        <p className="text-sm leading-[1.7]">{fa.permissions.deniedWarning}</p>
      ) : null}
      <MediaFailureText view={failure} />
      <PermissionButton disabled={busy || !requestable} onActivate={() => void requestAgain()}>
        {busy ? fa.permissions.requesting : fa.permissions.requestAgain}
      </PermissionButton>
    </div>
  );
}
