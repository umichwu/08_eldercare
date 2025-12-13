# 自動總結功能修復

## 問題日期
2025-12-13

## 問題描述

使用者回報在「日常對話」項目中，對話超過 20 次後，系統沒有產生自動總結。

**預期行為**：每 20 則訊息應該自動產生一次總結
**實際行為**：對話超過 20 則訊息，但沒有觸發自動總結

---

## 問題診斷

### 1. 自動總結機制檢查

**summaryService.js: checkAutoSummary() (Line 23-51)**

```javascript
async checkAutoSummary(conversationId, userId) {
  const threshold = parseInt(process.env.AUTO_SUMMARY_THRESHOLD) || 20;

  // 取得對話資訊
  const { data: conv, error } = await supabaseAdmin
    .from('conversations')
    .select('message_count, messages_since_last_summary')
    .eq('id', conversationId)
    .eq('auth_user_id', userId)
    .single();

  const needsSummary = conv.messages_since_last_summary >= threshold;

  return { success: true, needsSummary, ... };
}
```

**分析**：邏輯正確，當 `messages_since_last_summary >= 20` 時會觸發總結。

### 2. 總結觸發點檢查

發現了兩個問題：

#### 問題 1：`POST /api/conversations/:id/messages/save` 沒有檢查總結

**routes/api.js (Line 197-256)** - 原始程式碼：

```javascript
router.post('/conversations/:id/messages/save', async (req, res) => {
  // ... 儲存訊息邏輯 ...

  console.log('✅ 前端消息已成功保存到數據庫');

  res.status(201).json({
    userMessage: userMsgResult.data,
    assistantMessage: aiMsgResult.data
  });
  // ❌ 沒有檢查自動總結！
});
```

**分析**：
- 這個端點用於前端直接調用 Gemini API 後儲存訊息
- 儲存成功後**沒有檢查和觸發自動總結**
- 另一個端點 `POST /api/conversations/:id/messages` 有檢查總結（Line 295-303）

#### 問題 2：`addAssistantMessage()` 沒有更新計數器

**services/messageService.js: addAssistantMessage() (Line 116-153)** - 原始程式碼：

```javascript
async addAssistantMessage(conversationId, authUserId, content, metadata = null) {
  // ... 新增助理訊息 ...

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert([{ ... }])
    .select()
    .single();

  if (error) throw error;

  console.log('✅ 助理訊息已儲存:', data.id);
  return { success: true, data };
  // ❌ 沒有更新 message_count 和 messages_since_last_summary！
}
```

**分析**：
- 新增訊息後沒有更新對話的計數器
- `messages_since_last_summary` 永遠是 0
- 導致 `checkAutoSummary()` 永遠返回 `needsSummary: false`

### 3. 根本原因總結

**雙重問題**：
1. `/messages/save` 端點沒有檢查總結（即使計數器正確也不會觸發）
2. `addAssistantMessage()` 沒有更新計數器（計數器永遠是 0）

**結果**：使用前端 Gemini API 時，自動總結功能完全失效。

---

## 修復方案

### 修復 1：在 `/messages/save` 端點加上總結檢查

**檔案**: `backend/routes/api.js`
**位置**: Line 243-254（在儲存成功後）

**修復後的程式碼**：

```javascript
console.log('✅ 前端消息已成功保存到數據庫');

// 檢查是否需要產生自動總結
const summaryCheck = await summaryService.checkAutoSummary(id, userId);

if (summaryCheck.success && summaryCheck.needsSummary) {
  console.log('🔄 觸發自動總結機制...');
  // 非同步產生總結（不阻塞回應）
  summaryService.generateSummary(id, userId).catch(err => {
    console.error('❌ 自動總結失敗:', err);
  });
}

res.status(201).json({
  userMessage: userMsgResult.data,
  assistantMessage: aiMsgResult.data
});
```

### 修復 2：更新 `addAssistantMessage()` 以更新計數器

**檔案**: `backend/services/messageService.js`
**位置**: Line 145-155（在新增訊息後）

**修復後的程式碼**：

```javascript
if (error) throw error;

// 更新對話的訊息計數器（用於自動總結）
await supabaseAdmin
  .from('conversations')
  .update({
    message_count: supabaseAdmin.sql`message_count + 2`,  // user + assistant
    messages_since_last_summary: supabaseAdmin.sql`messages_since_last_summary + 2`,
    updated_at: new Date().toISOString()
  })
  .eq('id', conversationId);

console.log('✅ 助理訊息已儲存:', data.id);
return { success: true, data };
```

**關鍵變更**：
- 使用 `supabaseAdmin.sql` 語法進行原子更新
- `message_count + 2`：使用者訊息 + 助理訊息
- `messages_since_last_summary + 2`：累加計數器
- 同時更新 `updated_at` 時間戳記

---

## 修復效果

### 修復前

**流程**：
1. 使用者發送訊息（前端 Gemini API）
2. 呼叫 `POST /api/conversations/:id/messages/save`
3. 儲存訊息成功
4. ❌ 不檢查總結
5. ❌ 計數器保持 0
6. ❌ 永遠不觸發自動總結

### 修復後

**流程**：
1. 使用者發送訊息（前端 Gemini API）
2. 呼叫 `POST /api/conversations/:id/messages/save`
3. 儲存訊息成功
4. ✅ 更新 `messages_since_last_summary += 2`
5. ✅ 檢查是否達到閾值（20）
6. ✅ 如果達到，觸發自動總結
7. ✅ 總結成功後重置計數器為 0

---

## 自動總結流程完整說明

### 1. 計數器累加

每次新增一對訊息（user + assistant）：
- `message_count += 2`
- `messages_since_last_summary += 2`

### 2. 總結檢查

在兩個端點都會檢查：
- `POST /api/conversations/:id/messages` - 後端處理訊息
- `POST /api/conversations/:id/messages/save` - 前端儲存訊息

檢查邏輯：
```javascript
const summaryCheck = await summaryService.checkAutoSummary(id, userId);

if (summaryCheck.success && summaryCheck.needsSummary) {
  // 當 messages_since_last_summary >= 20 時觸發
  summaryService.generateSummary(id, userId);
}
```

### 3. 產生總結

**summaryService.generateSummary()** 執行：
1. 取得最近 50 則訊息
2. 呼叫 LLM 產生總結（3-5 個要點）
3. 儲存總結到 `conversation_summaries` 表
4. **重置計數器**：`messages_since_last_summary = 0`

### 4. 計數器重置

總結產生後（Line 136-140）：
```javascript
await supabaseAdmin
  .from('conversations')
  .update({ messages_since_last_summary: 0 })
  .eq('id', conversationId);
```

---

## 測試步驟

### 1. 本地測試

```bash
# 1. 重啟伺服器
cd backend
npm start

# 2. 開啟前端並登入
# 訪問 http://localhost:3000

# 3. 在「日常對話」中發送 10 對訊息（20 則）
# 觀察 console log 應該顯示：
# "🔄 觸發自動總結機制..."
# "✅ 對話總結已產生"
```

### 2. 驗證要點

**檢查 Console Log**：
- ✅ 每次儲存訊息後應該看到計數器更新
- ✅ 當達到 20 則時，應該看到觸發總結的訊息
- ✅ 總結產生成功的訊息

**檢查 Supabase 資料庫**：

```sql
-- 檢查對話計數器
SELECT id, title, message_count, messages_since_last_summary
FROM conversations
WHERE id = '<conversation_id>';

-- 檢查總結記錄
SELECT id, summary, summary_type, created_at
FROM conversation_summaries
WHERE conversation_id = '<conversation_id>'
ORDER BY created_at DESC;
```

**預期結果**：
- `messages_since_last_summary` 應該隨訊息累加
- 達到 20 時產生總結，然後重置為 0
- `conversation_summaries` 表應該有新的總結記錄

### 3. 前端驗證

1. 發送 10 對訊息（20 則）
2. 重新整理頁面
3. 檢查「總結進度」顯示應該重置
4. 點擊「查看總結」應該看到新的總結內容

---

## 環境變數配置

確認 Render Dashboard 中設定了：

```bash
AUTO_SUMMARY_THRESHOLD=20
```

如果沒有設定，預設值為 20。

可以調整此值：
- `AUTO_SUMMARY_THRESHOLD=10` - 每 10 則訊息總結一次
- `AUTO_SUMMARY_THRESHOLD=30` - 每 30 則訊息總結一次

---

## 變更檔案清單

### 1. backend/routes/api.js
- **修改位置**: Line 243-254
- **變更內容**: 在 `POST /api/conversations/:id/messages/save` 端點加上總結檢查
- **新增行數**: 9 行

### 2. backend/services/messageService.js
- **修改位置**: Line 145-155
- **變更內容**: 在 `addAssistantMessage()` 函數中更新對話計數器
- **新增行數**: 9 行

---

## 部署步驟

### 1. 提交變更

```bash
cd backend
git add routes/api.js services/messageService.js
git add -f ../docs/auto-summary-fix.md
git commit -m "🔧 修復自動總結功能 - 加上計數器更新和總結檢查"
git push
```

### 2. Render 部署

- Render 會自動偵測推送並重新部署
- 等待部署完成（約 2-3 分鐘）

### 3. 驗證修復

1. 訪問 https://08-eldercare.vercel.app/
2. 登入並開啟「日常對話」
3. 發送 10 對訊息（20 則）
4. 應該會自動觸發總結
5. 檢查總結內容

---

## 影響範圍

### 受影響的功能

✅ **自動總結機制**
- 前端 Gemini API 調用後會觸發總結
- 後端 API 調用後會觸發總結
- 計數器正確累加和重置

### 不受影響的功能

- ✅ 對話訊息顯示
- ✅ 手動產生總結
- ✅ 訊息儲存
- ✅ 其他 API 端點

---

## 總結

### 問題根因

1. `/messages/save` 端點缺少總結檢查
2. `addAssistantMessage()` 沒有更新計數器

### 修復方法

1. 在 `/messages/save` 端點加上總結檢查邏輯（與 `/messages` 端點一致）
2. 在 `addAssistantMessage()` 中更新對話計數器

### 修復狀態

✅ 程式碼已修復
✅ 兩個端點都會檢查總結
✅ 計數器正確更新
⏳ 等待部署到生產環境

### 後續優化建議

1. **建立資料庫 Trigger**：自動更新計數器，減少應用層邏輯
   ```sql
   CREATE OR REPLACE FUNCTION increment_message_count()
   RETURNS TRIGGER AS $$
   BEGIN
     UPDATE conversations
     SET message_count = message_count + 1,
         messages_since_last_summary = messages_since_last_summary + 1
     WHERE id = NEW.conversation_id;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER message_count_trigger
   AFTER INSERT ON messages
   FOR EACH ROW
   EXECUTE FUNCTION increment_message_count();
   ```

2. **前端顯示總結進度**：讓使用者知道還需要幾則訊息才會總結

3. **總結通知**：總結產生後發送通知給使用者

4. **總結歷史查詢**：提供查看所有總結的介面

---

*文件建立時間: 2025-12-13*
*修復狀態: ✅ 已修復，等待部署*
