# 好友邀請重新發送功能實作完成報告

**功能名稱：** 好友邀請重新發送功能
**優先級：** ⭐⭐ 低
**完成日期：** 2025-01-21
**狀態：** ✅ 完成（已存在，僅需優化）

---

## 📋 實作概述

本次實作**驗證並優化**了好友邀請重新發送功能。經過檢查，發現整個功能其實**已經完整實作**，僅需添加資料庫欄位以完善功能。

### 發現
- ✅ 前端 `resendInvitation()` 函數已完整實作
- ✅ 後端 API 端點已完整實作
- ✅ Email/SMS 重新發送功能已整合
- ⚠️ pending_invitations 表可能缺少 `last_sent_at` 欄位

### 優化內容
1. 為 `pending_invitations` 表添加 `last_sent_at` 欄位（如需要）
2. 建立完整的功能文件
3. 測試指南

---

## 🗄️ 資料庫變更

### 新增欄位：pending_invitations.last_sent_at

```sql
ALTER TABLE public.pending_invitations
ADD COLUMN last_sent_at TIMESTAMPTZ;

-- 初始化為創建時間
UPDATE public.pending_invitations
SET last_sent_at = created_at
WHERE last_sent_at IS NULL;
```

**用途：** 記錄邀請最後發送時間，用於：
- 顯示最後發送時間給使用者
- 防止短時間內重複發送
- 統計邀請發送次數

---

## 💻 前端實作（已存在，無需修改）

### 檔案：frontend/public/social.js

#### 重新發送按鈕（Lines 740-742）

```javascript
<button class="btn-secondary btn-sm" onclick="resendInvitation('${pendingInvitation.id}')">
    📤 重新發送
</button>
```

#### resendInvitation() 函數（Lines 879-930）

```javascript
async function resendInvitation(invitationId) {
    try {
        console.log(`📤 重新發送邀請: ${invitationId}`);
        showLoading();

        // 取得當前使用者的 JWT token
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            throw new Error('請先登入');
        }

        // 呼叫後端 API
        const response = await fetch(
            `${API_BASE_URL}/api/social/friends/invitations/${invitationId}/resend`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '重新發送邀請失敗');
        }

        hideLoading();

        // 顯示成功訊息，包含發送結果
        let message = '邀請已重新發送！';
        if (result.notification) {
            const sentMethods = [];
            if (result.notification.emailSent) sentMethods.push('Email');
            if (result.notification.smsSent) sentMethods.push('SMS');
            if (sentMethods.length > 0) {
                message += ` (已透過 ${sentMethods.join(' 和 ')} 發送)`;
            }
        }

        showSuccess(message);

        // 重新載入搜尋結果
        const searchInput = document.getElementById('searchFriends');
        if (searchInput && searchInput.value) {
            await searchFriends();
        }
    } catch (error) {
        console.error('❌ 重新發送邀請失敗:', error);
        hideLoading();
        showError(error.message || '重新發送失敗，請重試');
    }
}
```

**特色：**
- ✅ 完整的錯誤處理
- ✅ Loading 狀態顯示
- ✅ 顯示發送方式（Email/SMS）
- ✅ 自動重新載入搜尋結果
- ✅ JWT Token 驗證

---

## 🔧 後端實作（已存在，無需修改）

### 檔案：backend/routes/socialApi.js

#### POST /api/social/friends/invitations/:invitationId/resend（Lines 583-660）

```javascript
router.post('/friends/invitations/:invitationId/resend', async (req, res) => {
  try {
    // 1. 驗證使用者身份
    const authUserId = await getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { invitationId } = req.params;
    const profileId = await getUserProfileId(authUserId);

    // 2. 取得邀請資料
    const { data: invitation, error: fetchError } = await supabase
      .from('pending_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('inviter_id', profileId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !invitation) {
      return res.status(404).json({ error: '找不到邀請或邀請已失效' });
    }

    // 3. 檢查邀請是否過期
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: '邀請已過期，請建立新邀請' });
    }

    // 4. 取得邀請者資訊
    const { data: inviter } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', profileId)
      .single();

    // 5. 重新發送 Email 或 SMS 通知
    const notificationResults = await sendFriendInvitation({
      email: invitation.invitee_email,
      phone: invitation.invitee_phone,
      inviterName: inviter?.display_name || '使用者',
      invitationCode: invitation.invitation_code,
      message: invitation.invitation_message
    });

    // 6. 更新發送時間
    const { error: updateError } = await supabase
      .from('pending_invitations')
      .update({
        updated_at: new Date().toISOString(),
        last_sent_at: new Date().toISOString()
      })
      .eq('id', invitationId);

    if (updateError) {
      console.warn('更新發送時間失敗:', updateError);
      // 不阻斷執行，因為通知已經發送
    }

    console.log('📨 重新發送邀請結果:', notificationResults);

    // 7. 返回結果
    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        invitationCode: invitation.invitation_code,
        email: invitation.invitee_email,
        phone: invitation.invitee_phone,
        name: invitation.invitee_name
      },
      notification: notificationResults,
      message: '邀請已重新發送'
    });
  } catch (error) {
    console.error('重新發送邀請失敗:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**功能特色：**
1. **身份驗證**：確保只有邀請者可以重新發送
2. **狀態檢查**：驗證邀請有效性和過期時間
3. **通知發送**：透過 Email/SMS 重新發送邀請
4. **時間記錄**：更新 last_sent_at 時間戳記
5. **結果返回**：包含發送成功的方式（Email/SMS）

---

## 🚀 部署步驟

### 1. 執行資料庫遷移（如需要）

在 Supabase SQL Editor 中執行：

```sql
-- 檢查 pending_invitations 表是否存在
SELECT EXISTS (
  SELECT FROM pg_tables
  WHERE tablename = 'pending_invitations'
);

-- 如果存在，添加 last_sent_at 欄位
ALTER TABLE public.pending_invitations
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;

-- 初始化為創建時間
UPDATE public.pending_invitations
SET last_sent_at = created_at
WHERE last_sent_at IS NULL;

-- 添加註解
COMMENT ON COLUMN public.pending_invitations.last_sent_at IS
  '最後發送時間（用於重新發送邀請功能）';
```

或直接執行檔案：
```bash
# Supabase Dashboard > SQL Editor
# 複製並執行 database/add_last_sent_at_to_pending_invitations.sql
```

### 2. 推送到 Git（如有變更）

```bash
git add database/add_last_sent_at_to_pending_invitations.sql
git add docs/friend-invitation-resend-implementation.md
git commit -m "優化好友邀請重新發送功能"
git push origin main
```

### 3. 驗證功能

#### 測試步驟 1：發送邀請

1. 登入應用程式
2. 前往社交頁面
3. 搜尋好友（輸入 Email 或手機）
4. 點擊「發送邀請」

**預期結果：**
- ✅ 邀請發送成功
- ✅ 收到 Email 或 SMS（如果設定正確）

#### 測試步驟 2：重新發送邀請

1. 在待處理邀請列表中找到剛才的邀請
2. 點擊「📤 重新發送」按鈕
3. 觀察結果

**預期結果：**
- ✅ 顯示 Loading 狀態
- ✅ 成功訊息：「邀請已重新發送！(已透過 Email 發送)」
- ✅ 列表自動刷新
- ✅ 收到新的 Email/SMS

#### 測試步驟 3：資料庫驗證

在 Supabase SQL Editor 執行：

```sql
SELECT
  id,
  invitee_email,
  invitee_phone,
  created_at,
  last_sent_at,
  status
FROM pending_invitations
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;
```

**預期結果：**
- ✅ last_sent_at 時間更新為最新
- ✅ last_sent_at >= created_at

---

## 🧪 測試案例

### 測試案例 1：重新發送 Email 邀請

**前置條件：**
- 已有待處理的 Email 邀請

**步驟：**
1. 登入應用程式
2. 前往社交頁面
3. 查看待處理邀請
4. 點擊「📤 重新發送」

**預期結果：**
- ✅ 成功訊息：「邀請已重新發送！(已透過 Email 發送)」
- ✅ 邀請對象收到新的 Email
- ✅ Email 包含邀請碼和連結

---

### 測試案例 2：重新發送 SMS 邀請

**前置條件：**
- 已有待處理的 SMS 邀請
- Twilio 設定正確

**步驟：**
1. 登入應用程式
2. 前往社交頁面
3. 查看待處理邀請
4. 點擊「📤 重新發送」

**預期結果：**
- ✅ 成功訊息：「邀請已重新發送！(已透過 SMS 發送)」
- ✅ 邀請對象收到新的 SMS
- ✅ SMS 包含邀請碼

---

### 測試案例 3：重新發送過期邀請

**前置條件：**
- 已有過期的邀請（expires_at < NOW()）

**步驟：**
1. 登入應用程式
2. 前往社交頁面
3. 嘗試重新發送過期邀請

**預期結果：**
- ✅ 錯誤訊息：「邀請已過期，請建立新邀請」
- ✅ 無法重新發送

---

### 測試案例 4：重新發送他人的邀請

**前置條件：**
- 已知其他人的邀請 ID

**步驟：**
1. 使用者 A 登入
2. 嘗試重新發送使用者 B 的邀請

**預期結果：**
- ✅ 錯誤訊息：「找不到邀請或邀請已失效」
- ✅ 後端驗證阻止操作（inviter_id 檢查）

---

### 測試案例 5：網路錯誤處理

**步驟：**
1. 斷開網路連線
2. 嘗試重新發送邀請

**預期結果：**
- ✅ 顯示錯誤訊息
- ✅ Loading 狀態消失
- ✅ 使用者可以重試

---

## 🐛 常見問題排除

### 問題 1：重新發送失敗

**錯誤訊息：** `重新發送失敗，請重試`

**可能原因：**
1. pending_invitations 表不存在
2. 邀請已過期
3. 網路問題

**解決方法：**
```sql
-- 檢查邀請狀態
SELECT
  id,
  status,
  expires_at,
  created_at
FROM pending_invitations
WHERE id = 'invitation_id';

-- 檢查是否過期
SELECT
  id,
  CASE
    WHEN expires_at < NOW() THEN '已過期'
    ELSE '有效'
  END AS status
FROM pending_invitations;
```

---

### 問題 2：Email/SMS 未收到

**可能原因：**
1. Email/SMS 服務未正確設定
2. 收件地址/號碼錯誤
3. 郵件被標記為垃圾郵件

**解決方法：**
```javascript
// 檢查後端日誌
console.log('📨 重新發送邀請結果:', notificationResults);

// 檢查 notificationResults
{
  emailSent: true/false,
  smsSent: true/false,
  error: '...'
}
```

**Email 未收到：**
- 檢查垃圾郵件夾
- 確認 SendGrid API Key 正確
- 檢查 Email 地址拼寫

**SMS 未收到：**
- 確認 Twilio 設定正確
- 檢查手機號碼格式（需包含國碼）
- 確認 Twilio 帳戶餘額

---

### 問題 3：last_sent_at 未更新

**現象：**
- 重新發送成功，但 last_sent_at 沒有更新

**可能原因：**
- 欄位不存在
- 更新語句失敗

**解決方法：**
```sql
-- 檢查欄位是否存在
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pending_invitations'
  AND column_name = 'last_sent_at';

-- 手動更新測試
UPDATE pending_invitations
SET last_sent_at = NOW()
WHERE id = 'invitation_id';
```

---

### 問題 4：頻繁重新發送

**現象：**
- 使用者短時間內多次點擊重新發送

**建議解決：**

**方法 1：前端防抖**
```javascript
let isResending = false;

async function resendInvitation(invitationId) {
  if (isResending) {
    showWarning('請稍等，正在發送中...');
    return;
  }

  isResending = true;
  try {
    // ... 原有邏輯
  } finally {
    isResending = false;
  }
}
```

**方法 2：後端速率限制**
```javascript
// 檢查最後發送時間
if (invitation.last_sent_at) {
  const timeSinceLastSent = Date.now() - new Date(invitation.last_sent_at).getTime();
  const minimumInterval = 60 * 1000; // 1 分鐘

  if (timeSinceLastSent < minimumInterval) {
    return res.status(429).json({
      error: '發送過於頻繁',
      message: `請等待 ${Math.ceil((minimumInterval - timeSinceLastSent) / 1000)} 秒後再試`
    });
  }
}
```

---

## 📊 pending_invitations 表結構

### 必要欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| inviter_id | UUID | 邀請者 ID (user_profiles.id) |
| invitee_email | TEXT | 受邀者 Email |
| invitee_phone | TEXT | 受邀者手機 |
| invitee_name | TEXT | 受邀者姓名 |
| invitation_code | TEXT | 邀請碼 |
| invitation_message | TEXT | 邀請訊息 |
| status | TEXT | 狀態 (pending, accepted, expired) |
| expires_at | TIMESTAMPTZ | 過期時間 |
| created_at | TIMESTAMPTZ | 創建時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |
| **last_sent_at** | **TIMESTAMPTZ** | **最後發送時間（新增）** |

---

## 📁 變更的檔案

### 新增檔案
1. `database/add_last_sent_at_to_pending_invitations.sql`
   - 為 pending_invitations 表添加 last_sent_at 欄位（如需要）

2. `docs/friend-invitation-resend-implementation.md`
   - 完整實作文件（本文件）

### 無需修改（已完整）
1. `frontend/public/social.js` (Lines 879-930)
   - resendInvitation() 函數已完整

2. `backend/routes/socialApi.js` (Lines 583-660)
   - POST /api/social/friends/invitations/:invitationId/resend 已完整

3. `backend/services/notificationService.js`
   - sendFriendInvitation() 函數已完整

---

## 🎉 完成總結

### ✅ 已完成
- [x] 前端重新發送按鈕 UI（已存在）
- [x] 前端 resendInvitation() 函數（已存在）
- [x] 後端 API 端點（已存在）
- [x] Email/SMS 重新發送邏輯（已存在）
- [x] 發送時間記錄（添加 last_sent_at 欄位）
- [x] 完整測試指南與文件

### 📝 技術亮點
1. **完整驗證**：身份驗證、狀態檢查、過期檢查
2. **多通道支援**：Email 和 SMS 雙管道發送
3. **錯誤處理**：完整的錯誤提示和日誌記錄
4. **使用者體驗**：顯示發送方式、自動刷新列表
5. **安全性**：只允許邀請者重新發送自己的邀請

### 🔮 後續建議

#### 優先級 1：防重複發送
實作頻率限制，防止短時間內多次發送：

```javascript
// 後端檢查
if (invitation.last_sent_at) {
  const timeSinceLastSent = Date.now() - new Date(invitation.last_sent_at).getTime();
  if (timeSinceLastSent < 60000) { // 1 分鐘
    return res.status(429).json({
      error: '發送過於頻繁，請稍後再試'
    });
  }
}
```

#### 優先級 2：發送次數統計
記錄重新發送次數，供分析使用：

```sql
ALTER TABLE pending_invitations
ADD COLUMN resend_count INTEGER DEFAULT 0;

-- 每次重新發送時遞增
UPDATE pending_invitations
SET resend_count = resend_count + 1,
    last_sent_at = NOW()
WHERE id = invitation_id;
```

#### 優先級 3：批量重新發送
允許一次重新發送多個邀請：

```javascript
// POST /api/social/friends/invitations/resend-batch
router.post('/friends/invitations/resend-batch', async (req, res) => {
  const { invitationIds } = req.body;

  const results = await Promise.all(
    invitationIds.map(id => resendSingleInvitation(id))
  );

  res.json({
    success: true,
    results: results
  });
});
```

---

**實作者：** Claude Code
**審核狀態：** ✅ 完成（已存在，已優化）
**文件版本：** 1.0
**最後更新：** 2025-01-21
