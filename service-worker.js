// service-worker.js
const CACHE_NAME = 'gin-rummy-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/game.js',
  '/manifest.json',
  '/assets/CardBack_Blue.webp',
  '/assets/background.webp',
  '/assets/blue_avatar.webp',
  '/assets/red_avatar.webp',
  '/assets/Top_navigation.webp',
  '/assets/TopBanner.webp',
  '/assets/settingsButton.webp',
  '/assets/newGameButton.webp',
  '/assets/logo_192.webp',  // если конвертировала и их тоже
  '/assets/logo_512.webp',
  'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/PixiPlugin.min.js'
];


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(error => console.error('Cache installation failed:', error))
  );
});

self.addEventListener('activate', event => {
  const cacheAllowlist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (!cacheAllowlist.includes(cacheName)) return caches.delete(cacheName);
      })
    ))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request)
        .then(res => {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          const resToCache = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resToCache));
          return res;
        })
        .catch(error => console.error('Fetch failed:', error))
      )
  );
});
