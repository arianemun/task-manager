/* Service Worker — فقط کش استاتیک؛ API و صفحات احراز هویت‌شده کش نمی‌شوند.
   SW_VERSION با هر build تولید عوض می‌شود تا مرورگر فایل جدید را بگیرد. */
const SW_VERSION = "1.3.3-push";
self.__swVersion = SW_VERSION;
const CACHE = "tm-static-v1";
const STATIC_RE =
  /\/(_next\/static\/|fonts\/|icons\/|favicon|manifest\.webmanifest)/;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // هرگز کش نکن
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/change-password") ||
    req.headers.get("accept")?.includes("text/x-component")
  ) {
    return;
  }

  if (!STATIC_RE.test(url.pathname)) {
    // ناوبری صفحه — فقط شبکه؛ آفلاین پیام فارسی
    if (req.mode === "navigate") {
      event.respondWith(
        fetch(req).catch(
          () =>
            new Response(
              "<!doctype html><html lang='fa' dir='rtl'><meta charset='utf-8'><title>آفلاین</title><body style='font-family:Tahoma;text-align:center;padding:3rem'><h1>اتصال برقرار نیست</h1><p>لطفاً اینترنت را بررسی کنید.</p></body></html>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } },
            ),
        ),
      );
    }
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (
          cached ||
          new Response("آفلاین", { status: 503, statusText: "Offline" })
        );
      }
    }),
  );
});

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function showPush(payload) {
  const title = payload.title || "اعلان";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/" },
  };
  await self.registration.showNotification(title, options);
  const count = Number(payload.badge);
  if (!Number.isFinite(count)) return;
  if (count > 0 && typeof navigator.setAppBadge === "function") {
    await navigator.setAppBadge(count);
  } else if (typeof navigator.clearAppBadge === "function") {
    await navigator.clearAppBadge();
  }
}

self.addEventListener("push", (event) => {
  let payload = { title: "اعلان", body: "", url: "/", tag: null, badge: 0 };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data ? event.data.text() : "";
  }
  event.waitUntil(showPush(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (same) {
        await same.focus();
        if (typeof same.navigate === "function") {
          try {
            await same.navigate(target);
            return;
          } catch {
            /* پنجرهٔ باز با پیام جابه‌جا می‌شود */
          }
        }
        same.postMessage({ type: "push-navigate", url: path });
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const keyRes = await fetch("/api/push/public-key");
      if (!keyRes.ok) return;
      const { publicKey } = await keyRes.json();
      const next = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = next.toJSON();
      await fetch("/api/push/subscription", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          previousEndpoint: event.oldSubscription?.endpoint ?? null,
        }),
      });
    })(),
  );
});
