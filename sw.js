const CACHE_NAME = "it-passport-cache-v6";
const CACHE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./data/questions-base.js",
  "./data/questions-sample.js",
  "./data/questions-r06.js",
  "./data/questions-r06-technology.js",
  "./data/questions-r06-technology-2.js",
  "./data/questions-r05.js",
  "./assets/images/r06/q41-arrow-diagram.png",
  "./assets/images/r06/q60-rdb-diagram.png",
  "./assets/images/r06/q67-reliability-diagram.png",
  "./assets/images/r05/q33-inventory-table.png",
  "./assets/images/r05/q41-arrow-diagram.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ネットワーク優先。取得できた場合はキャッシュも更新し、オフライン時のみキャッシュを使う。
// no-cacheはブラウザのHTTPキャッシュを必ずサーバーに問い合わせ直させる指定で、
// これがないと更新したファイルが古いまま返ることがある(内容が同じなら304で済むので転送量は増えない)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
