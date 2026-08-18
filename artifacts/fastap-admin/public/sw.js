const CACHE = "fastmenu-guest-v2";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/user/menu",
  "/user/cart",
  "/user/offline",
  "/user/pwa",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.filter(Boolean)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response.ok && (url.origin === self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "FastMenu", body: "You have an update" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* ignore */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "fastmenu-push",
      data: { url: "/user/menu?slug=spice-garden" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/user/menu?slug=spice-garden";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes("/user/"));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
