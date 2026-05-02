// sw.js — Komu TimeFlow Service Worker
// 负责在页面关闭后仍能按时发送本地推送通知

const DB_NAME = "komu_notif_db";
const STORE   = "scheduled";

/* ── IndexedDB helpers ── */
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function saveNotif(notif) {
  const db    = await openDB();
  const tx    = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(notif);
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror    = e => rej(e.target.error);
  });
}

async function deleteNotif(id) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror    = e => rej(e.target.error);
  });
}

async function getAllNotifs() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function clearAllNotifs() {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror    = e => rej(e.target.error);
  });
}

/* ── In-memory timers (alive while SW is running) ── */
const timers = new Map(); // id → timeoutId

function armTimer(notif) {
  const delay = notif.fireAt - Date.now();
  if (delay <= 0) {
    // Already past — fire immediately if within 60 s grace window
    if (delay > -60000) fireNotif(notif);
    return;
  }
  // SW may be killed and restarted; cap at 25 minutes to avoid
  // the timer being wiped when the SW goes idle. We re-arm on SW restart.
  const safeDelay = Math.min(delay, 25 * 60 * 1000);
  const tid = setTimeout(() => {
    if (delay > safeDelay) {
      // Wasn't the real fire time yet — re-arm
      armTimer(notif);
    } else {
      fireNotif(notif);
    }
  }, safeDelay);
  timers.set(notif.id, tid);
}

function disarmTimer(id) {
  if (timers.has(id)) {
    clearTimeout(timers.get(id));
    timers.delete(id);
  }
}

async function fireNotif(notif) {
  // Remove from DB so it doesn't re-fire on next SW wake
  await deleteNotif(notif.id);
  disarmTimer(notif.id);

  await self.registration.showNotification(notif.title, {
    body:    notif.body,
    icon:    "/icon-192.png",
    badge:   "/icon-192.png",
    tag:     notif.id,
    renotify: false,
    data:    { url: self.registration.scope },
  });
}

/* ── Re-arm all pending notifs on SW startup ── */
async function rearmAll() {
  const all = await getAllNotifs();
  const now = Date.now();
  for (const notif of all) {
    if (notif.fireAt < now - 60000) {
      // Too old — clean up silently
      await deleteNotif(notif.id);
    } else {
      armTimer(notif);
    }
  }
}

/* ── Keep SW alive with a periodic alarm via setTimeout chain ── */
// We use a recurring self-ping every 20 min so the SW doesn't get killed
// before timers fire. (On iOS this has limits, but it's the best we can do
// for a PWA without Push API.)
function keepAlive() {
  setTimeout(async () => {
    await rearmAll(); // re-arm any that were loaded from DB
    keepAlive();
  }, 20 * 60 * 1000);
}

/* ── SW lifecycle ── */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    clients.claim().then(() => rearmAll()).then(() => keepAlive())
  );
});

/* ── Message handler (called from App.jsx via postMessage) ── */
self.addEventListener("message", async e => {
  const msg = e.data;
  if (!msg || !msg.type) return;

  if (msg.type === "SCHEDULE") {
    // { type, id, title, body, fireAt }
    const notif = { id: msg.id, title: msg.title, body: msg.body, fireAt: msg.fireAt };
    disarmTimer(notif.id);          // cancel any existing timer for same id
    await saveNotif(notif);         // persist to IndexedDB (survives SW restart)
    armTimer(notif);                // arm in-memory timer
  }

  if (msg.type === "CANCEL") {
    disarmTimer(msg.id);
    await deleteNotif(msg.id);
  }

  if (msg.type === "CANCEL_ALL") {
    timers.forEach((tid) => clearTimeout(tid));
    timers.clear();
    await clearAllNotifs();
  }
});

/* ── Notification click: open/focus the app ── */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
