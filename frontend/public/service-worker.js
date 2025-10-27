// ElderCare Companion - Service Worker
// 版本: 2.1.0
// 功能: 離線支援、快取策略、背景同步

const CACHE_NAME = 'eldercare-v2.1.0-20251027';
const RUNTIME_CACHE = 'eldercare-runtime-v2.1.0-20251027';

// 需要快取的靜態資源
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/register.html',
  '/onboarding.html',
  '/index.html',
  '/mobile-debug.html',
  '/styles.css',
  '/mobile.css',
  '/app.js',
  '/device-detector.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Service Worker 安裝
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Service Worker 啟用
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name !== CACHE_NAME && name !== RUNTIME_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch 事件 - 快取策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳過非 GET 請求
  if (request.method !== 'GET') {
    return;
  }

  // 跳過 Supabase API 請求（總是使用網路）
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Network error, please check your connection' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 跳過 OpenAI API 請求
  if (url.hostname.includes('openai.com') || url.hostname.includes('api.openai.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML 頁面 - Network First (網路優先，快取備用)
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 將成功的回應存入快取
          // 只快取 HTTP/HTTPS 請求，排除 chrome-extension 等協議
          if (request.url.startsWith('http')) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 網路失敗，使用快取
          return caches.match(request);
        })
    );
    return;
  }

  // 靜態資源 - Cache First (快取優先，快取缺失則網路)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // 只快取成功的回應
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // 只快取 HTTP/HTTPS 請求，排除 chrome-extension 等協議
          if (request.url.startsWith('http')) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }

          return response;
        });
      })
  );
});

// 背景同步（未來可用於離線訊息同步）
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // 未來實作：同步離線時發送的訊息
  console.log('[SW] Syncing offline messages...');

  try {
    // 從 IndexedDB 取得離線訊息
    // 發送到後端
    // 清除已同步的訊息
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error;
  }
}

// Push 通知（未來可用於即時通知）
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const options = {
    body: event.data ? event.data.text() : 'You have a new message',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: '查看',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: '關閉',
        icon: '/icons/icon-96x96.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('ElderCare Companion', options)
  );
});

// 通知點擊
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/index.html')
    );
  }
});

// 訊息監聽（從主應用發送訊息給 SW）
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.payload;
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(urlsToCache);
      })
    );
  }
});
