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

  const notificationTitle = payload.notification?.title || '用藥提醒';
  const notificationOptions = {
    body: payload.notification?.body || '該服藥囉！',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'medication-reminder',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 點擊通知時的處理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/medications.html')
  );
});


