/**
 * サービスワーカー（アプリの裏で動く小さなプログラム）
 *
 * 役割: アプリのファイルを端末に保存（キャッシュ）しておき、
 *       電波がないときでもアプリを開けるようにする。
 *
 *   ネットにつながる → サーバーから最新のファイルを取って表示し、保存分も新しくする
 *   ネットにつながらない → 保存しておいたファイルで表示する
 *
 * このファイルは index.html から登録される。
 */
// 保存場所（キャッシュ）の名前。アプリを更新したら番号を1つ上げると、
// 古い保存分が消えて、新しいファイルが iPhone などに届く
const CACHE_NAME = "it-passport-cache-v15";
// オフラインでも使えるよう保存しておくファイルの一覧。
// 問題データや画像を追加したら、ここにも書き足す
const CACHE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./data/questions-base.js",
  "./data/questions-sample.js",
  "./data/questions-r07.js",
  "./data/questions-r06.js",
  "./data/questions-r06-technology.js",
  "./data/questions-r06-technology-2.js",
  "./data/questions-r05.js",
  "./data/glossary.js",
  "./assets/images/r06/q41-arrow-diagram.png",
  "./assets/images/r06/q60-rdb-diagram.png",
  "./assets/images/r06/q67-reliability-diagram.png",
  "./assets/images/r05/q33-inventory-table.png",
  "./assets/images/r05/q41-arrow-diagram.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png"
];

// install（はじめて登録されたとき・新しい版になったとき）:
// 上の一覧のファイルをまとめて保存する。skipWaiting() で新しい版をすぐ使い始める
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_ASSETS))
  );
  self.skipWaiting();
});

// activate（新しい版が動き始めたとき）:
// 名前が今の CACHE_NAME と違う、古い保存分を消す。clients.claim() で開いている画面もすぐ切り替える
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
