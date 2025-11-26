// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAD1k65QMjmbar0N78ako9o9zI8TcbQAgc",
  authDomain: "eldercare-companion-6d4ef.firebaseapp.com",
  projectId: "eldercare-companion-6d4ef",
  storageBucket: "eldercare-companion-6d4ef.firebasestorage.app",
  messagingSenderId: "642412075428",
  appId: "1:642412075428:web:719d07acbc1fa76ba0c931",
  measurementId: "G-2KYT49V9P0"
};

// VAPID Key（從 Firebase Console 的 Cloud Messaging 取得）
const vapidKey = "BNVdBNLwYovRVSWmdrzEubJVdyLxeUxodYkMg1mTboke-34vjS4Ud2-dH3XgTqY8qOw0rihx6WEHVc4OQA404wo";

// 匯出配置
window.firebaseConfig = firebaseConfig;
window.vapidKey = vapidKey;