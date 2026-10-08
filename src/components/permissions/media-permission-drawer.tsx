"use client";

import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { fa } from "@/lib/i18n/fa";
import {
  clearPermissionError,
  markSessionMedia,
  readPermissionErrors,
  rememberMediaError,
} from "@/lib/permissions/browser";
import { describeMediaFailure, type MediaFailureView } from "@/lib/permissions/media-feedback";
import {
  captureAndRelease,
  constraintsForKind,
  type MediaAttemptError,
  type MediaKind,
  type PermissionStatus,
} from "@/lib/permissions/status";
import { MediaFailureText, PermissionButton } from "./permission-button";

function installedApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function MediaPermissionDrawer({
  kind,
  status,
  ios,
  open,
  onOpenChange,
  onResolved,
}: {
  kind: MediaKind;
  status: PermissionStatus;
  ios: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: (status: PermissionStatus) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [failure, setFailure] = useState<MediaAttemptError | null>(null);
  const title = kind === "microphone" ? fa.chat.voiceNeedsMic : fa.chat.videoNeedsCamera;

  useEffect(() => {
    setInstalled(installedApp());
  }, []);

  useEffect(() => {
    if (!open) return;
    const logged = readPermissionErrors()[kind];
    if (!logged) return;
    setFailure({ name: logged.name, elapsedMs: logged.elapsedMs, device: kind });
  }, [open, kind]);

  const view: MediaFailureView | null = failure
    ? describeMediaFailure({
        errorName: failure.name,
        elapsedMs: failure.elapsedMs,
        device: kind,
        ios,
        installed,
      })
    : status === "denied"
      ? describeMediaFailure({
          errorName: "NotAllowedError",
          elapsedMs: 300,
          device: kind,
          ios,
          installed,
        })
      : null;

  async function allow() {
    setBusy(true);
    setFailure(null);
    const started = Date.now();
    try {
      await captureAndRelease(
        (constraints) => navigator.mediaDevices.getUserMedia(constraints),
        constraintsForKind(kind),
      );
      clearPermissionError(kind);
      markSessionMedia(kind);
      if (kind === "camera") {
        clearPermissionError("microphone");
        markSessionMedia("microphone");
      }
      onResolved("granted");
      onOpenChange(false);
    } catch (error) {
      const name = error instanceof Error && error.name ? error.name : "Error";
      const attempt: MediaAttemptError = {
        name,
        elapsedMs: Date.now() - started,
        device: kind,
      };
      setFailure(attempt);
      rememberMediaError(kind, attempt);
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        onResolved("denied");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-2 px-4">
          <MediaFailureText view={view} />
        </div>
        <DrawerFooter>
          <PermissionButton disabled={busy} onActivate={() => void allow()}>
            {busy ? fa.permissions.requesting : fa.chat.allowPermission}
          </PermissionButton>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
