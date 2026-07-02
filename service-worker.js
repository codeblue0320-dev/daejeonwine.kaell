/* 오프라인 캐싱 + 알림 서비스워커 (PWA v2) */
const CACHE = 'wine-variety-v3';
const ASSETS = [
  './', './index.html', './app.js', './wines.js', './varieties.js',
  './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname.indexOf('open-meteo.com') >= 0) return;      // 날씨: 항상 네트워크
  if (url.hostname.indexOf('wikipedia.org') >= 0) return;       // 이미지: 항상 네트워크
  if (url.origin !== self.location.origin) return;              // 그 외 외부는 통과
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

/* 매일 12시 백그라운드 알림 (지원 기기: 설치된 PWA·안드로이드 Chrome 등) */
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'daily-variety') {
    e.waitUntil(self.registration.showNotification('🍇 오늘의 포도 품종', {
      body: '오늘의 품종이 준비됐어요. 탭해서 학습하고, 금요일엔 퀴즈로 복습하세요!',
      icon: 'icon-192.png', badge: 'icon-192.png', tag: 'daily-variety',
    }));
  }
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
