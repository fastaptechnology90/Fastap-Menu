// Bump this on every strategy change so the activate step purges old caches.
const CACHE = "fastmenu-guest-v3";

// Only cache small, stable helpers up front. We deliberately DO NOT pre-cache "/" or app
// routes — navigations are network-first so the latest index.html (and its freshly-hashed
// JS/CSS bundle) always loads. This is what makes a new deploy show up immediately.
const SHELL = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/user/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.filter(Boolean)).catch(() => {}))
      .then(() => self.skipWaiting()), // take over ASAP
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()), // control open pages immediately
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return; // never touch API calls

  // Page navigations (the HTML document) → NETWORK FIRST. Always fetch the latest HTML so a
  // new deploy is picked up right away; fall back to cache only when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match("/user/offline"))),
    );
    return;
  }

  // Everything else (hashed JS/CSS/images, fonts) → stale-while-revalidate. Hashed files are
  // immutable, so serving from cache is safe and fast, while we refresh in the background.
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(request, clone)).catch(() => {});
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
