import {
  fromNotificationPermission,
  mapPermissionState,
  mediaDisplayStatus,
  type MediaKind,
  type PermissionKind,
  type PermissionMap,
  type PermissionStatus,
  type ShownPermissions,
} from "./status";

const SESSION_EVENT = "tm-media-permission";

const sessionMedia: Record<MediaKind, boolean> = {
  microphone: false,
  camera: false,
};

function notifySession(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function markSessionMedia(kind: MediaKind): void {
  sessionMedia[kind] = true;
  notifySession();
}

export function sessionMediaGranted(kind: MediaKind): boolean {
  return sessionMedia[kind];
}

export function rememberMediaResult(statuses: Pick<PermissionMap, MediaKind>): void {
  let changed = false;
  if (statuses.microphone === "granted" && !sessionMedia.microphone) {
    sessionMedia.microphone = true;
    changed = true;
  }
  if (statuses.camera === "granted" && !sessionMedia.camera) {
    sessionMedia.camera = true;
    changed = true;
  }
  if (changed) notifySession();
}

export function subscribeSessionMedia(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(SESSION_EVENT, listener);
  return () => window.removeEventListener(SESSION_EVENT, listener);
}

const QUERY_NAME: Record<PermissionKind, string> = {
  notifications: "notifications",
  microphone: "microphone",
  camera: "camera",
};

export async function getPermissionStatus(kind: PermissionKind): Promise<PermissionStatus> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const result = await navigator.permissions.query({
      name: QUERY_NAME[kind] as PermissionName,
    });
    return mapPermissionState(result.state);
  } catch {
    return "unknown";
  }
}

/** Notification.permission is reliable on an installed iOS web app. Mic and camera are not. */
export function readNotificationPermission(): PermissionStatus {
  if (typeof Notification === "undefined") return "unknown";
  return fromNotificationPermission(Notification.permission);
}

export async function readShownPermissions(): Promise<ShownPermissions> {
  const [microphone, camera] = await Promise.all([
    getPermissionStatus("microphone"),
    getPermissionStatus("camera"),
  ]);
  return {
    notifications: readNotificationPermission(),
    microphone: mediaDisplayStatus(microphone, sessionMedia.microphone),
    camera: mediaDisplayStatus(camera, sessionMedia.camera),
  };
}
