"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fa } from "@/lib/i18n/fa";
import {
  readShownPermissions,
  rememberMediaResult,
  subscribeSessionMedia,
} from "@/lib/permissions/browser";
import {
  enableAllPermissions,
  isIosUserAgent,
  type PermissionStatus,
  type ShownPermissions,
} from "@/lib/permissions/status";
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PermissionRows statuses={statuses} ios={ios} standalone={standalone} />
      {deniedSomewhere ? (
        <p className="text-sm leading-[1.7]">{fa.permissions.deniedWarning}</p>
      ) : null}
      <Button type="button" disabled={busy || !requestable} onClick={() => void requestAgain()}>
        {fa.permissions.requestAgain}
      </Button>
    </div>
  );
}
