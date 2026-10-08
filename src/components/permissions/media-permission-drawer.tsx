"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { fa } from "@/lib/i18n/fa";
import { markSessionMedia } from "@/lib/permissions/browser";
import {
  captureAndRelease,
  constraintsForKind,
  interpretGetUserMedia,
  type MediaKind,
  type PermissionStatus,
} from "@/lib/permissions/status";

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
  const [missing, setMissing] = useState(false);
  const denied = status === "denied";
  const title = kind === "microphone" ? fa.chat.voiceNeedsMic : fa.chat.videoNeedsCamera;
  const guide = denied
    ? ios
      ? fa.permissions.deniedIos[kind]
      : fa.permissions.deniedOther[kind]
    : missing
      ? kind === "microphone"
        ? fa.chat.micMissing
        : fa.chat.cameraMissing
      : null;

  async function allow() {
    setMissing(false);
    try {
      await captureAndRelease(
        (constraints) => navigator.mediaDevices.getUserMedia(constraints),
        constraintsForKind(kind),
      );
      markSessionMedia(kind);
      if (kind === "camera") markSessionMedia("microphone");
      onResolved("granted");
      onOpenChange(false);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const outcome = interpretGetUserMedia({ ok: false, errorName: name, fingerDown: true });
      if (outcome === "missing") {
        setMissing(true);
        return;
      }
      onResolved("denied");
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {guide ? <DrawerDescription>{guide}</DrawerDescription> : null}
        </DrawerHeader>
        <DrawerFooter>
          <Button type="button" onClick={() => void allow()}>
            {fa.chat.allowPermission}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
