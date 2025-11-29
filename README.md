# ElderCare Companion - 長者照護系統

> AI 驅動的智慧長輩陪伴系統 - 整合對話陪伴、用藥管理、心靈照護、位置追蹤的全方位照護平台

**線上展示**: https://08-eldercare.vercel.app/

## 快速導航

- 📖 **[完整文檔](docs/README_MAIN.md)** - 專案完整說明與功能介紹
- 📚 **[文檔中心](docs/README.md)** - 所有文檔索引與導航
- 🚀 **[部署指南](docs/deployment-guide.md)** - 完整部署步驟
- 🔧 **[後端指南](docs/backend-guide.md)** - 後端開發指南
- 🗄️ **[資料庫 Schema](database/supabase_complete_schema_with_auth_v4.sql)** - 完整資料庫結構

## 核心功能

- 🤖 **AI 對話陪伴** - 自然語言對話、語音互動、情緒感知
- 💊 **用藥提醒系統** - 智慧提醒、服藥記錄、統計分析
- 🙏 **心靈照護模組** - Agentic RAG、心情日記、趨勢分析
- 📍 **地理位置追蹤** - 安全區域、位置記錄、地理圍欄警示
- 📸 **圖片上傳功能** - 藥物拍照、心情日記配圖
- 👨‍👩‍👧 **家屬監控面板** - 遠端關心長輩狀況、即時接收通知

## 專案結構

```
eldercare-app/
├── frontend/          # 前端程式碼 (Capacitor + Web)
├── backend/           # 後端程式碼 (Node.js + Express)
├── database/          # 資料庫 Schema
│   └── supabase_complete_schema_with_auth_v4.sql (唯一主要 SQL 文件)
├── docs/              # 所有文檔
└── docs_delete/       # 已棄用檔案（可安全刪除）
```

## 快速開始

```bash
# 1. 安裝後端依賴
cd backend && npm install

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env 填入您的 API keys

# 3. 初始化資料庫
# 在 Supabase 執行: database/supabase_complete_schema_with_auth_v4.sql

# 4. 啟動後端服務
npm run dev

# 5. 啟動前端（開發環境）
cd frontend
npm install
npm run dev
```

## 技術架構

### 前端
- Capacitor (跨平台)
- Vanilla JavaScript
- Chart.js (圖表)
- PWA 支援

### 後端
- Node.js 18+
- Express.js
- Google Gemini 2.0 + OpenAI GPT-4
- Node-cron (排程)
- Firebase Admin SDK (推送通知)

### 資料庫
- Supabase (PostgreSQL 15+)
- Row Level Security (RLS)
- Realtime 同步

## 部署方案

- **前端**: Vercel (自動部署)
- **後端**: Render (免費方案)
- **資料庫**: Supabase (免費方案)

詳細部署步驟請參閱 [部署指南](docs/deployment-guide.md)

## 文檔資源

### 核心文檔
- [完整專案說明](docs/README_MAIN.md)
- [部署指南](docs/deployment-guide.md)
- [後端開發指南](docs/backend-guide.md)
- [資料庫架構指南](docs/database-schema-guide.md)

### 功能模組文檔
- [用藥提醒設定](docs/medication-setup.md)
- [短期用藥指南](docs/HOW_TO_ADD_SHORT_TERM_MEDICATION.md)
- [心靈照護快速開始](docs/spiritual-care-quickstart.md)
- [地理位置功能](docs/GEOLOCATION_IMPLEMENTATION.md)
- [圖片上傳功能](docs/IMAGE_UPLOAD_IMPLEMENTATION.md)
- [Firebase 設定](docs/firebase-setup.md)

### Android App
- [Android 構建指南](docs/ANDROID_BUILD_GUIDE.md)
- [APK 下載設定](docs/UPDATE_APK_DOWNLOAD.md)

## 版本資訊

**當前版本**: v5.0 (2025-11-29)

**最新更新**:
- ✨ 短期用藥功能（次數控制、進度追蹤）
- ✨ 圖片上傳系統（藥物拍照、心情日記配圖）
- ✨ 地理位置追蹤（安全區域、位置記錄、警示通知）
- 🔧 整合所有 SQL 到單一 Schema 文件
- 📚 重組文檔結構，提升維護性

## 授權

MIT License

---

**用 ❤️ 打造，為長輩照護而生**

完整文檔請參閱: [docs/README_MAIN.md](docs/README_MAIN.md)
