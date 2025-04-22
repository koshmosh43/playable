// service-worker.js
const CACHE_NAME = 'gin-rummy-cache-v1';
const ASSETS_TO_CACHE = [
  'https://github.com/koshmosh43/playable/tree/main/',
  'https://github.com/koshmosh43/playable/tree/main/index.html',
  'https://github.com/koshmosh43/playable/tree/main/game.js',
  'https://github.com/koshmosh43/playable/tree/main/manifest.json',
  'https://koshmosh43.github.io/playable/assets/CardBack_Blue.webp',
  'https://koshmosh43.github.io/playable/assets/background.webp',
  'https://koshmosh43.github.io/playable/assets/blue_avatar.webp',
  'https://koshmosh43.github.io/playable/assets/red_avatar.webp',
  'https://koshmosh43.github.io/playable/assets/Top_navigation.webp',
  'https://koshmosh43.github.io/playable/assets/TopBanner.webp',
  'https://koshmosh43.github.io/playable/assets/settingsButton.webp',
  'https://koshmosh43.github.io/playable/assets/newGameButton.webp',
  'https://koshmosh43.github.io/playable/assets/logo_192.webp', 
  'https://koshmosh43.github.io/playable/assets/logo_512.webp',
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
