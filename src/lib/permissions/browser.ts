import {
  fromNotificationPermission,
  mapPermissionState,
  mediaDisplayStatus,
  type MediaDevice,
  type MediaKind,
  type PermissionKind,
  type PermissionMap,
  type PermissionStatus,
  type ShownPermissions,
} from "./status";

const SESSION_EVENT = "tm-media-permission";
const ERROR_KEY = "tm-permission-errors";

export type PermissionErrorLog = {
  name: string;
  at: number;
  elapsedMs: number;
};

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

function writePermissionErrors(value: Partial<Record<PermissionKind, PermissionErrorLog>>): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ERROR_KEY, JSON.stringify(value));
  notifySession();
}

export function readPermissionErrors(): Partial<Record<PermissionKind, PermissionErrorLog>> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(ERROR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<PermissionKind, PermissionErrorLog>>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function rememberPermissionError(
  kind: PermissionKind,
  name: string,
  at = Date.now(),
  elapsedMs = 0,
): void {
  const all = readPermissionErrors();
  all[kind] = { name: name || "Error", at, elapsedMs };
  writePermissionErrors(all);
}

export function rememberMediaError(
  device: MediaDevice,
  error: { name: string; elapsedMs: number },
  at = Date.now(),
): void {
  if (device === "microphone" || device === "both") {
    rememberPermissionError("microphone", error.name, at, error.elapsedMs);
  }
  if (device === "camera" || device === "both") {
    rememberPermissionError("camera", error.name, at, error.elapsedMs);
  }
}

export function clearPermissionError(kind: PermissionKind): void {
  const all = readPermissionErrors();
  if (!all[kind]) return;
  delete all[kind];
  writePermissionErrors(all);
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
