"use client";

import { fa } from "@/lib/i18n/fa";
import {
  PERMISSION_KINDS,
  showsIosInstallGuide,
  type MediaDisplay,
  type PermissionKind,
  type PermissionStatus,
  type ShownPermissions,
} from "@/lib/permissions/status";

const title: Record<PermissionKind, string> = {
  notifications: fa.permissions.notifications,
  microphone: fa.permissions.microphone,
  camera: fa.permissions.camera,
};

const hint: Record<PermissionKind, string> = {
  notifications: fa.permissions.notificationsHint,
  microphone: fa.permissions.microphoneHint,
  camera: fa.permissions.cameraHint,
};

function statusLabel(status: PermissionStatus | MediaDisplay): string {
  if (status === "ask-on-use") return fa.permissions.askOnUse;
  return fa.permissions[status];
}

function deniedText(kind: PermissionKind, ios: boolean): string {
  return ios ? fa.permissions.deniedIos[kind] : fa.permissions.deniedOther[kind];
}

export function PermissionRows({
  statuses,
  ios,
  standalone,
}: {
  statuses: ShownPermissions;
  ios: boolean;
  standalone: boolean;
}) {
  const install = showsIosInstallGuide({ ios, standalone });

  return (
    <ul className="space-y-4">
      {PERMISSION_KINDS.map((kind) => (
        <li key={kind} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{title[kind]}</span>
            <span className="text-muted-foreground text-sm">{statusLabel(statuses[kind])}</span>
          </div>
          <p className="text-muted-foreground text-sm leading-[1.7]">{hint[kind]}</p>
          {kind !== "notifications" && statuses[kind] === "ask-on-use" ? (
            <p className="text-muted-foreground text-sm leading-[1.7]">{fa.permissions.askOnUseHint}</p>
          ) : null}
          {kind === "notifications" && install ? (
            <p className="text-sm leading-[1.7]">{fa.permissions.iosInstall}</p>
          ) : null}
          {statuses[kind] === "denied" ? (
            <p className="text-sm leading-[1.7]">{deniedText(kind, ios)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
