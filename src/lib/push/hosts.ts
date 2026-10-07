export const PUSH_PROBE_HOSTS = [
  "fcm.googleapis.com",
  "web.push.apple.com",
  "updates.push.services.mozilla.com",
] as const;

const EXACT_HOSTS = new Set<string>(PUSH_PROBE_HOSTS);

export function subscriptionHostAllowed(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  if (host.endsWith(".push.services.mozilla.com")) return true;
  if (host.endsWith(".push.apple.com")) return true;
  if (host.endsWith(".notify.windows.com")) return true;
  if (host === "fcm.googleapis.com" || host.endsWith(".fcm.googleapis.com")) return true;
  return false;
}
