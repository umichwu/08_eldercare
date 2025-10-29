# 🏥 ElderCare Companion System - 長輩陪伴系統

一個專為老年人設計的 AI 陪伴聊天系統，具備大字體、高對比、語音互動等友善功能。

## ✨ 主要特色

### 🎯 老年人友善設計
- **超大字體**：預設 24px 字體，易於閱讀
- **高對比色彩**：黑白分明，減少眼睛疲勞
- **簡潔介面**：去除複雜功能，專注核心對話
- **語音互動**：支援語音輸入和語音播放回應

### 🤖 智能對話功能
- **AI 陪伴**：使用 OpenAI GPT-4o-mini 提供溫暖對話
- **自動總結**：每 20 則訊息自動產生對話摘要
- **對話記憶**：完整保存對話歷史
- **情境感知**：理解老年人的需求和情緒

### 🆘 安全與關懷
- **SOS 緊急按鈕**：一鍵通知家人
- **健康關注**：AI 會關注使用者提到的健康議題
- **用藥提醒**：（規劃中）定時用藥提醒功能
- **家人 Dashboard**：（規劃中）讓家人了解長輩狀況

## 🏗️ 技術架構

### 後端技術
- **Node.js + Express**：REST API 服務
- **Supabase**：資料庫和使用者認證
- **OpenAI API**：AI 對話和總結生成
- **PostgreSQL**：關聯式資料庫

### 前端技術
- **純 HTML/CSS/JavaScript**：無框架，輕量快速
- **Web Speech API**：語音辨識和語音合成
- **響應式設計**：支援桌機、平板、手機

### 資料庫設計
```
- conversations（對話表）
- messages（訊息表）
- conversation_summaries（對話總結表）
- user_memory（使用者記憶表）
- messages_attachments（附件表）
```

## 📦 安裝說明

### 1. 前置需求
- Node.js 18+
- npm 或 yarn
- Supabase 帳號
- OpenAI API 金鑰（可選）

### 2. Clone 專案
```bash
cd eldercare-app
```

### 3. 設定環境變數
```bash
# 複製環境變數範本
cp .env.example .env

# 編輯 .env 檔案，填入您的 Supabase 和 OpenAI 資訊
```

必要的環境變數：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
# ⚠️ 注意：已從 SUPABASE_SERVICE_KEY 改名為 SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-key
```

> 📘 **重要更新**：環境變數已統一命名，詳見 [環境變數統一說明](docs/環境變數統一說明.md)

### 4. 安裝後端依賴
```bash
cd backend
npm install
```

### 5. 啟動後端服務
```bash
# 開發模式（自動重啟）
npm run dev

# 或正式模式
npm start
```

後端會在 http://localhost:3000 啟動

### 6. 啟動前端服務
開啟新的終端機視窗：
```bash
cd frontend/public

# 使用 Python 啟動簡單 HTTP 伺服器
python3 -m http.server 8080

# 或使用其他方式
# npx serve .
# npx http-server .
```

前端會在 http://localhost:8080 啟動

### 7. 測試資料庫連接
```bash
# 在瀏覽器打開
http://localhost:3000/api/health
```

應該會看到：
```json
{
  "status": "healthy",
  "timestamp": "2025-10-21T...",
  "service": "ElderCare Backend API"
}
```

## 🚀 快速開始

### 建立測試使用者
在 Supabase Dashboard 的 SQL Editor 執行：
```sql
-- 建立測試使用者（使用 Supabase Auth）
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);
```

### 開始使用
1. 打開瀏覽器前往 http://localhost:8080
2. 點選「新對話」開始聊天
3. 輸入訊息或點選快捷按鈕
4. 試試語音輸入功能（需要麥克風權限）
5. 每 20 則訊息會自動產生總結

## 📚 API 文件

### 對話 API

#### 建立新對話
```http
POST /api/conversations
Content-Type: application/json

{
  "userId": "uuid",
  "title": "新對話",
  "channel": "web"
}
```

#### 取得對話列表
```http
GET /api/conversations?userId={uuid}
```

#### 取得單一對話
```http
GET /api/conversations/{id}?userId={uuid}
```

### 訊息 API

#### 取得對話訊息
```http
GET /api/conversations/{id}/messages?userId={uuid}
```

#### 傳送訊息（會自動觸發 AI 回應）
```http
POST /api/conversations/{id}/messages
Content-Type: application/json

{
  "userId": "uuid",
  "content": "你好"
}

回應：
{
  "userMessage": { ... },
  "assistantMessage": { ... }
}
```

### 總結 API

#### 取得最新總結
```http
GET /api/conversations/{id}/summaries/latest?userId={uuid}
```

#### 手動產生總結
```http
POST /api/conversations/{id}/summaries
Content-Type: application/json

{
  "userId": "uuid"
}
```

## 🎨 客製化設定

### 調整字體大小
編輯 `frontend/public/styles.css`：
```css
:root {
  --font-size-md: 28px;  /* 預設是 24px */
  --font-size-lg: 32px;
}
```

### 調整自動總結頻率
編輯 `.env`：
```env
AUTO_SUMMARY_THRESHOLD=15  # 預設是 20
```

### 更換 AI 模型
編輯 `.env`：
```env
OPENAI_MODEL=gpt-4  # 預設是 gpt-4o-mini
```

## 🔧 故障排除

### 後端無法啟動
1. 檢查 `.env` 檔案是否存在且設定正確
2. 確認 Node.js 版本 >= 18
3. 執行 `npm install` 重新安裝依賴

### 前端無法連接後端
1. 確認後端服務已啟動（http://localhost:3000）
2. 檢查 `frontend/public/app.js` 中的 `API_BASE_URL`
3. 檢查瀏覽器 Console 是否有 CORS 錯誤

### 語音功能無法使用
1. 確認使用的是 Chrome 或 Edge 瀏覽器
2. 確認已授予麥克風權限
3. 確認使用 HTTPS 或 localhost

### AI 無法回應
1. 檢查 OpenAI API Key 是否正確
2. 檢查 API 額度是否足夠
3. 查看後端 Console 的錯誤訊息

## 📁 專案結構

```
eldercare-app/
├── backend/                 # 後端服務
│   ├── config/             # 配置檔案
│   │   ├── supabase.js    # Supabase 連接
│   │   └── openai.js      # OpenAI 設定
│   ├── services/           # 業務邏輯
│   │   ├── conversationService.js
│   │   ├── messageService.js
│   │   └── summaryService.js
│   ├── routes/             # API 路由
│   │   └── api.js
│   ├── server.js           # 主程式
│   └── package.json
├── frontend/               # 前端頁面
│   └── public/
│       ├── index.html     # 主頁面
│       ├── styles.css     # 樣式表
│       └── app.js         # JavaScript
├── docs/                  # 文件
├── .env                   # 環境變數（不提交到 Git）
├── .env.example           # 環境變數範本
└── README.md              # 本文件
```

## 🛣️ 開發路線圖

### 已完成 ✅
- [x] Supabase 資料庫整合
- [x] OpenAI API 整合
- [x] 對話管理功能
- [x] 訊息收發功能
- [x] 自動總結機制
- [x] 語音輸入輸出
- [x] 老年人友善 UI

### 進行中 🚧
- [ ] 使用者認證系統
- [ ] SOS 緊急通知功能（需整合簡訊/Email API）
- [ ] 用藥提醒功能

### 規劃中 📋
- [ ] 家人 Dashboard
- [ ] 健康數據記錄
- [ ] 圖片/影片分享功能
- [ ] 離線支援
- [ ] 行動裝置 App（React Native）

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

## 👥 聯絡資訊

如有問題或建議，歡迎聯絡：
- Email: your-email@example.com
- GitHub: https://github.com/your-username

---

**用心陪伴每一位長輩 ❤️**
