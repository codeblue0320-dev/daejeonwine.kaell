/* 오프라인 캐싱 서비스워커 — GitHub Pages PWA
 * 앱 껍데기(HTML/JS/데이터/아이콘)는 캐시-우선으로 오프라인 지원.
 * 날씨 API 등 그 외 요청은 항상 네트워크. */
const CACHE = 'jayang-wine-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './wines.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 날씨 API 는 캐시하지 않음(항상 최신)
  if (url.hostname.includes('open-meteo.com')) return;
  // 같은 출처의 정적 파일만 캐시-우선 처리
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
