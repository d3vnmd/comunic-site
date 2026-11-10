// Comunic v2 service worker: хурдан эхлэлт (кэш) + push мэдэгдэл
const VER = 'cmc-v2-2';
const SHELL = ['/app/', '/app/app.css', '/app/main.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VER).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  const own = u.origin === location.origin && u.pathname.startsWith('/app/') && !u.pathname.endsWith('sw.js');
  const lib = u.hostname === 'cdn.jsdelivr.net' && /supabase-js@/.test(u.pathname);
  if (!own && !lib) return;
  // Хуучин кэшийг шууд өгөөд цаана нь шинэчилнэ (stale-while-revalidate); сангийн хувилбар нь тогтмол тул кэшээс
  e.respondWith(caches.open(VER).then(async (c) => {
    const hit = await c.match(r);
    const net = fetch(r).then((res) => { if (res && res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: 'Comunic', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Comunic', { body: d.body || '', tag: d.tag, icon: '/assets/icon-192.png', badge: '/assets/icon-192.png', data: { url: d.url || '/app/' }, renotify: !!d.tag }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || '/app/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => { for (const c of cs) if (c.url.includes('/app/') && 'focus' in c) return c.focus(); return self.clients.openWindow(url); }));
});
