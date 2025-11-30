# 社交聊天功能實作文檔

> **實作日期**: 2025-11-29
> **功能**: 一對一聊天訊息資料庫整合
> **狀態**: ✅ 完成

---

## 📋 功能概述

完整實作社交功能中的聊天訊息資料庫整合，包含：

- ✅ 資料庫表結構設計
- ✅ 後端 API 端點（6 個）
- ✅ 前端聊天功能
- ✅ 訊息已讀功能
- ✅ 歷史訊息載入
- ✅ 日期分組顯示

---

## 🗄️ 資料庫結構

### 主要表格：`direct_messages`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| sender_id | UUID | 發送者 (user_profile_id) |
| receiver_id | UUID | 接收者 (user_profile_id) |
| message_text | TEXT | 訊息內容 |
| message_type | VARCHAR(20) | 訊息類型 (text, image, file, voice, video) |
| is_read | BOOLEAN | 是否已讀 |
| read_at | TIMESTAMP | 已讀時間 |
| is_deleted_by_sender | BOOLEAN | 發送者刪除（軟刪除） |
| is_deleted_by_receiver | BOOLEAN | 接收者刪除（軟刪除） |
| reply_to_message_id | UUID | 回覆的訊息 ID |
| metadata | JSONB | 額外資訊 |
| created_at | TIMESTAMP | 建立時間 |
| updated_at | TIMESTAMP | 更新時間 |

### 索引

- `idx_direct_messages_sender` - 發送者索引
- `idx_direct_messages_receiver` - 接收者索引
- `idx_direct_messages_created_at` - 時間索引
- `idx_direct_messages_conversation` - 對話索引
- `idx_direct_messages_unread` - 未讀訊息索引

### 視圖：`v_conversation_list`

提供對話列表（最後一則訊息摘要），包含：
- 最後訊息內容
- 未讀訊息數量
- 對話雙方資訊

### RLS 政策

- ✅ 使用者只能查看自己發送或接收的訊息
- ✅ 使用者只能發送自己的訊息
- ✅ 使用者只能更新自己的訊息（標記已讀、刪除等）

---

## 🔌 後端 API 端點

### 1. GET /api/social/messages/:friendUserId

**功能**: 取得與某個好友的聊天記錄

**參數**:
- `friendUserId` (path) - 好友的 auth user ID
- `userId` (query) - 當前使用者的 auth user ID
- `limit` (query, optional) - 限制返回數量，預設 50
- `before` (query, optional) - 用於分頁，取得此時間之前的訊息

**返回**:
```json
{
  "success": true,
  "messages": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "receiver_id": "uuid",
      "message_text": "訊息內容",
      "message_type": "text",
      "is_read": false,
      "created_at": "2025-11-29T...",
      "sender": {
        "id": "uuid",
        "display_name": "使用者名稱",
        "avatar_url": "...",
        "auth_user_id": "uuid"
      },
      "receiver": { ... }
    }
  ],
  "count": 10,
  "hasMore": false
}
```

### 2. POST /api/social/messages

**功能**: 發送聊天訊息

**請求主體**:
```json
{
  "userId": "auth-user-id",
  "receiverUserId": "auth-user-id",
  "messageText": "訊息內容",
  "messageType": "text",
  "metadata": {}
}
```

**返回**:
```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "sender_id": "uuid",
    "receiver_id": "uuid",
    "message_text": "訊息內容",
    "created_at": "2025-11-29T...",
    "sender": { ... },
    "receiver": { ... }
  }
}
```

### 3. PUT /api/social/messages/:messageId/read

**功能**: 標記單一訊息為已讀

**參數**:
- `messageId` (path) - 訊息 ID

**請求主體**:
```json
{
  "userId": "auth-user-id"
}
```

**返回**:
```json
{
  "success": true,
  "message": "訊息已標記為已讀"
}
```

### 4. PUT /api/social/messages/batch-read

**功能**: 批次標記多則訊息為已讀

**請求主體**:
```json
{
  "userId": "auth-user-id",
  "friendUserId": "auth-user-id"
}
```

**返回**:
```json
{
  "success": true,
  "count": 5,
  "message": "已標記 5 則訊息為已讀"
}
```

### 5. GET /api/social/conversations

**功能**: 取得對話列表（所有有聊天記錄的好友）

**參數**:
- `userId` (query) - 當前使用者的 auth user ID

**返回**:
```json
{
  "success": true,
  "conversations": [
    {
      "last_message_id": "uuid",
      "sender_id": "uuid",
      "receiver_id": "uuid",
      "last_message": "最後一則訊息內容",
      "last_message_type": "text",
      "last_message_at": "2025-11-29T...",
      "unread_count": 3,
      "friend_user_id": "uuid",
      "friend_name": "好友名稱",
      "friend_avatar": "..."
    }
  ],
  "count": 10
}
```

### 6. DELETE /api/social/messages/:messageId

**功能**: 刪除訊息（軟刪除）

**參數**:
- `messageId` (path) - 訊息 ID
- `userId` (query) - 當前使用者的 auth user ID

**返回**:
```json
{
  "success": true,
  "message": "訊息已刪除"
}
```

---

## 💻 前端功能實作

### 已實作的功能

#### 1. `loadChatWithSelf()` - 載入私人速記

```javascript
// frontend/public/social.js:1150
```

**功能**:
- 載入與自己的聊天記錄（私人速記）
- 自動標記已讀
- 顯示歡迎訊息（如果沒有記錄）

#### 2. `loadChatWithFriend(friendUserId, friendName)` - 載入與好友的聊天記錄

```javascript
// frontend/public/social.js:1211
```

**功能**:
- 載入與指定好友的聊天記錄
- 渲染訊息列表
- 自動標記已讀
- 儲存當前聊天對象

#### 3. `sendMessage()` - 發送訊息

```javascript
// frontend/public/social.js:1919
```

**功能**:
- 發送訊息到資料庫
- 即時顯示在聊天室
- 錯誤處理
- 自動清空輸入框

### 輔助函數

#### `renderChatMessages(messages, currentUserId, friendName)`

**功能**: 渲染聊天訊息列表
- 依日期分組
- 顯示日期分隔線
- 區分自己/對方訊息
- 自動滾動到底部

#### `createMessageElement(message, currentUserId)`

**功能**: 創建單一訊息元素
- HTML 轉義
- 時間格式化
- 樣式分類（me / friend）

#### `groupMessagesByDate(messages)`

**功能**: 依日期分組訊息
- 返回按日期分組的訊息物件

#### `formatDateDivider(dateString)`

**功能**: 格式化日期分隔線
- 今天 → "今天"
- 昨天 → "昨天"
- 其他 → "11月29日"

#### `markMessagesAsRead(friendUserId)`

**功能**: 批次標記訊息為已讀
- 自動標記所有未讀訊息
- 靜默執行（不影響 UI）

---

## 📝 使用說明

### 資料庫初始化

1. 在 Supabase 執行 migration SQL:
   ```bash
   # 檔案位置
   database/migrations/add_direct_messages_table.sql
   ```

2. 確認表格和視圖已建立:
   ```sql
   SELECT * FROM public.direct_messages LIMIT 1;
   SELECT * FROM public.v_conversation_list LIMIT 1;
   ```

### 前端測試

1. 登入系統
2. 進入社交頁面 (social.html)
3. 點擊好友開始聊天
4. 發送訊息測試

### API 測試

使用 Postman 或 curl 測試：

```bash
# 1. 取得聊天記錄
curl -X GET "http://localhost:3000/api/social/messages/friend-user-id?userId=my-user-id"

# 2. 發送訊息
curl -X POST "http://localhost:3000/api/social/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "my-user-id",
    "receiverUserId": "friend-user-id",
    "messageText": "Hello!",
    "messageType": "text"
  }'

# 3. 標記已讀
curl -X PUT "http://localhost:3000/api/social/messages/batch-read" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "my-user-id",
    "friendUserId": "friend-user-id"
  }'
```

---

## 🎯 功能特點

### 已實現

- ✅ 完整的一對一聊天
- ✅ 訊息持久化儲存
- ✅ 已讀/未讀狀態
- ✅ 歷史訊息載入
- ✅ 日期分組顯示
- ✅ 私人速記功能
- ✅ 軟刪除機制
- ✅ RLS 安全政策

### 待實作（未來擴展）

- ⏳ 圖片訊息
- ⏳ 語音訊息
- ⏳ 檔案傳送
- ⏳ 訊息回覆功能
- ⏳ 訊息編輯功能
- ⏳ 即時通知（WebSocket / Realtime）
- ⏳ 表情符號支援
- ⏳ 訊息搜尋

---

## 🔧 故障排除

### 問題 1: 訊息無法載入

**檢查事項**:
1. 資料庫表是否已建立
2. RLS 政策是否正確設定
3. 使用者是否已登入
4. API 端點是否正確

**解決方法**:
```sql
-- 檢查 RLS 政策
SELECT * FROM pg_policies WHERE tablename = 'direct_messages';

-- 暫時停用 RLS 測試
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;
```

### 問題 2: 訊息無法發送

**檢查事項**:
1. 網路連線
2. API 端點 URL
3. 使用者 ID 格式
4. 資料庫權限

**調試方法**:
```javascript
// 在 console 查看錯誤
console.log('API_BASE_URL:', API_BASE_URL);
console.log('Current user:', user);
console.log('Current friend:', window.currentChatFriend);
```

### 問題 3: 已讀狀態未更新

**原因**: 可能是批次標記 API 未正確調用

**解決方法**:
```javascript
// 手動觸發標記已讀
await markMessagesAsRead(friendUserId);
```

---

## 📊 效能考量

### 資料庫優化

1. **索引**: 已建立適當的索引以提升查詢效能
2. **分頁**: 支援 `limit` 和 `before` 參數進行分頁載入
3. **軟刪除**: 使用軟刪除避免資料遺失

### 前端優化

1. **虛擬滾動**: 未來可考慮實作虛擬滾動（大量訊息時）
2. **快取**: 可考慮在前端快取最近的訊息
3. **即時更新**: 可整合 Supabase Realtime 實現即時訊息推送

---

## 🔐 安全性

### RLS 政策

- ✅ 使用者只能查看自己的對話
- ✅ 使用者只能發送自己的訊息
- ✅ 防止跨使用者訊息洩漏

### 輸入驗證

- ✅ HTML 轉義防止 XSS
- ✅ 參數驗證防止 SQL Injection（Supabase 處理）
- ✅ 權限檢查防止未授權操作

### 待加強

- ⏳ Rate Limiting（API 請求限制）
- ⏳ 訊息內容過濾（敏感詞彙）
- ⏳ 檔案上傳安全檢查

---

## 📚 相關文檔

- [Supabase 文檔](https://supabase.com/docs)
- [RLS 政策指南](https://supabase.com/docs/guides/auth/row-level-security)
- [社交功能 API 文檔](../backend/routes/socialApi.js)

---

## 🙏 致謝

本功能使用以下技術：

- **資料庫**: Supabase PostgreSQL
- **後端**: Node.js + Express.js
- **前端**: Vanilla JavaScript
- **認證**: Supabase Auth

---

**維護者**: Gilbert
**最後更新**: 2025-11-29
**版本**: v1.0.0
