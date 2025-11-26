// 引入 Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase 配置（與 firebase-config.js 相同）
const firebaseConfig = {
  apiKey: "AIzaSyAD1k65QMjmbar0N78ako9o9zI8TcbQAgc",
  authDomain: "eldercare-companion-6d4ef.firebaseapp.com",
  projectId: "eldercare-companion-6d4ef",
  storageBucket: "eldercare-companion-6d4ef.firebasestorage.app",
  messagingSenderId: "642412075428",
  appId: "1:642412075428:web:719d07acbc1fa76ba0c931",
  measurementId: "G-2KYT49V9P0"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

// 初始化 Messaging
const messaging = firebase.messaging();

// 監聽背景訊息
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || '💊 用藥提醒';
  const notificationOptions = {
    body: payload.notification?.body || '該服藥囉！',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'medication-reminder-' + (payload.data?.logId || Date.now()), // 每個提醒使用唯一 tag
    requireInteraction: true, // 需要用戶互動才會消失
    vibrate: [500, 200, 500, 200, 500], // 更強的震動模式
    silent: false, // 確保有聲音
    renotify: true, // 重複通知時再次提醒
    // 添加快速操作按鈕
    actions: [
      {
        action: 'taken',
        title: '✅ 已服用',
        icon: '/icons/check-icon.png'
      },
      {
        action: 'snooze',
        title: '⏰ 10分鐘後提醒',
        icon: '/icons/snooze-icon.png'
      },
      {
        action: 'skip',
        title: '❌ 跳過',
        icon: '/icons/skip-icon.png'
      }
    ],
    data: {
      ...payload.data,
      url: '/medications.html',
      timestamp: Date.now()
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 點擊通知時的處理
self.addEventListener('notificationclick', async (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data;

  console.log('[SW] Notification clicked:', { action, data });

  notification.close();

  // 根據不同的按鈕執行不同的操作
  if (action === 'taken') {
    // 檢查是否為測試通知
    if (data.type === 'test') {
      // 測試通知：只顯示成功訊息，不調用 API
      event.waitUntil(
        self.registration.showNotification('✅ 測試成功', {
          body: '快速操作按鈕運作正常！真實用藥時會自動標記為已服用。',
          tag: 'test-confirmation-success',
          requireInteraction: false,
          vibrate: [100, 50, 100]
        })
      );
    } else {
      // 真實用藥：調用 API 標記為已服用
      event.waitUntil(
        fetch(`https://eldercare-backend-8o4k.onrender.com/api/medication-logs/${data.logId}/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            confirmationMethod: 'notification',
            notes: '透過通知快速確認'
          })
        })
        .then(response => {
          console.log('[SW] 已標記為已服用');
          // 顯示成功訊息
          return self.registration.showNotification('✅ 已記錄', {
            body: '已標記為已服用',
            tag: 'confirmation-success',
            requireInteraction: false,
            vibrate: [100]
          });
        })
        .catch(error => {
          console.error('[SW] 標記失敗:', error);
          // 顯示錯誤訊息
          return self.registration.showNotification('❌ 標記失敗', {
            body: '請打開 App 手動標記',
            tag: 'confirmation-error',
            requireInteraction: false
          });
        })
      );
    }
  } else if (action === 'snooze') {
    // 延後 10 分鐘
    const isTest = data.type === 'test';
    const snoozeTime = isTest ? 10000 : (10 * 60 * 1000); // 測試模式：10 秒，正式：10 分鐘

    event.waitUntil(
      self.registration.showNotification('⏰ 已延後', {
        body: isTest ? '10 秒後將再次提醒（測試模式）' : '10 分鐘後將再次提醒',
        tag: 'snooze-confirmation',
        requireInteraction: false,
        vibrate: [100]
      })
      .then(() => {
        // 延後後重新顯示提醒
        return new Promise(resolve => {
          setTimeout(() => {
            self.registration.showNotification('💊 用藥提醒' + (isTest ? ' (測試)' : ''), {
              body: data.medicationName + ' - 請記得服藥',
              tag: 'medication-reminder-snooze-' + data.logId,
              requireInteraction: true,
              vibrate: [500, 200, 500],
              actions: [
                { action: 'taken', title: '✅ 已服用' },
                { action: 'skip', title: '❌ 跳過' }
              ],
              data: data
            });
            resolve();
          }, snoozeTime);
        });
      })
    );
  } else if (action === 'skip') {
    // 跳過此次用藥
    const isTest = data.type === 'test';
    event.waitUntil(
      self.registration.showNotification(isTest ? '✅ 測試成功' : 'ℹ️ 已跳過', {
        body: isTest ? '跳過按鈕運作正常！' : '此次用藥已跳過',
        tag: 'skip-confirmation',
        requireInteraction: false,
        vibrate: [100]
      })
    );
  } else {
    // 點擊通知主體，打開用藥管理頁面
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          // 檢查是否已有打開的窗口
          for (let client of windowClients) {
            if (client.url.includes('/medications.html') && 'focus' in client) {
              return client.focus();
            }
          }
          // 沒有打開的窗口，開啟新窗口
          if (clients.openWindow) {
            return clients.openWindow(data.url || '/medications.html');
          }
        })
    );
  }
});


