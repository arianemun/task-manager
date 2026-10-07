/* Service Worker — فقط کش استاتیک؛ API و صفحات احراز هویت‌شده کش نمی‌شوند */
const CACHE = "tm-static-v1";
const STATIC_RE =
  /\/(_next\/static\/|fonts\/|icons\/|favicon|manifest\.webmanifest)/;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
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

self.addEventListener("push", (event) => {
  let payload = { title: "آزمایش اعلان", body: "", url: "/admin/push-lab" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data ? event.data.text() : "";
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/admin/push-lab" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin/push-lab";
  event.waitUntil(self.clients.openWindow(url));
});
