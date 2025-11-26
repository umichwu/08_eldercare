// backend/config/firebase.js

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化 Firebase Admin SDK
try {
  let serviceAccount;

  // 優先從環境變數讀取 (用於 Render 等雲端平台)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.log('📝 從環境變數載入 Firebase Service Account Key');
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }
  // 本地開發使用檔案
  else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, '../../firebase-service-account.json');

    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('⚠️  Firebase Service Account Key 檔案不存在:', serviceAccountPath);
      console.warn('   推播通知功能將無法使用');
      serviceAccount = null;
    } else {
      console.log('📝 從檔案載入 Firebase Service Account Key:', serviceAccountPath);
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('✅ Firebase Admin SDK 初始化成功');
  }
} catch (error) {
  console.error('❌ Firebase Admin SDK 初始化失敗:', error.message);
}

export default admin;