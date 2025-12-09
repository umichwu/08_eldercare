# FCM Token 自動註冊實作完成報告

**功能名稱：** FCM Token 自動註冊到後端
**優先級：** ⭐⭐⭐ 高
**完成日期：** 2025-01-21
**狀態：** ✅ 完成（已優化）

---

## 📋 實作概述

本次實作**完善並優化**了 FCM Token 自動註冊功能，確保推播通知能正確發送到使用者裝置。

### 發現
- ✅ 前端 FCM Token 取得與註冊邏輯**已完整實作**
- ✅ 後端 API 端點**已完整實作**
- ✅ 後端 Service 函數**已完整實作**
- ⚠️ 發現後端使用舊表結構（elders/family_members），需優化以支援新架構（user_profiles）

### 優化內容
1. 更新後端 service 優先使用 `user_profiles` 表
2. 保留對舊表結構的相容性（向後相容）
3. 為 `user_profiles` 表添加 `device_info` 欄位
4. 建立完整文件

---

## 🗄️ 資料庫變更

### 新增欄位：user_profiles.device_info

```sql
ALTER TABLE public.user_profiles
ADD COLUMN device_info JSONB DEFAULT '{}';
```

**用途：** 儲存 FCM Token 相關的裝置資訊
- userAgent: 瀏覽器 User Agent
- platform: 作業系統平台
- language: 瀏覽器語言
- screenResolution: 螢幕解析度
- timestamp: 註冊時間

**相關欄位：**
- `fcm_token` TEXT - FCM Token 字串
- `fcm_token_updated_at` TIMESTAMPTZ - Token 最後更新時間
- `device_info` JSONB - 裝置資訊（新增）

---

## 💻 前端實作（已存在，無需修改）

### 檔案位置
`frontend/public/index.html` (Lines 763-932)

### 核心函數：registerFCMTokenToBackend()

```javascript
async function registerFCMTokenToBackend(token) {
  try {
    // 1. 取得使用者 session
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      console.log('⚠️ 使用者未登入，將在登入後註冊 FCM Token');
      return false;
    }

    // 2. 取得使用者 profile
    const authUserId = session.user.id;
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('role, elder_id, family_member_id')
      .eq('auth_user_id', authUserId)
      .single();

    // 3. 判斷 userType 和實際的 userId
    let userType = profile.role === 'family' ? 'family_member' : 'elder';
    let userId = authUserId;  // 使用 auth_user_id

    // 4. 取得裝置資訊
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timestamp: new Date().toISOString()
    };

    // 5. 發送到後端
    const response = await fetch(`${API_BASE_URL}/api/fcm/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        userType: userType,
        fcmToken: token,
        deviceInfo: deviceInfo
      })
    });

    if (!response.ok) {
      console.error('❌ FCM Token 註冊失敗');
      return false;
    }

    console.log('✅ FCM Token 註冊成功');
    localStorage.setItem('fcm_token_registered_at', new Date().toISOString());

    return true;
  } catch (error) {
    console.error('❌ 註冊 FCM Token 時發生錯誤:', error);
    return false;
  }
}
```

### 自動註冊流程

```javascript
// FCM 初始化時自動註冊
(async function() {
  const initialized = await window.FCM.init();

  if (initialized) {
    // 請求通知權限
    const token = await window.FCM.requestPermission();

    if (token) {
      // 儲存到 localStorage
      localStorage.setItem('fcm_token', token);

      // 自動註冊到後端
      const registered = await registerFCMTokenToBackend(token);

      if (!registered) {
        // 監聽登入事件，在登入後重新註冊
        window.addEventListener('user-logged-in', async () => {
          await registerFCMTokenToBackend(token);
        });
      }
    }
  }
})();
```

### 特色功能
- ✅ 自動在 FCM 初始化時註冊
- ✅ 未登入時監聽登入事件，登入後自動註冊
- ✅ 詳細的錯誤處理與 console 日誌
- ✅ 記錄註冊時間到 localStorage
- ✅ 收集完整的裝置資訊

---

## 🔧 後端實作

### 1. API 端點（已存在，無需修改）

**檔案：** `backend/routes/medicationApi.js` (Lines 846-881)

#### POST /api/fcm/register
註冊或更新 FCM Token

**請求：**
```json
{
  "userId": "auth_user_id",
  "userType": "elder | family_member",
  "fcmToken": "FCM_TOKEN_STRING",
  "deviceInfo": {
    "userAgent": "Mozilla/5.0...",
    "platform": "Win32",
    "language": "zh-TW",
    "screenResolution": "1920x1080",
    "timestamp": "2025-01-21T10:00:00Z"
  }
}
```

**回應：**
```json
{
  "message": "FCM Token 註冊成功",
  "data": {
    "id": "uuid",
    "fcm_token": "...",
    "fcm_token_updated_at": "2025-01-21T10:00:00Z"
  }
}
```

**驗證：**
- userId, userType, fcmToken 為必填
- userType 必須是 'elder' 或 'family_member'

---

#### DELETE /api/fcm/remove
移除 FCM Token

**請求：**
```json
{
  "userId": "auth_user_id",
  "userType": "elder | family_member"
}
```

**回應：**
```json
{
  "message": "FCM Token 移除成功"
}
```

---

### 2. Service 函數（已優化）

**檔案：** `backend/services/fcmService.js`

#### registerFCMToken() - 優化後

```javascript
export async function registerFCMToken(userId, userType, fcmToken, deviceInfo = {}) {
  try {
    const supabase = getSupabase();

    // 嘗試更新 user_profiles 表（新架構 - 優先）
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .update({
        fcm_token: fcmToken,
        fcm_token_updated_at: new Date().toISOString(),
        device_info: deviceInfo,
      })
      .eq('auth_user_id', userId)  // 使用 auth_user_id 匹配
      .select()
      .single();

    if (profileError) {
      console.warn(`⚠️ 更新 user_profiles FCM Token 失敗:`, profileError.message);

      // 如果 user_profiles 更新失敗，嘗試舊架構（向後相容）
      const tableName = userType === 'elder' ? 'elders' : 'family_members';

      const { data, error } = await supabase
        .from(tableName)
        .update({
          fcm_token: fcmToken,
          fcm_token_updated_at: new Date().toISOString(),
          device_info: deviceInfo,
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error(`❌ 更新 FCM Token 失敗 (${tableName}):`, error.message);
        return { success: false, error: error.message };
      }

      console.log(`✅ FCM Token 註冊成功 (${tableName}):`, userId);
      return { success: true, data };
    }

    console.log(`✅ FCM Token 註冊成功 (user_profiles):`, userId);
    return { success: true, data: profileData };
  } catch (error) {
    console.error('❌ 註冊 FCM Token 失敗:', error.message);
    return { success: false, error: error.message };
  }
}
```

#### removeFCMToken() - 優化後

```javascript
export async function removeFCMToken(userId, userType) {
  try {
    const supabase = getSupabase();

    // 嘗試更新 user_profiles 表（新架構 - 優先）
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        fcm_token: null,
        fcm_token_updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', userId);

    if (profileError) {
      // 如果 user_profiles 更新失敗，嘗試舊架構（向後相容）
      const tableName = userType === 'elder' ? 'elders' : 'family_members';

      const { error } = await supabase
        .from(tableName)
        .update({
          fcm_token: null,
          fcm_token_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error(`❌ 移除 FCM Token 失敗 (${tableName}):`, error.message);
        return { success: false, error: error.message };
      }

      console.log(`✅ FCM Token 移除成功 (${tableName}):`, userId);
      return { success: true };
    }

    console.log(`✅ FCM Token 移除成功 (user_profiles):`, userId);
    return { success: true };
  } catch (error) {
    console.error('❌ 移除 FCM Token 失敗:', error.message);
    return { success: false, error: error.message };
  }
}
```

### 優化重點
1. **優先使用新架構**：優先嘗試更新 `user_profiles` 表
2. **向後相容**：如果新架構失敗，回退到舊架構（elders/family_members）
3. **完整的裝置資訊**：支援儲存 device_info 到資料庫
4. **詳細日誌**：記錄所有操作和錯誤，便於除錯

---

## 🚀 部署步驟

### 1. 執行資料庫遷移

在 Supabase SQL Editor 中執行：

```sql
-- 添加 device_info 欄位到 user_profiles 表
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}';

-- 添加註解
COMMENT ON COLUMN public.user_profiles.device_info IS
  'FCM 裝置資訊 (userAgent, platform, language, etc.)';
```

或直接執行檔案：
```bash
# Supabase Dashboard > SQL Editor
# 複製並執行 database/add_device_info_to_user_profiles.sql
```

### 2. 部署後端變更

```bash
# 推送到 Git
git add backend/services/fcmService.js
git commit -m "優化 FCM Token 註冊：支援 user_profiles 表"
git push origin main
```

### 3. 驗證功能

#### 測試步驟 1：使用者登入後自動註冊

1. 開啟瀏覽器開發者工具（F12）
2. 前往 Console 標籤
3. 登入應用程式
4. 觀察 Console 輸出：

**預期輸出：**
```
✅ FCM Token 已取得並儲存
📤 正在註冊 FCM Token 到後端...
   userId: xxx
   userType: elder
   token: cXXX...
✅ FCM Token 註冊成功: { message: "FCM Token 註冊成功", ... }
✅ FCM Token 已成功註冊到後端
```

#### 測試步驟 2：資料庫驗證

在 Supabase SQL Editor 執行：

```sql
-- 檢查 user_profiles 表的 FCM Token
SELECT
  id,
  email,
  display_name,
  fcm_token,
  fcm_token_updated_at,
  device_info
FROM public.user_profiles
WHERE fcm_token IS NOT NULL
ORDER BY fcm_token_updated_at DESC
LIMIT 10;
```

**預期結果：**
- ✅ fcm_token 欄位有值
- ✅ fcm_token_updated_at 是最近時間
- ✅ device_info 包含裝置資訊

#### 測試步驟 3：發送測試推播

```bash
# 使用後端 API 發送測試通知
curl -X POST "https://your-api.com/api/fcm/test-push" \
  -H "Content-Type: application/json" \
  -d '{
    "elderId": "your_elder_id"
  }'
```

**預期結果：**
- ✅ 收到推播通知
- ✅ 後端日誌顯示：`✅ 推送通知發送成功`

---

## 🧪 測試案例

### 測試案例 1：首次登入自動註冊

**步驟：**
1. 清除瀏覽器 localStorage
2. 首次登入應用程式
3. 允許通知權限

**預期結果：**
- ✅ FCM Token 自動取得
- ✅ 自動註冊到後端
- ✅ localStorage 有 fcm_token 和 fcm_token_registered_at
- ✅ 資料庫 user_profiles 表有 FCM Token

### 測試案例 2：未登入時取得 Token

**步驟：**
1. 未登入狀態開啟應用程式
2. FCM 初始化（取得 Token）

**預期結果：**
- ✅ Token 取得成功並儲存到 localStorage
- ⚠️ 後端註冊失敗（使用者未登入）
- ✅ Console 顯示：「使用者未登入，將在登入後註冊 FCM Token」
- ✅ 登入後自動重新註冊

### 測試案例 3：Token 刷新

**步驟：**
1. 已登入並有 Token
2. Token 過期或刷新
3. 重新取得 Token

**預期結果：**
- ✅ 新 Token 自動註冊到後端
- ✅ fcm_token_updated_at 更新為最新時間
- ✅ device_info 更新

### 測試案例 4：多裝置支援

**步驟：**
1. 使用相同帳號在不同裝置登入
2. 每個裝置都取得 FCM Token

**預期結果：**
- ✅ 每個裝置的 Token 都註冊成功
- ⚠️ 注意：目前設計一個使用者只能有一個 Token（最後註冊的會覆蓋）
- 💡 建議：如需多裝置支援，需要建立 fcm_tokens 表（一對多）

### 測試案例 5：向後相容性測試

**步驟：**
1. 在舊架構資料庫（有 elders/family_members 表）測試
2. 登入並註冊 Token

**預期結果：**
- ✅ 優先嘗試 user_profiles 表
- ⚠️ 如果失敗，回退到 elders/family_members 表
- ✅ Token 成功註冊

---

## 🐛 常見問題排除

### 問題 1：Token 註冊失敗

**錯誤訊息：** `❌ FCM Token 註冊失敗`

**可能原因：**
1. 使用者未登入
2. user_profiles 表找不到使用者
3. 網路問題

**解決方法：**
```javascript
// 檢查 Console 日誌
// 1. 確認使用者已登入
// 2. 確認 auth_user_id 正確
// 3. 確認 user_profiles 表有對應記錄

// 手動查詢資料庫
SELECT * FROM user_profiles WHERE auth_user_id = 'xxx';
```

### 問題 2：device_info 欄位不存在

**錯誤訊息：** `column "device_info" does not exist`

**解決方法：**
```sql
-- 執行資料庫遷移
ALTER TABLE public.user_profiles
ADD COLUMN device_info JSONB DEFAULT '{}';
```

### 問題 3：推播通知收不到

**可能原因：**
1. FCM Token 未正確註冊
2. Token 已過期
3. Firebase 配置錯誤

**解決方法：**
```sql
-- 1. 檢查 Token 是否存在
SELECT fcm_token FROM user_profiles WHERE auth_user_id = 'xxx';

-- 2. 檢查 Token 更新時間
SELECT fcm_token_updated_at FROM user_profiles WHERE auth_user_id = 'xxx';

-- 3. 發送測試推播
POST /api/fcm/test-push
```

### 問題 4：重複註冊

**現象：** 每次刷新頁面都重新註冊

**原因：** 正常行為，確保 Token 最新

**優化：**
```javascript
// 可以添加檢查，避免頻繁註冊
const lastRegistered = localStorage.getItem('fcm_token_registered_at');
if (lastRegistered) {
  const timeSinceLastRegister = Date.now() - new Date(lastRegistered).getTime();
  if (timeSinceLastRegister < 3600000) {  // 1 小時內不重複註冊
    console.log('⏭️ 跳過註冊（最近已註冊）');
    return;
  }
}
```

---

## 📊 資料表結構

### user_profiles 表（新架構）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| auth_user_id | UUID | Supabase Auth 使用者 ID |
| fcm_token | TEXT | FCM Token 字串 |
| fcm_token_updated_at | TIMESTAMPTZ | Token 最後更新時間 |
| device_info | JSONB | 裝置資訊 |

### elders 表（舊架構 - 向後相容）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| fcm_token | TEXT | FCM Token 字串 |
| fcm_token_updated_at | TIMESTAMPTZ | Token 最後更新時間 |
| device_info | JSONB | 裝置資訊 |

### family_members 表（舊架構 - 向後相容）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| fcm_token | TEXT | FCM Token 字串 |
| fcm_token_updated_at | TIMESTAMPTZ | Token 最後更新時間 |
| device_info | JSONB | 裝置資訊 |

---

## 📁 變更的檔案

### 修改檔案
1. `backend/services/fcmService.js`
   - Line 350-397: 優化 `registerFCMToken()` 函數
   - Line 406-448: 優化 `removeFCMToken()` 函數

### 新增檔案
1. `database/add_device_info_to_user_profiles.sql`
   - 為 user_profiles 表添加 device_info 欄位

2. `docs/fcm-token-registration-implementation.md`
   - 完整實作文件（本文件）

### 無需修改（已完整）
1. `frontend/public/index.html` (Lines 763-932)
   - FCM Token 註冊邏輯已完整

2. `backend/routes/medicationApi.js` (Lines 846-881)
   - API 端點已完整

---

## 🎉 完成總結

### ✅ 已完成
- [x] 前端 FCM Token 自動取得與註冊
- [x] 後端 API 端點實作
- [x] 後端 Service 函數實作
- [x] 優化為支援新架構（user_profiles）
- [x] 保留向後相容性（elders/family_members）
- [x] 添加 device_info 欄位
- [x] 完整文件與測試指南

### 📝 技術亮點
1. **自動化**：登入後自動註冊，無需手動操作
2. **可靠性**：監聽登入事件，確保 Token 註冊成功
3. **完整性**：記錄詳細的裝置資訊
4. **相容性**：支援新舊兩種資料表架構
5. **可維護性**：詳細的 Console 日誌和錯誤處理

### 🔮 後續建議

#### 優先級 1：多裝置支援
建立 `fcm_tokens` 表支援一個使用者多個裝置：

```sql
CREATE TABLE fcm_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(auth_user_id),
  fcm_token TEXT NOT NULL,
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 優先級 2：Token 有效性檢查
定期檢查並清理無效的 Token：

```javascript
// 每次推播失敗時自動清理無效 Token
if (error.code === 'messaging/invalid-registration-token') {
  await removeFCMToken(userId, userType);
}
```

#### 優先級 3：推播統計
記錄推播發送和接收統計：

```sql
CREATE TABLE push_notifications_log (
  id UUID PRIMARY KEY,
  user_id UUID,
  notification_type TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);
```

---

**實作者：** Claude Code
**審核狀態：** ✅ 完成（已優化）
**文件版本：** 1.0
**最後更新：** 2025-01-21
