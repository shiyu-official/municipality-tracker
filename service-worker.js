/**
 * Service Worker for 市区町村トラッカー
 *
 * キャッシュ戦略:
 * - index.html, manifest.json, アイコン類: Cache First（初回ロード後は即座に応答）
 *   → ただし Service Worker 自体の更新時に古いキャッシュを破棄することで更新反映
 * - data/配下のJSON/GeoJSON/TopoJSON: Network First（常に最新を取得、失敗時のみキャッシュ）
 * - Google Maps API、外部CDN等: SWではスルー（ブラウザのHTTPキャッシュに任せる）
 *
 * 更新方法:
 * - コードを更新したら CACHE_VERSION を上げる（v1 → v2 など）
 * - 次回アクセス時に新しい SW がインストールされ、旧キャッシュが削除される
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `toha-map-${CACHE_VERSION}`;

// アプリシェル（最初のロードで確実にキャッシュする主要ファイル）
// これらは Cache First で配信する
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// このパターンに一致するリクエストは Network First（データは常に最新を優先）
function isDataRequest(url) {
  return /\/data\/.*\.(json|geojson|topojson)$/i.test(url.pathname);
}

// このパターンに一致するものは SW でキャッシュしない（素通し）
function isBypassRequest(url) {
  return (
    url.origin !== self.location.origin ||          // 外部ドメイン全般（Google Maps、フォントなど）
    url.pathname.endsWith('robots.txt')
  );
}

// インストール時: アプリシェルを事前キャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 個々のファイルを個別 add で入れる（1つ失敗しても他は入る）
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] precache failed:', url, err);
          })
        )
      );
    })
  );
  // 新しい SW を即座にアクティブにする（古い SW を待たない）
  self.skipWaiting();
});

// アクティベート時: 古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('toha-map-') && k !== CACHE_NAME)
            .map((k) => {
              console.log('[SW] deleting old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim()) // 既存タブも即新SW管理下に
  );
});

// fetchイベント: リクエストに応じてキャッシュ戦略を分岐
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET以外はスルー
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 外部ドメインや無関係なリクエストはスルー
  if (isBypassRequest(url)) return;

  // データファイル: Network First
  if (isDataRequest(url)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // その他（HTMLやアイコンなど）: Cache First
  event.respondWith(cacheFirst(req));
});

// Cache First: キャッシュ優先、なければネットワーク
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    // バックグラウンドで更新チェック（次回アクセスで新しいのが使える）
    fetch(request)
      .then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
      })
      .catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    // オフラインでキャッシュにもない場合
    return new Response('Offline and not cached', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First: ネットワーク優先、失敗時のみキャッシュ
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] network failed, using cache:', request.url);
      return cached;
    }
    throw err;
  }
}

// クライアントからメッセージを受けてキャッシュをクリアする仕組み
// （将来のデバッグ用。index.html側から navigator.serviceWorker.controller.postMessage({type:'CLEAR_CACHE'}) で呼べる）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
