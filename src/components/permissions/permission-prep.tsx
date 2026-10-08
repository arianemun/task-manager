"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { readShownPermissions, rememberMediaResult } from "@/lib/permissions/browser";
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
      const shown = await readShownPermissions();
      shown.notifications = next.statuses.notifications;
      setStatuses(shown);
      if (next.mediaGranted) {
        const saved = await completePermissionSetupAction();
        if (!saved.ok) {
          setError(saved.error);
          return;
        }
        setOpen(false);
      }
    } catch {
      setError(fa.common.error);
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
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button type="button" disabled={busy} onClick={() => void enableAll()}>
            {fa.permissions.enableAll}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void later()}>
            {fa.permissions.later}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
