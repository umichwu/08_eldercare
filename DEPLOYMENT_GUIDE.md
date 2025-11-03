# 🚀 ElderCare App 部署指南

## 架構說明

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Vercel    │ ───> │ Render.com   │ ───> │  Supabase    │
│  (Frontend) │      │  (Backend)   │      │  (Database)  │
└─────────────┘      └──────────────┘      └──────────────┘
```

---

## 📦 部署前準備

### 1. 選擇 LLM 提供商 🤖

本系統支援三種 AI 模型提供商，**至少需要配置一個**：

| 提供商 | 推薦度 | 免費額度 | API Key 格式 | 備註 |
|--------|--------|----------|--------------|------|
| **Google Gemini** | ⭐⭐⭐⭐⭐ | 每分鐘 60 次請求 | `AIza...` | **推薦！** 免費額度充足，無需儲值 |
| **OpenAI ChatGPT** | ⭐⭐⭐⭐ | 需儲值 $5 | `sk-...` | 回應品質佳，但需付費 |
| **Deepseek** | ⭐⭐⭐ | 需儲值 | `sk-...` | 中國開發，價格便宜 |

**推薦配置**：
- **免費使用**：使用 **Gemini**（無需儲值，免費額度充足）
- **付費使用**：使用 **OpenAI**（回應品質最佳）
- **預算有限**：使用 **Deepseek**（價格最便宜）

**多模型支援**：
- 可以同時配置多個 LLM 提供商
- 用戶可以在設定頁面自由切換
- 系統預設使用 `LLM_PROVIDER` 環境變數指定的提供商

---

### 2. 確認環境變數

在 `.env` 檔案中確認以下變數：

```env
# Supabase
SUPABASE_URL=https://oatdjdelzybcacwqafkk.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# LLM Configuration
LLM_PROVIDER=gemini  # 可選: openai, gemini, deepseek

# Google Gemini (推薦，默認)
GEMINI_API_KEY=your_gemini_api_key

# OpenAI (選用)
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini

# Deepseek (選用)
DEEPSEEK_API_KEY=your_deepseek_key

# Server
PORT=3000
```

### 3. 確認資料庫 Migration

在 Supabase Dashboard 執行：
- `database/migrations/001_fix_summary_fields.sql`
- `database/migrations/002_add_single_conversation_summary.sql`
- `database/migrations/003_add_quick_action_features.sql`

---

## 🌐 部署步驟

### Step 1: 建立 GitHub Repository

```bash
cd /mnt/d/2022_After/Gilbert/_Code/_Claude_Code/08_make2real/eldercare-app

# 初始化 Git
git init

# 新增所有檔案
git add .

# 建立第一個 commit
git commit -m "Initial commit: ElderCare Companion System"

# 連結遠端 repo（請替換成您的 GitHub username）
git remote add origin https://github.com/YOUR_USERNAME/eldercare-app.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

---

### Step 2: 部署 Backend 到 Render.com

#### 2.1 建立帳號
1. 前往 [render.com](https://render.com)
2. 點擊右上角 **"Get Started"** 或 **"Sign Up"**
3. 選擇 **"Sign up with GitHub"**（建議）
4. 授權 Render 訪問你的 GitHub repositories

#### 2.2 建立 Web Service

**步驟 1：選擇 Repository**
1. 在 Render Dashboard，點擊右上角 **"New +"**
2. 選擇 **"Web Service"**
3. 如果是第一次使用，點擊 **"Connect account"** 連結 GitHub
4. 找到並選擇你的 repository（例如：`umichwu/08_eldercare`）
5. 點擊 **"Connect"**

**步驟 2：配置 Service**

填寫以下設定：

| 設定項目 | 值 | 說明 |
|---------|-----|------|
| **Name** | `eldercare-backend` | Service 名稱（會影響 URL） |
| **Region** | `Singapore (Southeast Asia)` | 選擇離台灣最近的區域 |
| **Branch** | `main` | 要部署的分支 |
| **Root Directory** | `backend` | **重要！** 設定為 backend 資料夾 |
| **Runtime** | `Node` | 自動偵測 |
| **Build Command** | `npm install` 或留空 | 安裝依賴（Render 會自動執行）|
| **Start Command** | `node server.js` | 啟動指令 |
| **Instance Type** | `Free` | 免費方案 |

**步驟 3：高級設定（Advanced）**

點擊 **"Advanced"** 展開進階設定：

1. **Auto-Deploy**: ✅ 保持開啟（當 GitHub 有新 commit 時自動部署）
2. **Health Check Path**: `/api/health`（可選，但建議設定）

#### 2.3 設定環境變數 ⚠️ 重要！

**在點擊 "Create Web Service" 之前**，向下滾動到 **"Environment Variables"** 區塊：

點擊 **"Add Environment Variable"** 並逐一添加以下變數：

| Key | Value | 備註 |
|-----|-------|------|
| `NODE_ENV` | `production` | 環境設定 |
| `APP_PORT` | `3000` | 或使用 Render 提供的 PORT |
| `APP_HOST` | `0.0.0.0` | 允許外部訪問 |
| `SUPABASE_URL` | `https://oatdjdelzybcacwqafkk.supabase.co` | 你的 Supabase URL |
| `SUPABASE_ANON_KEY` | `eyJhbGci...` | 從 Supabase Dashboard 複製 |
| `SUPABASE_SERVICE_KEY` | `eyJhbGci...` | 從 Supabase Dashboard 複製（service_role key）⚠️ 保密！|
| `LLM_PROVIDER` | `gemini` | **新增！** LLM提供商：openai / gemini / deepseek |
| `GEMINI_API_KEY` | `AI...` | **新增！必填！** 你的 Gemini API Key（推薦使用）|
| `OPENAI_API_KEY` | `sk-...` | **選用** 你的 OpenAI API Key |
| `OPENAI_MODEL` | `gpt-4o-mini` | **選用** OpenAI 使用的模型 |
| `DEEPSEEK_API_KEY` | `sk-...` | **選用** 你的 Deepseek API Key |
| `FRONTEND_URL` | `https://08-eldercare.vercel.app` | 你的 Vercel URL（用於 CORS）|
| `ENABLE_AUTO_SUMMARY` | `true` | 啟用自動對話總結 |
| `AUTO_SUMMARY_THRESHOLD` | `20` | 觸發自動總結的訊息數量 |
| `SESSION_SECRET` | `eldercare-companion-secret-2025` | Session 加密密鑰（建議改為隨機字串）|

**如何取得 Supabase Keys：**
1. 前往 [Supabase Dashboard](https://supabase.com/dashboard/project/oatdjdelzybcacwqafkk/settings/api)
2. 點擊左側 **"Settings"** → **"API"**
3. 複製以下內容：
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_KEY` ⚠️ 保密！

**如何取得 Gemini API Key：** ⭐ 推薦
1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 使用 Google 帳號登入
3. 點擊 **"Get API Key"** 或 **"Create API Key"**
4. 選擇現有的 Google Cloud 專案或建立新專案
5. 複製 API Key（格式：`AIza...`）
6. **注意**：Gemini 提供免費額度，每分鐘 60 次請求

**如何取得 OpenAI API Key：** (選用)
1. 前往 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 登入後點擊 **"Create new secret key"**
3. 複製 API Key（只會顯示一次！格式：`sk-...`）
4. **注意**：需要先儲值至少 $5 才能使用 API

**如何取得 Deepseek API Key：** (選用)
1. 前往 [Deepseek Platform](https://platform.deepseek.com/api_keys)
2. 註冊並登入帳號
3. 點擊 **"Create API Key"**
4. 複製 API Key（格式：`sk-...`）

#### 2.4 部署

1. 確認所有設定正確
2. 點擊頁面底部的 **"Create Web Service"** 按鈕
3. Render 會開始自動部署，你會看到：
   ```
   ==> Installing dependencies...
   ==> Building...
   ==> Starting server...
   ==> Your service is live 🎉
   ```
4. 部署通常需要 **3-5 分鐘**

**完成後你會得到一個 URL，格式為：**
```
https://eldercare-backend.onrender.com
```
或
```
https://eldercare-backend-xxxx.onrender.com
```

**⚠️ 重要：記下這個 URL！** 稍後需要在前端設定中使用。

#### 2.5 測試 Backend 是否正常運作

在瀏覽器訪問：
```
https://your-backend-url.onrender.com/api/health
```

應該會看到：
```json
{
  "status": "ok",
  "timestamp": "2025-01-26T...",
  "environment": "production"
}
```

如果看到這個回應，恭喜！後端部署成功 🎉

#### 2.6 檢查 Logs（如果有問題）

如果部署失敗：
1. 在 Render Dashboard，點擊你的 service
2. 點擊左側 **"Logs"** 標籤
3. 查看錯誤訊息：
   - `Missing script: "build"` → Build Command 設定錯誤，改為留空或 `npm install`
   - `Missing environment variables` → 檢查環境變數設定
   - `Module not found` → 檢查 Root Directory 是否設為 `backend`
   - `Port already in use` → 通常是暫時性問題，等待重啟
   - `Error: Cannot find module` → 依賴沒安裝，檢查 Build Command

**常見解決方案：**
- 如果看到 `Missing script: "build"` 錯誤，在 Render 設定中：
  1. 點擊 **"Settings"**
  2. 找到 **"Build Command"**
  3. 改為留空或 `npm install`
  4. 點擊 **"Save Changes"**
  5. 手動重新部署：**"Manual Deploy"** → **"Deploy latest commit"**

#### 2.7 設定 Firebase Cloud Messaging（FCM 推播通知）- 選用

Firebase Cloud Messaging 用於發送用藥提醒的推播通知。這是**完全免費**的服務。

##### 2.7.1 建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊 "Add project" 或 "建立專案"
3. 輸入專案名稱：`eldercare-app`
4. 關閉 Google Analytics（可選）
5. 點擊 "Create project"

##### 2.7.2 啟用 Cloud Messaging

1. 在 Firebase Console，點擊左側 ⚙️ "Project settings"
2. 點擊 "Cloud Messaging" 標籤
3. 如果看到 "Cloud Messaging API (Legacy) is disabled"：
   - 點擊旁邊的三點選單
   - 點擊 "Manage API in Google Cloud Console"
   - 點擊 "Enable" 啟用 API
4. 複製 **Server Key**（用於後端發送推播）

##### 2.7.3 新增 Web App

1. 回到 Firebase Console 首頁
2. 點擊 "Add app" → 選擇 Web 圖示 `</>`
3. 輸入 App nickname：`eldercare-web`
4. 點擊 "Register app"
5. 複製 `firebaseConfig` 物件並保存

##### 2.7.4 取得 Service Account Key

1. 在 Firebase Console，點擊 ⚙️ "Project settings"
2. 點擊 "Service accounts" 標籤
3. 點擊 "Generate new private key"
4. 確認並下載 JSON 檔案

從 JSON 檔案中取得以下資訊並設定到 Render 環境變數：

```env
FIREBASE_PROJECT_ID=your-project-id               # 從 JSON 的 "project_id"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...       # 從 JSON 的 "client_email"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

⚠️ **重要**：
- `FIREBASE_PRIVATE_KEY` 必須用雙引號包住
- 保持 `\n` 換行符號
- 不要移除 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`

詳細設定請參考：[MEDICATION_REMINDER_SETUP.md](MEDICATION_REMINDER_SETUP.md)

##### 2.7.5 更新前端 Firebase 設定

編輯 `frontend/public/firebase-messaging-sw.js`，將 firebaseConfig 替換成你的設定：

```javascript
const firebaseConfig = {
  apiKey: "你的 apiKey",
  authDomain: "你的 authDomain",
  projectId: "你的 projectId",
  storageBucket: "你的 storageBucket",
  messagingSenderId: "你的 messagingSenderId",
  appId: "你的 appId"
};
```

#### 2.8 設定 Resend（Email 通知）- 選用

Resend 用於發送用藥提醒的 Email 通知。免費方案提供每月 3,000 封郵件。

##### 2.8.1 註冊 Resend 帳號

1. 前往 [Resend.com](https://resend.com/)
2. 點擊 "Sign Up"
3. 使用 GitHub 或 Email 註冊

##### 2.8.2 取得 API Key

1. 登入 Resend Dashboard
2. 點擊左側 "API Keys"
3. 點擊 "Create API Key"
4. 輸入名稱：`eldercare-production`
5. 選擇權限：✅ "Sending access"
6. 點擊 "Create"
7. **立即複製 API Key**（只會顯示一次！）

格式：`re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

##### 2.8.3 設定發件人 Email

**選項 A：驗證域名（推薦）**

如果你有自己的域名：

1. 在 Resend Dashboard，點擊 "Domains"
2. 點擊 "Add Domain"
3. 輸入域名並按照指示設定 DNS 記錄（SPF、DKIM、DMARC）
4. 驗證成功後，使用：
   ```env
   RESEND_FROM_EMAIL=ElderCare <noreply@yourdomain.com>
   ```

**選項 B：使用測試域名（開發測試）**

```env
RESEND_FROM_EMAIL=ElderCare <onboarding@resend.dev>
```

⚠️ 限制：只能發送給已驗證的收件人

詳細設定請參考：[MEDICATION_REMINDER_SETUP.md](MEDICATION_REMINDER_SETUP.md)

##### 2.8.4 在 Render 設定環境變數

在 Render Dashboard 的環境變數中新增：

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=ElderCare <onboarding@resend.dev>
```

然後點擊 "Save Changes" 並重新部署。

#### 2.9 重要提醒：Render 免費層限制

⚠️ **Render Free Plan 特性：**
- ✅ 每月 750 小時免費（約 31 天）
- ⚠️ **15 分鐘無活動後會休眠**
- ⚠️ 首次喚醒需要 30-60 秒
- ✅ 自動 HTTPS
- ✅ 自動從 GitHub 部署

**如何避免休眠（可選）：**
1. 使用 [UptimeRobot](https://uptimerobot.com) 每 5 分鐘 ping 一次你的 backend
2. 或升級到 Render Starter Plan ($7/月) 移除休眠限制

---

### Step 3: 部署 Frontend 到 Vercel

#### 3.1 建立帳號
1. 前往 [vercel.com](https://vercel.com)
2. 使用 GitHub 帳號登入

#### 3.2 Import Project
1. 點擊 "Add New..." → "Project"
2. Import 您的 GitHub repository

#### 3.3 設定專案
- **Framework Preset**: Other
- **Root Directory**: 保持預設（根目錄）
- **Build Command**: 留空
- **Output Directory**: `frontend/public`

#### 3.4 設定環境變數
在 "Environment Variables" 新增：

```
VITE_BACKEND_URL=https://eldercare-backend.onrender.com
VITE_SUPABASE_URL=https://oatdjdelzybcacwqafkk.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

#### 3.5 部署
點擊 "Deploy" 開始部署

---

### Step 4: 更新 Frontend 連接後端

**重要！** 部署 Vercel 後，需要將前端連接到 Render 的後端。

#### 方法 1：修改程式碼（推薦）

編輯 `frontend/public/app.js`，找到第 5-8 行：

```javascript
// API URL - 自動根據環境選擇
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api'; // Vercel 上後端在同一個域名下
```

**改為：**

```javascript
// API URL - 自動根據環境選擇
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : 'https://your-render-backend-url.onrender.com/api'; // 替換成你的 Render URL
```

**然後推送到 GitHub：**

```bash
git add frontend/public/app.js
git commit -m "Update API URL to Render backend"
git push origin main
```

Vercel 會自動重新部署。

#### 方法 2：使用環境變數（進階）

在 Vercel Dashboard：
1. 前往你的專案
2. 點擊 **"Settings"** → **"Environment Variables"**
3. 新增變數：
   ```
   VITE_API_URL=https://your-render-backend-url.onrender.com/api
   ```
4. 點擊 **"Deployments"** → 最新的部署 → **"Redeploy"**

但這需要修改 `app.js` 來讀取環境變數。

---

## 🔧 部署後設定

### 1. 設定 CORS（Backend）⚠️ 重要！

後端的 CORS 設定已經配置為自動接受來自 Vercel 的請求。

檢查 `backend/server.js` 的第 18-39 行：

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      process.env.FRONTEND_URL, // 從環境變數讀取
    ].filter(Boolean);

    // 允許沒有 origin 的請求
    if (!origin) return callback(null, true);

    // 允許所有 .vercel.app 域名
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

**如果遇到 CORS 錯誤：**

1. 確認 Render 環境變數 `FRONTEND_URL` 已設定為你的 Vercel URL
2. 在 Render Dashboard 重新部署：
   - 點擊右上角 **"Manual Deploy"** → **"Deploy latest commit"**

### 2. 更新 Supabase Redirect URLs

在 Supabase Dashboard：
1. 前往 [URL Configuration](https://supabase.com/dashboard/project/oatdjdelzybcacwqafkk/auth/url-configuration)
2. 設定 **Site URL**：
   ```
   https://08-eldercare.vercel.app
   ```
3. 在 **Redirect URLs** 新增（每行一個）：
   ```
   https://08-eldercare.vercel.app/**
   http://localhost:8080/**
   ```
4. 點擊 **"Save"**

### 3. 驗證 Backend 健康狀態

訪問你的 Render backend health endpoint：
```
https://your-backend-url.onrender.com/api/health
```

應該看到：
```json
{
  "status": "ok",
  "timestamp": "2025-01-26T...",
  "environment": "production"
}
```

### 4. 測試完整流程

1. **測試 OAuth 登入**
   - 訪問 https://08-eldercare.vercel.app/login.html
   - 使用 Google 登入
   - 應該成功重定向到 onboarding 頁面

2. **測試訊息傳送**
   - 完成 onboarding
   - 在聊天頁面發送訊息
   - 應該能收到 AI 回應

3. **檢查 Console（F12）**
   - 不應該有 CORS 錯誤
   - 不應該有 API 連接錯誤
   - API 請求應該是 200 或 201 狀態

---

## ✅ 測試部署

### 前端測試
訪問您的 Vercel URL：
```
https://your-vercel-app.vercel.app
```

檢查：
- [ ] 登入頁面正常顯示
- [ ] 可以註冊新帳號
- [ ] 可以登入
- [ ] Onboarding 流程正常

### 後端測試
訪問 Backend URL：
```
https://eldercare-backend.onrender.com/health
```

應該看到：
```json
{
  "status": "ok",
  "message": "ElderCare Backend API is running"
}
```

---

## 🐛 常見問題與故障排除

### 問題 1: 傳送按鈕沒有反應

**症狀**：
- 點擊「傳送」按鈕沒有任何反應
- Console 顯示網路錯誤

**原因**：前端無法連接到後端 API

**檢查步驟**：
1. 打開瀏覽器 Console (F12)
2. 查看是否有錯誤訊息：
   ```
   Failed to fetch
   net::ERR_CONNECTION_REFUSED
   ```

**解決方案**：

**步驟 1：確認後端 URL 正確**
```bash
# 在 frontend/public/app.js 第 5-8 行
const API_BASE_URL = 'https://your-render-url.onrender.com/api';
```

**步驟 2：測試後端是否運行**
```bash
curl https://your-render-url.onrender.com/api/health
```

**步驟 3：如果後端休眠，訪問一次喚醒它**
- 在瀏覽器打開 `https://your-render-url.onrender.com/api/health`
- 等待 30-60 秒讓服務啟動

**步驟 4：推送修改並重新部署**
```bash
git add frontend/public/app.js
git commit -m "Fix API URL"
git push origin main
```

---

### 問題 2: CORS 錯誤

**症狀**：
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS policy
```

**原因**：後端沒有允許來自前端域名的請求

**解決方案**：

**步驟 1：檢查 Render 環境變數**
1. 前往 Render Dashboard → 你的 service
2. 點擊左側 **"Environment"**
3. 確認有 `FRONTEND_URL=https://08-eldercare.vercel.app`

**步驟 2：檢查 backend/server.js**
確認第 30 行包含：
```javascript
if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
```

**步驟 3：重新部署後端**
- 在 Render Dashboard，點擊 **"Manual Deploy"** → **"Deploy latest commit"**

---

### 問題 3: Supabase 連接失敗

**症狀**：
```
Error: Missing Supabase environment variables
```

**解決方案**：

**檢查 Render 環境變數：**
1. `SUPABASE_URL` 是否正確
2. `SUPABASE_ANON_KEY` 是否正確
3. `SUPABASE_SERVICE_KEY` 是否設定

**重新取得 Supabase Keys：**
1. 前往 [Supabase Dashboard](https://supabase.com/dashboard/project/oatdjdelzybcacwqafkk/settings/api)
2. 複製 **anon** 和 **service_role** keys
3. 更新 Render 環境變數
4. 重新部署

---

### 問題 4: Backend 休眠（Render 免費層）

**症狀**：
- 首次訪問需要等待 30-60 秒
- 顯示「正在連接...」很久

**說明**：Render 免費層會在 15 分鐘無活動後休眠

**臨時解決方案**：
- 訪問 `https://your-backend-url.onrender.com/api/health` 喚醒服務
- 等待服務啟動後再使用

**長期解決方案**：

**方案 1：使用 UptimeRobot（免費）**
1. 註冊 [UptimeRobot](https://uptimerobot.com)
2. 新增監控：
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://your-backend-url.onrender.com/api/health`
   - **Monitoring Interval**: 5 minutes
3. 這會每 5 分鐘 ping 一次，防止休眠

**方案 2：升級 Render（$7/月）**
- Render Starter Plan 移除休眠限制
- 提供更好的效能

---

### 問題 5: LLM API 錯誤（Gemini / OpenAI / Deepseek）

**症狀**：
```
Error: LLM API 未配置
Error: Incorrect API key provided
Invalid API Key
```

**針對 Gemini API 錯誤**：

1. **檢查 API Key 格式**
   - Gemini API Key 應該以 `AIza` 開頭
   - 長度約 39 字元

2. **重新生成 Gemini API Key**
   - 前往 [Google AI Studio](https://aistudio.google.com/app/apikey)
   - 點擊 **"Get API Key"** 或 **"Create API Key"**
   - 複製並更新到 Render 環境變數 `GEMINI_API_KEY`

3. **檢查 Gemini API 額度**
   - Gemini 提供免費額度：每分鐘 60 次請求
   - 如果超過限制，等待一分鐘後重試
   - 查看 [Google AI Studio](https://aistudio.google.com/) 的使用情況

4. **確認 LLM_PROVIDER 設定正確**
   - 在 Render 環境變數中確認 `LLM_PROVIDER=gemini`

**針對 OpenAI API 錯誤**：

1. **檢查 API Key 格式**
   - OpenAI API Key 應該以 `sk-` 開頭
   - 長度約 51 字元

2. **重新生成 API Key**
   - 前往 [OpenAI Platform](https://platform.openai.com/api-keys)
   - 點擊 **"Create new secret key"**
   - 複製並更新到 Render 環境變數 `OPENAI_API_KEY`

3. **檢查 API 額度**
   - 前往 [Usage](https://platform.openai.com/usage)
   - 確認還有可用額度
   - OpenAI 需要至少 $5 儲值才能使用 API

4. **確認 LLM_PROVIDER 設定正確**
   - 如果要使用 OpenAI，在 Render 環境變數中設定 `LLM_PROVIDER=openai`

**針對 Deepseek API 錯誤**：

1. **檢查 API Key 格式**
   - Deepseek API Key 應該以 `sk-` 開頭

2. **重新生成 API Key**
   - 前往 [Deepseek Platform](https://platform.deepseek.com/api_keys)
   - 建立新的 API Key
   - 更新到 Render 環境變數 `DEEPSEEK_API_KEY`

3. **確認 LLM_PROVIDER 設定正確**
   - 如果要使用 Deepseek，在 Render 環境變數中設定 `LLM_PROVIDER=deepseek`

**通用解決步驟**：

1. **更新環境變數並重新部署**
   - 在 Render Dashboard 更新環境變數
   - 點擊 **"Manual Deploy"** → **"Deploy latest commit"**

2. **檢查 Render Logs**
   - 查看啟動日誌中的 LLM 配置訊息
   - 應該看到類似：`✅ Gemini client initialized`

3. **測試 Health Check**
   - 訪問 `https://your-backend-url.onrender.com/api/health`
   - 檢查回應中的 LLM 配置狀態

---

### 問題 6: 訊息發送後沒有回應

**症狀**：
- 訊息發送成功
- 但沒有 AI 回覆
- Console 顯示 500 錯誤

**檢查步驟**：

1. **查看 Render Logs**
   - Render Dashboard → 你的 service → **"Logs"**
   - 查找錯誤訊息

2. **常見錯誤原因**：
   - OpenAI API Key 無效
   - Supabase 連接失敗
   - 資料庫權限問題

3. **測試 API 端點**
   ```bash
   curl -X POST https://your-backend-url.onrender.com/api/conversations/test-id/messages \
     -H "Content-Type: application/json" \
     -d '{"userId":"test","content":"Hello"}'
   ```

---

### 問題 7: Scroll Bar 不顯示

**症狀**：無法看到滾動條

**說明**：這是正常的！Scroll bar 只在內容超出容器高度時才會顯示。

**測試方法**：
1. 發送 10+ 條訊息
2. 當內容超過畫面高度時，scroll bar 會自動出現

**如果想要一直顯示 scroll bar**：
```css
/* 在 styles.css 中修改 */
.chat-messages {
  overflow-y: scroll !important; /* 強制顯示 */
}
```

---

## 📊 部署成本

### 免費方案（推薦配置）
- **Vercel**: 免費（Hobby 方案）
- **Render**: 免費（750 小時/月）
- **Supabase**: 免費（含 500MB 資料庫）
- **Gemini API**: 免費（每分鐘 60 次請求）
- **總計**: $0/月 ⭐ 完全免費！

### 付費方案（進階使用）
- **Vercel Pro**: $20/月（更高流量限制）
- **Render Starter**: $7/月（移除休眠限制，更好效能）
- **Supabase Pro**: $25/月（更多資源和備份）
- **OpenAI API**: 依使用量計費（gpt-4o-mini 約 $0.15/1M tokens）
- **Deepseek API**: 依使用量計費（價格較 OpenAI 便宜約 90%）

### LLM 成本比較（每百萬 tokens）
| Provider | 輸入成本 | 輸出成本 | 免費額度 |
|----------|---------|---------|---------|
| **Gemini** | $0 | $0 | ✅ 每分鐘 60 次請求 |
| **OpenAI gpt-4o-mini** | $0.15 | $0.60 | ❌ 需儲值 $5 |
| **Deepseek** | $0.014 | $0.28 | ❌ 需儲值 |

**建議**：
- 個人使用或測試：使用 Gemini（完全免費）
- 中小型應用：Gemini 或 Deepseek（成本低）
- 企業級應用：OpenAI（品質最佳，但成本較高）

---

## 🔄 更新部署

### 更新 Frontend
```bash
git add .
git commit -m "Update frontend"
git push
```
Vercel 會自動重新部署

### 更新 Backend
```bash
git add .
git commit -m "Update backend"
git push
```
Render 會自動重新部署

---

## 📝 部署檢查清單

### 基本設定
- [ ] GitHub repo 建立完成
- [ ] `.gitignore` 已設定（不上傳 `.env`）
- [ ] Backend 在 Render 部署成功
- [ ] Frontend 在 Vercel 部署成功

### 環境變數設定
- [ ] Supabase 環境變數已設定（URL, ANON_KEY, SERVICE_KEY）
- [ ] **LLM_PROVIDER 已設定**（gemini / openai / deepseek）
- [ ] **至少一個 LLM API Key 已設定**
  - [ ] Gemini API Key（推薦）
  - [ ] 或 OpenAI API Key
  - [ ] 或 Deepseek API Key
- [ ] FRONTEND_URL 已設定
- [ ] SESSION_SECRET 已設定

### 服務設定
- [ ] CORS 設定正確
- [ ] Supabase Redirect URLs 已更新
- [ ] Render Logs 顯示 LLM 已成功初始化

### 功能測試
- [ ] 測試登入/註冊功能
- [ ] 測試聊天功能（AI 回應正常）
- [ ] 測試多語言切換
- [ ] 測試 LLM 模型切換（在設定頁面）

---

## 🎉 完成！

您的 ElderCare App 現在已經上線！

- **Frontend URL**: https://08-eldercare.vercel.app
- **Backend URL**: https://eldercare-backend-xxxx.onrender.com
- **當前 LLM**: Gemini（或您設定的其他模型）

### 🔍 部署驗證步驟

1. **檢查後端健康狀態**
   ```bash
   curl https://your-backend-url.onrender.com/api/health
   ```
   應該看到 LLM 配置資訊

2. **測試 AI 回應**
   - 登入應用
   - 發送測試訊息
   - 確認收到 AI 回應

3. **測試 LLM 切換**
   - 進入設定頁面
   - 嘗試切換不同的 AI 模型
   - 確認切換後仍能正常對話

### 📊 使用監控

記得定期檢查：
1. **LLM API 使用量**
   - Gemini: 免費每分鐘 60 次請求
   - OpenAI: 查看 [Usage Dashboard](https://platform.openai.com/usage)
   - Deepseek: 查看平台使用情況

2. **定期備份 Supabase 資料庫**

3. **監控錯誤日誌**
   - Render Logs（後端錯誤）
   - Vercel Logs（前端錯誤）

4. **設定 UptimeRobot 防止後端休眠**

---

## 📋 快速參考：重要 URLs

### Dashboard 連結
- **Render Dashboard**: https://dashboard.render.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard/project/oatdjdelzybcacwqafkk

### LLM Provider 連結
- **Google AI Studio** (Gemini): https://aistudio.google.com/app/apikey
- **OpenAI Platform**: https://platform.openai.com/api-keys
- **OpenAI Usage**: https://platform.openai.com/usage
- **Deepseek Platform**: https://platform.deepseek.com/api_keys

### API 端點
- **Backend Health**: `https://your-backend-url.onrender.com/api/health`
- **Conversations**: `https://your-backend-url.onrender.com/api/conversations`
- **Messages**: `https://your-backend-url.onrender.com/api/conversations/:id/messages`

### 環境變數清單

#### Render (Backend) - 完整設定
```env
# 應用程式設定
NODE_ENV=production
APP_PORT=3000
APP_HOST=0.0.0.0

# Supabase 資料庫
SUPABASE_URL=https://oatdjdelzybcacwqafkk.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...

# LLM 配置（至少需要配置一個 LLM 提供商的 API Key）
LLM_PROVIDER=gemini                    # 預設使用 Gemini（可選：openai, gemini, deepseek）

# Google Gemini (推薦) - 必填
GEMINI_API_KEY=AIza...                 # 從 https://aistudio.google.com/app/apikey 獲取

# OpenAI (選用)
OPENAI_API_KEY=sk-...                  # 從 https://platform.openai.com/api-keys 獲取
OPENAI_MODEL=gpt-4o-mini

# Deepseek (選用)
DEEPSEEK_API_KEY=sk-...                # 從 https://platform.deepseek.com/api_keys 獲取

# Firebase Cloud Messaging (FCM) - 用藥提醒推播通知（選用）
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"

# Resend Email 服務 - 用藥提醒 Email 通知（選用）
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=ElderCare <noreply@yourdomain.com>

# 前端 CORS 設定
FRONTEND_URL=https://08-eldercare.vercel.app

# 功能開關
ENABLE_AUTO_SUMMARY=true
AUTO_SUMMARY_THRESHOLD=20
ENABLE_VOICE=true
ENABLE_SOS=true

# Session 設定
SESSION_SECRET=eldercare-companion-secret-2025  # 建議改為隨機字串
```

#### Vercel (Frontend) - 選用
```env
VITE_API_URL=https://your-backend-url.onrender.com/api
```

---

## 🔄 快速部署流程

### 更新前端
```bash
# 修改檔案
git add .
git commit -m "Update frontend: <description>"
git push origin main
# Vercel 自動部署（約 1-2 分鐘）
```

### 更新後端
```bash
# 修改檔案
git add .
git commit -m "Update backend: <description>"
git push origin main
# Render 自動部署（約 3-5 分鐘）
```

### 緊急回滾
**Vercel:**
1. Dashboard → Deployments
2. 找到上一個成功的部署
3. 點擊 **"Promote to Production"**

**Render:**
1. Dashboard → Manual Deploy
2. 選擇上一個 commit
3. 點擊 **"Deploy"**

---

## 📱 測試檢查清單

部署後請依序測試：

- [ ] **基本功能**
  - [ ] 訪問首頁不出現錯誤
  - [ ] 可以開啟登入頁面
  - [ ] OAuth Google 登入正常

- [ ] **Onboarding 流程**
  - [ ] 首次登入跳轉到 onboarding
  - [ ] 可以選擇角色
  - [ ] 可以填寫資料並提交
  - [ ] 完成後跳轉到主頁面

- [ ] **聊天功能**
  - [ ] 可以創建新對話
  - [ ] 可以發送訊息
  - [ ] 可以收到 AI 回覆
  - [ ] 訊息顯示正確

- [ ] **進階功能**
  - [ ] 語音輸入（如果有）
  - [ ] 快捷按鈕
  - [ ] 對話摘要
  - [ ] 多語言切換

- [ ] **效能測試**
  - [ ] 頁面載入速度 < 3 秒
  - [ ] API 回應時間 < 2 秒
  - [ ] 無 Console 錯誤

---

## 💡 最佳實踐建議

### 安全性
1. **永遠不要**把 `.env` 檔案上傳到 GitHub
2. 定期更換 API Keys
3. 使用環境變數，不要硬編碼敏感資料
4. 檢查 Supabase RLS 政策是否正確設定

### 效能
1. 使用 UptimeRobot 保持後端活躍
2. 考慮升級到付費方案以獲得更好效能
3. 定期清理舊對話和訊息
4. 監控 API 使用量避免超額

### 維護
1. 定期備份 Supabase 資料庫
2. 查看 Render 和 Vercel 的 Logs
3. 追蹤 OpenAI API 使用量
4. 更新依賴套件（每月一次）

### 監控
- 設定 UptimeRobot 監控後端
- 使用 Supabase 的 Analytics 查看資料庫使用情況
- 查看 OpenAI Usage 避免超出額度
- 定期檢查錯誤日誌

---

## 📞 取得協助

如果遇到問題：

1. **檢查文件**：先查看本文件的「常見問題」部分
2. **查看 Logs**：Render Logs 和 Vercel Logs 通常會有詳細錯誤訊息
3. **搜尋錯誤訊息**：將錯誤訊息貼到 Google 搜尋
4. **官方文件**：
   - [Render Docs](https://render.com/docs)
   - [Vercel Docs](https://vercel.com/docs)
   - [Supabase Docs](https://supabase.com/docs)

---

祝您部署順利！🚀
