# Render 環境變數設定完整指南

## 🎯 問題診斷

如果您看到以下錯誤：
- ❌ **「Invalid API key」**
- ❌ **「Cannot read properties of null (reading 'id')」**
- ❌ **「查詢使用者檔案失敗」**

**這表示 Render 上的環境變數未正確設定！**

---

## 📋 必要的環境變數

以下 **4 個環境變數** 必須全部設定，缺一不可：

| 變數名稱 | 用途 | 如何取得 | 範例格式 |
|---------|------|---------|---------|
| `SUPABASE_URL` | Supabase 專案網址 | Supabase Dashboard | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase 公開金鑰 | Supabase Dashboard | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_KEY` | Supabase 服務金鑰 ⚠️ | Supabase Dashboard | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `OPENAI_API_KEY` | OpenAI API 金鑰 | OpenAI Platform | `sk-proj-xxxxxxxxxxxxx` |

---

## 🔑 如何取得這些金鑰

### 1️⃣ Supabase 金鑰

#### 步驟 A: 登入 Supabase
1. 前往 https://supabase.com/dashboard
2. 使用 Google 帳號登入
3. 選擇您的專案（應該是您之前創建的專案）

#### 步驟 B: 取得 API Keys
1. 點擊左側邊欄的 ⚙️ **「Settings」**
2. 在 Settings 選單中，點擊 **「API」**
3. 在 API Settings 頁面，您會看到：

```
📍 Project URL
https://nxgltttpllzmdvuritik.supabase.co
👆 複製這個作為 SUPABASE_URL

📍 API Keys
┌─────────────────────────────────────────┐
│ anon / public                           │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... │
│ [Reveal] [Copy]                         │
└─────────────────────────────────────────┘
👆 點擊 [Copy] 或 [Reveal]，複製這個作為 SUPABASE_ANON_KEY

┌─────────────────────────────────────────┐
│ service_role (⚠️ Secret)                 │
│ ********************************        │
│ [Reveal] [Copy]                         │
└─────────────────────────────────────────┘
👆 點擊 [Reveal]，然後複製這個作為 SUPABASE_SERVICE_KEY
   ⚠️ 這是機密金鑰，不要分享給任何人！
```

#### ⚠️ 重要提醒
- **service_role** key 預設是隱藏的（顯示為 `****`）
- 您必須點擊 **「Reveal」** 按鈕才能看到完整的金鑰
- 這個金鑰非常重要，務必複製正確！

---

### 2️⃣ OpenAI API Key

#### 步驟 A: 登入 OpenAI Platform
1. 前往 https://platform.openai.com/
2. 登入您的 OpenAI 帳號（需要先註冊）

#### 步驟 B: 創建 API Key
1. 點擊左側邊欄的 **「API keys」**
2. 點擊 **「+ Create new secret key」** 按鈕
3. 給這個 key 取個名字，例如：`ElderCare-Backend-Render`
4. 點擊 **「Create secret key」**
5. **⚠️ 立即複製並保存！** 金鑰只會顯示一次，離開頁面後就無法再查看

#### 格式範例
```
sk-proj-abcdefghijklmnopqrstuvwxyz1234567890
```

#### 💰 注意事項
- OpenAI API 需要付費（需要綁定信用卡）
- GPT-4o-mini 費用：每 1M tokens 約 $0.15-0.60
- 建議設定使用額度限制（例如每月 $10）

---

## ⚙️ 在 Render 設定環境變數

### 步驟 1: 前往 Render Dashboard
1. 登入 https://dashboard.render.com/
2. 點選您的 **eldercare-backend** 服務

### 步驟 2: 開啟 Environment 設定
1. 在左側選單中，點擊 **「Environment」** 標籤
2. 您會看到目前已設定的環境變數列表

### 步驟 3: 新增或更新環境變數
對於每個環境變數：

1. 點擊 **「Add Environment Variable」** 按鈕
2. 在 **Key** 欄位輸入變數名稱（例如：`SUPABASE_URL`）
3. 在 **Value** 欄位貼上對應的值
4. 點擊 **「Save」** 或直接按 Enter

重複以上步驟，直到設定完所有 4 個變數：

```plaintext
Key: SUPABASE_URL
Value: https://nxgltttpllzmdvuritik.supabase.co

Key: SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（很長的字串）

Key: SUPABASE_SERVICE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（很長的字串，與 ANON_KEY 不同！）

Key: OPENAI_API_KEY
Value: sk-proj-xxxxxxxxxxxxx
```

### 步驟 4: 儲存並重新部署
1. 設定完所有變數後，點擊頁面上方的 **「Save Changes」** 按鈕
2. Render 會自動觸發重新部署
3. 等待 2-3 分鐘，直到狀態變為 **「Live」**（綠色）

---

## ✅ 驗證設定是否正確

### 方法 1: 檢查 Health Endpoint

在瀏覽器開啟：
```
https://eldercare-backend-8o4k.onrender.com/api/health
```

**正確的回應（所有變數都設定）：**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "ElderCare Backend API",
  "environment": {
    "configured": {
      "SUPABASE_URL": true,
      "SUPABASE_ANON_KEY": true,
      "SUPABASE_SERVICE_KEY": true,
      "OPENAI_API_KEY": true
    },
    "allConfigured": true,
    "missing": []
  }
}
```

**錯誤的回應（有變數缺失）：**
```json
{
  "status": "degraded",
  "environment": {
    "allConfigured": false,
    "missing": ["SUPABASE_SERVICE_KEY", "OPENAI_API_KEY"]
  }
}
```

### 方法 2: 測試主應用

1. 前往 https://08-eldercare.vercel.app/
2. 登入
3. 嘗試發送訊息
4. 如果成功收到 AI 回應，表示設定正確！✅

---

## 🐛 常見問題排解

### ❌ 問題 1: "Invalid API key"

**可能原因：**
- `SUPABASE_SERVICE_KEY` 未設定
- `SUPABASE_SERVICE_KEY` 複製錯誤（可能只複製到 `****`）
- 使用了 `SUPABASE_ANON_KEY` 而不是 `SERVICE_KEY`

**解決方法：**
1. 回到 Supabase Dashboard → Settings → API
2. 找到 **service_role** 那一行
3. 點擊 **「Reveal」** 按鈕（不是 Copy！）
4. 看到完整的金鑰後，點擊 **「Copy」**
5. 在 Render 中更新 `SUPABASE_SERVICE_KEY`

### ❌ 問題 2: "Cannot read properties of null (reading 'id')"

**原因：** 通常與問題 1 相同，是 Supabase 配置問題

**解決方法：** 同上

### ❌ 問題 3: Health endpoint 顯示 "missing: ['SUPABASE_SERVICE_KEY']"

**原因：** 該環境變數未設定或設定時的名稱拼寫錯誤

**解決方法：**
1. 檢查 Render Environment 頁面
2. 確認變數名稱完全正確（區分大小寫）
3. 正確：`SUPABASE_SERVICE_KEY`
4. 錯誤：`SUPABASE_SERVICE_ROLE`、`supabase_service_key`

### ❌ 問題 4: 設定後還是不行

**解決方法：**
1. 確認 Render 已完成重新部署（狀態為 Live）
2. 等待 30 秒讓服務完全啟動
3. 清除瀏覽器快取（Ctrl+Shift+R）
4. 重新測試

---

## 📝 完整檢查清單

複製以下清單，逐項確認：

```
□ 已從 Supabase Dashboard 複製 SUPABASE_URL
□ 已從 Supabase Dashboard 複製 SUPABASE_ANON_KEY
□ 已從 Supabase Dashboard **點擊 Reveal** 並複製 SUPABASE_SERVICE_KEY
□ 已從 OpenAI Platform 創建並複製 OPENAI_API_KEY
□ 已在 Render 的 Environment 頁面新增所有 4 個環境變數
□ 變數名稱拼寫完全正確（大小寫、底線）
□ 已點擊 Save Changes
□ Render 已重新部署完成（狀態為 Live）
□ health endpoint 顯示 "allConfigured": true
□ 主應用可以成功發送訊息
```

---

## 🎓 為什麼需要這些金鑰？

| 金鑰 | 用途 | 不設定會怎樣？ |
|-----|------|--------------|
| SUPABASE_URL | 連接到您的 Supabase 資料庫 | 無法存取任何資料 |
| SUPABASE_ANON_KEY | 客戶端操作（有 RLS 限制） | 前端無法連接 |
| SUPABASE_SERVICE_KEY | 後端操作（繞過 RLS） | ❌ 無法查詢使用者資料 |
| OPENAI_API_KEY | 呼叫 ChatGPT API | 無法產生 AI 回應 |

**最常被遺漏的是 `SUPABASE_SERVICE_KEY`**，因為它預設是隱藏的！

---

## 📞 還是無法解決？

請提供以下資訊：

1. **Health endpoint 的完整回應**
   - 訪問 `https://eldercare-backend-8o4k.onrender.com/api/health`
   - 複製整個 JSON 回應

2. **Render 的部署日誌**
   - 在 Render Dashboard → Logs 頁面
   - 複製最近的錯誤訊息

3. **瀏覽器 Console 的錯誤訊息**
   - 在主應用按 F12
   - 切換到 Console 分頁
   - 複製紅色的錯誤訊息

這樣我就能更精準地幫您診斷問題！
