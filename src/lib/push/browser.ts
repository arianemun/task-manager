export const PUSH_ENDPOINT_KEY = "tm-push-endpoint";

export function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function releaseDevicePush(): void {
  if (typeof window === "undefined") return;
  const endpoint = localStorage.getItem(PUSH_ENDPOINT_KEY);
  if (!endpoint) return;
  localStorage.removeItem(PUSH_ENDPOINT_KEY);
  void fetch("/api/push/subscription", {
    method: "DELETE",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

export async function syncPushSubscription(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const keyRes = await fetch("/api/push/public-key");
  if (!keyRes.ok) return;
  const { publicKey } = (await keyRes.json()) as { publicKey?: string };
  if (!publicKey) return;
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
  const previousEndpoint = localStorage.getItem(PUSH_ENDPOINT_KEY);
  if (previousEndpoint === json.endpoint) {
    const probe = await fetch("/api/push/subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        previousEndpoint,
      }),
    });
    if (probe.ok) localStorage.setItem(PUSH_ENDPOINT_KEY, json.endpoint);
    return;
  }
  const saved = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      previousEndpoint,
    }),
  });
  if (saved.ok) localStorage.setItem(PUSH_ENDPOINT_KEY, json.endpoint);
}
