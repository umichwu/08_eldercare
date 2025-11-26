
let messaging = null;

// 初始化 FCM
async function initFCM() {
  try {
    // 檢查瀏覽器支援
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('❌ 此瀏覽器不支援推播通知');
      return false;
    }

    // 引入 Firebase SDK
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

    // 初始化 Firebase
    const app = initializeApp(window.firebaseConfig);
    messaging = getMessaging(app);

    console.log('✅ Firebase Messaging 初始化成功');
    return true;
  } catch (error) {
    console.error('❌ Firebase Messaging 初始化失敗:', error);
    return false;
  }
}

// 請求通知權限並取得 FCM Token
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.warn('⚠️ 使用者拒絕通知權限');
      return null;
    }

    console.log('✅ 通知權限已授予');

    // 註冊 Service Worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Service Worker 註冊成功');

    // 取得 FCM Token
    const { getToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

    const token = await getToken(messaging, {
      vapidKey: window.vapidKey,
      serviceWorkerRegistration: registration
    });

    console.log('✅ FCM Token 取得成功:', token);
    return token;

  } catch (error) {
    console.error('❌ 取得 FCM Token 失敗:', error);
    return null;
  }
}

// 監聽前景訊息
async function listenToMessages(callback) {
  if (!messaging) {
    console.error('❌ Firebase Messaging 未初始化');
    return;
  }

  const { onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

  onMessage(messaging, (payload) => {
    console.log('📩 收到前景訊息:', payload);

    // 顯示通知
    new Notification(payload.notification?.title || '用藥提醒', {
      body: payload.notification?.body || '該服藥囉！',
      icon: '/icons/icon-192x192.png',
      tag: 'medication-reminder',
      requireInteraction: true
    });

    if (callback) callback(payload);
  });
}

// 匯出函數
window.FCM = {
  init: initFCM,
  requestPermission: requestNotificationPermission,
  listenToMessages: listenToMessages
};