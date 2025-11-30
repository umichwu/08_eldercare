import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import medicationRouter from './routes/medicationApi.js';
import spiritualCareRouter from './routes/spiritualCareApi.js';
import googleCalendarRouter from './routes/googleCalendarApi.js';
import socialRouter from './routes/socialApi.js';
import geolocationRouter from './routes/geolocationApi.js';
import alertsRouter from './routes/alertsApi.js';
import './config/firebase.js'; // 初始化 Firebase Admin SDK
import { startMedicationScheduler } from './services/medicationScheduler.js';

// 取得當前檔案的目錄（ES Module 需要）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數
// 在本地開發：從根目錄的 .env 載入
// 在 Render：環境變數已經在 Dashboard 設定，dotenv.config() 不會覆蓋現有變數
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
} else {
  // 生產環境：環境變數應該由平台提供（Render Dashboard）
  dotenv.config(); // 嘗試載入，但不強制要求檔案存在
}

// Firebase Admin SDK 已在 config/firebase.js 中初始化

const app = express();
// Render 使用 PORT 環境變數，本地開發可使用 APP_PORT
const PORT = process.env.PORT || process.env.APP_PORT || 3000;
const HOST = process.env.HOST || process.env.APP_HOST || '0.0.0.0';

// CORS 設定 - 支援本地開發和生產環境
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'https://08-eldercare.vercel.app',
      process.env.FRONTEND_URL, // 額外的前端 URL
    ].filter(Boolean);

    // 允許沒有 origin 的請求（例如 mobile apps, Postman）
    if (!origin) {
      console.log('✅ CORS: 允許無 origin 請求');
      return callback(null, true);
    }

    // 檢查是否為允許的來源
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✅ CORS: 允許來源 ${origin}`);
      callback(null, true);
    } else if (origin.endsWith('.vercel.app')) {
      console.log(`✅ CORS: 允許 Vercel 來源 ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: 拒絕來源 ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// 中間件
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 請求日誌
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API 路由
app.use('/api', apiRouter);
app.use('/api', medicationRouter);
app.use('/api/spiritual', spiritualCareRouter);
app.use('/api/google-calendar', googleCalendarRouter);
app.use('/api/social', socialRouter);
app.use('/api/geolocation', geolocationRouter);
app.use('/api/alerts', alertsRouter);

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: '歡迎使用 ElderCare Companion System API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      conversations: '/api/conversations',
      messages: '/api/conversations/:id/messages',
      summaries: '/api/conversations/:id/summaries',
      medications: '/api/medications',
      medicationReminders: '/api/medication-reminders',
      medicationLogs: '/api/medication-logs',
      fcmRegister: '/api/fcm/register',
      schedulerCheck: '/api/scheduler/check-reminders',
      social: {
        friends: '/api/social/friends',
        friendRequests: '/api/social/friends/requests',
        friendSearch: '/api/social/friends/search',
        posts: '/api/social/posts',
        timeline: '/api/social/posts/timeline',
        notifications: '/api/social/notifications'
      }
    }
  });
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({ error: '找不到此路徑' });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('伺服器錯誤:', err);
  res.status(500).json({
    error: '伺服器內部錯誤',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 啟動伺服器
app.listen(PORT, HOST, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('🏥 ElderCare Companion System - Backend API');
  console.log('='.repeat(60));
  console.log('');
  console.log(`✅ 伺服器運行中: http://${HOST}:${PORT}`);
  console.log(`📡 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? '已配置' : '未配置'}`);
  console.log(`🔔 Firebase: ${process.env.FIREBASE_PROJECT_ID ? '已配置' : '未配置'}`);
  console.log('');
  console.log('可用端點:');
  console.log(`   GET  /api/health                              - 健康檢查`);
  console.log(`   POST /api/conversations                       - 建立對話`);
  console.log(`   GET  /api/conversations                       - 取得對話列表`);
  console.log(`   GET  /api/conversations/:id/messages          - 取得訊息`);
  console.log(`   POST /api/conversations/:id/messages          - 傳送訊息`);
  console.log(`   GET  /api/conversations/:id/summaries/latest  - 取得最新總結`);
  console.log('');
  console.log('用藥管理端點:');
  console.log(`   POST /api/medications                         - 建立藥物`);
  console.log(`   GET  /api/medications/elder/:elderId          - 取得長輩藥物`);
  console.log(`   PUT  /api/medications/:id                     - 更新藥物`);
  console.log(`   DEL  /api/medications/:id                     - 刪除藥物`);
  console.log(`   POST /api/medication-reminders                - 建立提醒`);
  console.log(`   GET  /api/medication-reminders/elder/:id      - 取得提醒`);
  console.log(`   POST /api/medication-logs/:id/confirm         - 確認服藥`);
  console.log(`   GET  /api/medication-logs/pending             - 待處理記錄`);
  console.log(`   GET  /api/medication-logs/statistics/:id      - 用藥統計`);
  console.log(`   POST /api/fcm/register                        - 註冊 FCM Token`);
  console.log(`   POST /api/scheduler/check-reminders           - 手動檢查提醒`);
  console.log('');
  console.log('社交功能端點:');
  console.log(`   GET  /api/social/friends                      - 取得好友列表`);
  console.log(`   GET  /api/social/friends/requests             - 取得好友邀請`);
  console.log(`   POST /api/social/friends/search               - 搜尋使用者`);
  console.log(`   POST /api/social/friends/request              - 發送好友邀請`);
  console.log(`   POST /api/social/friends/accept               - 接受好友邀請`);
  console.log(`   POST /api/social/friends/reject               - 拒絕好友邀請`);
  console.log(`   GET  /api/social/posts/timeline               - 取得動態時間軸`);
  console.log(`   POST /api/social/posts                        - 發布動態`);
  console.log(`   GET  /api/social/notifications                - 取得通知`);
  console.log('');
  console.log('地理位置端點:');
  console.log(`   GET  /api/geolocation/safe-zones/elder/:id    - 取得安全區域`);
  console.log(`   POST /api/geolocation/safe-zones              - 建立安全區域`);
  console.log(`   GET  /api/geolocation/location/latest/:id     - 取得最新位置`);
  console.log(`   GET  /api/geolocation/location/elder/:id      - 取得位置歷史`);
  console.log(`   GET  /api/geolocation/alerts/elder/:id        - 取得警示記錄`);
  console.log(`   POST /api/geolocation/alerts/sos              - 緊急求助`);
  console.log('');
  console.log('='.repeat(60));
  console.log('');

  // 啟動用藥提醒排程器
  try {
    startMedicationScheduler();
  } catch (error) {
    console.error('❌ 啟動排程器失敗:', error.message);
  }
});

export default app;
