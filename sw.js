// キャッシュするファイルの名前とバージョンを定義
const CACHE_NAME = 'interval-timer-cache-v2';

// キャッシュするファイルのリスト
const urlsToCache = [
  '/WebIntervalTimer/',
  '/WebIntervalTimer/index.html',
  '/WebIntervalTimer/style.css',
  '/WebIntervalTimer/script.js',
  '/WebIntervalTimer/manifest.json',
  '/WebIntervalTimer/icon-512x512.png',
  '/WebIntervalTimer/icon-192x192.png',
];

// 1. installイベント: サービスワーカーがインストールされるときに実行
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache); // ファイルをキャッシュに追加
      })
  );
});

// 2. fetchイベント: ページがリソースを要求するたびに実行
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // キャッシュにレスポンスがあればそれを返す
        if (cachedResponse) {
          return cachedResponse;
        }

        // キャッシュになければネットワークから取得しに行く
        return fetch(event.request).then(
          (networkResponse) => {
            // httpから始まるリクエストのみキャッシュするようにチェック
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              event.request.url.startsWith('http')
            ) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          }
        ).catch(error => {
          console.error('Fetching failed:', error);
          throw error;
        });
      })
  );
});

// 3. activateイベント: 新しいサービスワーカーが有効になったときに実行
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]; // 有効にするキャッシュ名
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // ホワイトリストに含まれていないキャッシュ（=古いキャッシュ）を削除
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
