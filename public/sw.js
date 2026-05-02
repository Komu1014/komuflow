/* Komuflow Service Worker — Push Notifications */
const timers = new Map();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));

self.addEventListener("message", e => {
  const { type, id, title, body, fireAt } = e.data || {};

  if (type === "SCHEDULE") {
    if (timers.has(id)) clearTimeout(timers.get(id));
    const delay = fireAt - Date.now();
    if (delay < 0) return;
    const t = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: id,
        renotify: true,
        vibrate: [200, 100, 200],
      });
      timers.delete(id);
    }, delay);
    timers.set(id, t);
  }

  if (type === "CANCEL") {
    if (timers.has(id)) { clearTimeout(timers.get(id)); timers.delete(id); }
  }

  if (type === "CANCEL_ALL") {
    timers.forEach(t => clearTimeout(t));
    timers.clear();
  }
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
