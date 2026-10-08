"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { fa } from "@/lib/i18n/fa";
import {
  clearPermissionError,
  readShownPermissions,
  rememberMediaError,
  rememberMediaResult,
  rememberPermissionError,
} from "@/lib/permissions/browser";
import { feedbackForEnable, type MediaFailureView } from "@/lib/permissions/media-feedback";
import {
  enableAllPermissions,
  isIosUserAgent,
  shouldShowPermissionPrep,
  type PermissionStatus,
  type ShownPermissions,
} from "@/lib/permissions/status";
import {
  completePermissionSetupAction,
  snoozePermissionPrepAction,
} from "@/server/actions/permissions";
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

export function PermissionPrep({
  snoozeUntil,
  setupCompleted,
}: {
  snoozeUntil: number | null;
  setupCompleted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<ShownPermissions>(empty);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    if (setupCompleted || (snoozeUntil != null && snoozeUntil > Date.now())) return;

    let cancelled = false;
    void readShownPermissions().then((next) => {
      if (cancelled) return;
      setStatuses(next);
      setOpen(
        shouldShowPermissionPrep({
          snoozeUntil,
          now: Date.now(),
          setupCompleted,
          statuses: requestStatuses(next),
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [setupCompleted, snoozeUntil]);

  async function enableAll() {
    setBusy(true);
    setError("");
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
      const note = feedbackForEnable({
        mediaError: next.mediaError,
        notificationError: next.notificationError,
        mediaGranted: next.mediaGranted,
        ios: agent,
        installed,
      });
      if (next.mediaGranted) {
        const saved = await completePermissionSetupAction();
        if (!saved.ok) {
          setError(saved.error);
          return;
        }
      }
      if (note) {
        setFailure(note);
        return;
      }
      setOpen(false);
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

  async function later() {
    setBusy(true);
    setError("");
    const result = await snoozePermissionPrepAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{fa.permissions.title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{fa.permissions.description}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          <PermissionRows statuses={statuses} ios={ios} standalone={standalone} />
          <MediaFailureText view={failure} />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <PermissionButton disabled={busy} onActivate={() => void enableAll()}>
            {busy ? fa.permissions.requesting : fa.permissions.enableAll}
          </PermissionButton>
          <PermissionButton variant="outline" disabled={busy} onActivate={() => void later()}>
            {fa.permissions.later}
          </PermissionButton>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
