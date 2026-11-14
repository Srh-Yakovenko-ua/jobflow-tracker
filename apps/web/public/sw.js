const ICON = '/icons/jobflow-192.png';

const FALLBACK = { title: 'JobFlow', body: '', url: '/notifications', tag: 'jobflow' };

const FIELDS = ['title', 'body', 'url', 'tag'];

function isMessage(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    FIELDS.every((field) => typeof value[field] === 'string')
  );
}

function messageOf(data) {
  try {
    const parsed = data ? data.json() : null;
    return isMessage(parsed) ? parsed : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

function targetOf(data) {
  const home = new URL(FALLBACK.url, self.location.origin).href;
  const url = data && typeof data.url === 'string' ? data.url : FALLBACK.url;
  try {
    const target = new URL(url, self.location.origin);
    return target.origin === self.location.origin ? target.href : home;
  } catch {
    return home;
  }
}

async function openTarget(url) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const open = windows.find((client) => client.url === url);
  return open ? open.focus() : self.clients.openWindow(url);
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const { title, body, url, tag } = messageOf(event.data);
  event.waitUntil(
    self.registration.showNotification(title, { body, tag, icon: ICON, data: { url } }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openTarget(targetOf(event.notification.data)));
});
