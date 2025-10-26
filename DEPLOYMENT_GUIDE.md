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

### 1. 確認環境變數

在 `.env` 檔案中確認以下變數：

```env
# Supabase
SUPABASE_URL=https://oatdjdelzybcacwqafkk.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Server
PORT=3000
```

### 2. 確認資料庫 Migration

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
| **Build Command** | `npm install` | 安裝依賴 |
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
| `SUPABASE_SERVICE_KEY` | `eyJhbGci...` | 從 Supabase Dashboard 複製（service_role key）|
| `OPENAI_API_KEY` | `sk-...` | 你的 OpenAI API Key |
| `OPENAI_MODEL` | `gpt-4o-mini` | 使用的模型 |
| `FRONTEND_URL` | `https://08-eldercare.vercel.app` | 你的 Vercel URL（用於 CORS）|

**如何取得 Supabase Keys：**
1. 前往 [Supabase Dashboard](https://supabase.com/dashboard/project/oatdjdelzybcacwqafkk/settings/api)
2. 點擊左側 **"Settings"** → **"API"**
3. 複製以下內容：
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_KEY` ⚠️ 保密！

**如何取得 OpenAI API Key：**
1. 前往 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 登入後點擊 **"Create new secret key"**
3. 複製 API Key（只會顯示一次！）

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
   - `Missing environment variables` → 檢查環境變數設定
   - `Module not found` → 檢查 Root Directory 是否設為 `backend`
   - `Port already in use` → 通常是暫時性問題，等待重啟

#### 2.7 重要提醒：Render 免費層限制

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

### 問題 5: OpenAI API 錯誤

**症狀**：
```
Error: Incorrect API key provided
Invalid OpenAI API Key
```

**解決方案**：

1. **檢查 API Key 格式**
   - 應該以 `sk-` 開頭
   - 長度約 51 字元

2. **重新生成 API Key**
   - 前往 [OpenAI Platform](https://platform.openai.com/api-keys)
   - 點擊 **"Create new secret key"**
   - 複製並更新到 Render 環境變數

3. **檢查 API 額度**
   - 前往 [Usage](https://platform.openai.com/usage)
   - 確認還有可用額度

4. **更新環境變數並重新部署**

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

### 免費方案
- **Vercel**: 免費（Hobby 方案）
- **Render**: 免費（750 小時/月）
- **Supabase**: 免費（含 500MB 資料庫）
- **總計**: $0/月

### 付費建議（生產環境）
- **Render Pro**: $7/月（移除休眠限制）
- **Supabase Pro**: $25/月（更多資源）

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

- [ ] GitHub repo 建立完成
- [ ] `.gitignore` 已設定（不上傳 `.env`）
- [ ] Backend 在 Render 部署成功
- [ ] Frontend 在 Vercel 部署成功
- [ ] 環境變數都已設定
- [ ] CORS 設定正確
- [ ] Supabase Redirect URLs 已更新
- [ ] 測試登入/註冊功能
- [ ] 測試聊天功能
- [ ] 測試多語言切換

---

## 🎉 完成！

您的 ElderCare App 現在已經上線！

- **Frontend URL**: https://08-eldercare.vercel.app
- **Backend URL**: https://eldercare-backend-xxxx.onrender.com

記得：
1. 定期備份 Supabase 資料庫
2. 監控 API 使用量（OpenAI, Supabase）
3. 檢查錯誤日誌（Render Logs, Vercel Logs）
4. 設定 UptimeRobot 防止後端休眠

---

## 📋 快速參考：重要 URLs

### Dashboard 連結
- **Render Dashboard**: https://dashboard.render.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard/project/oatdjdelzybcacwqafkk
- **OpenAI Platform**: https://platform.openai.com

### API 端點
- **Backend Health**: `https://your-backend-url.onrender.com/api/health`
- **Conversations**: `https://your-backend-url.onrender.com/api/conversations`
- **Messages**: `https://your-backend-url.onrender.com/api/conversations/:id/messages`

### 環境變數清單

#### Render (Backend)
```env
NODE_ENV=production
APP_PORT=3000
APP_HOST=0.0.0.0
SUPABASE_URL=https://oatdjdelzybcacwqafkk.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
FRONTEND_URL=https://08-eldercare.vercel.app
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
