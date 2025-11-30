# 社交聊天功能測試指南 🧪

> **功能**: 一對一聊天訊息資料庫整合
> **測試日期**: 2025-11-29

---

## 🎯 測試前準備

### 1. 資料庫初始化

在 Supabase SQL Editor 執行：

```sql
-- 執行 migration
-- 檔案：database/migrations/add_direct_messages_table.sql
```

**確認檢查**:
```sql
-- 1. 檢查表格是否建立
SELECT COUNT(*) FROM public.direct_messages;

-- 2. 檢查視圖是否建立
SELECT * FROM public.v_conversation_list LIMIT 1;

-- 3. 檢查 RLS 政策
SELECT * FROM pg_policies WHERE tablename = 'direct_messages';

-- 應該看到 3 個政策：
-- - Users can view their own messages
-- - Users can send messages
-- - Users can update their own messages
```

### 2. 部署後端代碼

```bash
# 推送代碼到 Git
git push

# Render 會自動重新部署後端
# 等待部署完成（約 2-3 分鐘）

# 檢查後端健康狀態
curl https://eldercare-backend-8o4k.onrender.com/api/social/health
```

**預期響應**:
```json
{
  "status": "ok",
  "service": "social-api",
  "timestamp": "2025-11-29T..."
}
```

### 3. 部署前端代碼

```bash
# Vercel 會自動重新部署前端
# 等待部署完成（約 1-2 分鐘）

# 訪問網站確認更新
https://08-eldercare.vercel.app/social.html
```

---

## 🧪 功能測試

### 測試 1: 私人速記功能

**步驟**:
1. 登入系統
2. 進入社交頁面（social.html）
3. 點擊左側「📝 私人速記」
4. 在輸入框輸入「測試訊息 1」並發送
5. 再輸入「測試訊息 2」並發送

**預期結果**:
- ✅ 訊息顯示在聊天室
- ✅ 訊息顯示時間
- ✅ 訊息靠右對齊（自己的訊息）
- ✅ 刷新頁面後訊息仍然存在

**檢查資料庫**:
```sql
-- 在 Supabase SQL Editor
SELECT * FROM public.direct_messages
WHERE sender_id = receiver_id
ORDER BY created_at DESC
LIMIT 5;

-- 應該看到剛才發送的 2 則訊息
-- sender_id 和 receiver_id 相同（與自己聊天）
```

---

### 測試 2: 與好友聊天

**前置條件**:
- 需要至少有一個好友

**步驟**:
1. 登入系統
2. 進入社交頁面
3. 點擊左側好友列表中的一個好友
4. 輸入「你好！」並發送
5. 使用另一個帳號登入，回覆「嗨！」
6. 切回第一個帳號，刷新頁面

**預期結果**:
- ✅ 自己的訊息靠右對齊（藍色氣泡）
- ✅ 好友的訊息靠左對齊（灰色氣泡）
- ✅ 顯示日期分隔線（今天/昨天）
- ✅ 刷新後訊息仍然存在
- ✅ 訊息依時間順序排列

**檢查資料庫**:
```sql
-- 查看聊天記錄
SELECT
    dm.id,
    dm.message_text,
    dm.created_at,
    sender.display_name as sender_name,
    receiver.display_name as receiver_name,
    dm.is_read
FROM public.direct_messages dm
LEFT JOIN public.user_profiles sender ON dm.sender_id = sender.id
LEFT JOIN public.user_profiles receiver ON dm.receiver_id = receiver.id
ORDER BY dm.created_at DESC
LIMIT 10;
```

---

### 測試 3: 已讀功能

**步驟**:
1. 使用帳號 A 發送訊息給帳號 B
2. 使用帳號 B 登入
3. 進入社交頁面
4. 點擊帳號 A 的聊天

**預期結果**:
- ✅ 訊息自動標記為已讀
- ✅ 未讀數量減少（如果有顯示）

**檢查資料庫**:
```sql
-- 查看已讀狀態
SELECT
    dm.id,
    dm.message_text,
    dm.is_read,
    dm.read_at,
    sender.display_name as sender_name
FROM public.direct_messages dm
LEFT JOIN public.user_profiles sender ON dm.sender_id = sender.id
WHERE dm.receiver_id = (
    SELECT id FROM public.user_profiles WHERE auth_user_id = 'B的user_id'
)
ORDER BY dm.created_at DESC
LIMIT 5;

-- is_read 應該為 true
-- read_at 應該有時間戳記
```

---

### 測試 4: 歷史訊息載入

**步驟**:
1. 發送至少 10 則訊息
2. 刷新頁面
3. 點擊好友開啟聊天

**預期結果**:
- ✅ 所有訊息正確載入
- ✅ 訊息依時間順序排列
- ✅ 日期分隔線正確顯示
- ✅ 自動滾動到最底部

---

### 測試 5: 對話列表

**API 測試**:
```bash
# 取得對話列表
curl -X GET "https://eldercare-backend-8o4k.onrender.com/api/social/conversations?userId=YOUR_USER_ID"
```

**預期結果**:
```json
{
  "success": true,
  "conversations": [
    {
      "last_message_id": "uuid",
      "friend_user_id": "uuid",
      "friend_name": "好友名稱",
      "friend_avatar": "...",
      "last_message": "最後一則訊息內容",
      "last_message_at": "2025-11-29T...",
      "unread_count": 2
    }
  ],
  "count": 1
}
```

---

## 🔧 API 測試

### 1. 發送訊息

```bash
curl -X POST "https://eldercare-backend-8o4k.onrender.com/api/social/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "receiverUserId": "FRIEND_USER_ID",
    "messageText": "API 測試訊息",
    "messageType": "text"
  }'
```

**預期響應**:
```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "sender_id": "uuid",
    "receiver_id": "uuid",
    "message_text": "API 測試訊息",
    "message_type": "text",
    "is_read": false,
    "created_at": "2025-11-29T...",
    "sender": {
      "id": "uuid",
      "display_name": "你的名字",
      "avatar_url": "...",
      "auth_user_id": "YOUR_USER_ID"
    },
    "receiver": { ... }
  }
}
```

### 2. 取得聊天記錄

```bash
curl -X GET "https://eldercare-backend-8o4k.onrender.com/api/social/messages/FRIEND_USER_ID?userId=YOUR_USER_ID&limit=10"
```

**預期響應**:
```json
{
  "success": true,
  "messages": [
    {
      "id": "uuid",
      "message_text": "訊息內容",
      "created_at": "2025-11-29T...",
      "sender": { ... },
      "receiver": { ... }
    }
  ],
  "count": 10,
  "hasMore": false
}
```

### 3. 批次標記已讀

```bash
curl -X PUT "https://eldercare-backend-8o4k.onrender.com/api/social/messages/batch-read" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "friendUserId": "FRIEND_USER_ID"
  }'
```

**預期響應**:
```json
{
  "success": true,
  "count": 5,
  "message": "已標記 5 則訊息為已讀"
}
```

---

## ⚠️ 常見問題排除

### 問題 1: 訊息無法發送

**可能原因**:
- 資料庫表未建立
- RLS 政策設定錯誤
- 使用者 ID 格式錯誤

**解決方法**:
```sql
-- 暫時停用 RLS 測試
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;

-- 測試完後記得重新啟用
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
```

### 問題 2: 訊息無法載入

**可能原因**:
- API 端點 URL 錯誤
- CORS 問題
- 認證 Token 過期

**解決方法**:
```javascript
// 在瀏覽器 Console 檢查
console.log('API_BASE_URL:', API_BASE_URL);
console.log('Current user:', await supabaseClient.auth.getUser());
```

### 問題 3: 已讀狀態未更新

**可能原因**:
- 批次標記 API 未正確調用
- receiver_id 匹配錯誤

**解決方法**:
```sql
-- 手動更新已讀狀態
UPDATE public.direct_messages
SET is_read = true, read_at = NOW()
WHERE receiver_id = (
    SELECT id FROM public.user_profiles WHERE auth_user_id = 'YOUR_USER_ID'
)
AND sender_id = (
    SELECT id FROM public.user_profiles WHERE auth_user_id = 'FRIEND_USER_ID'
)
AND is_read = false;
```

---

## ✅ 測試檢查清單

### 資料庫

- [ ] direct_messages 表已建立
- [ ] 6 個索引已建立
- [ ] RLS 政策已設定
- [ ] v_conversation_list 視圖已建立
- [ ] 觸發器正常運作

### 後端 API

- [ ] GET /api/social/messages/:friendUserId - 正常
- [ ] POST /api/social/messages - 正常
- [ ] PUT /api/social/messages/:messageId/read - 正常
- [ ] PUT /api/social/messages/batch-read - 正常
- [ ] GET /api/social/conversations - 正常
- [ ] DELETE /api/social/messages/:messageId - 正常

### 前端功能

- [ ] loadChatWithSelf() - 正常
- [ ] loadChatWithFriend() - 正常
- [ ] sendMessage() - 正常
- [ ] 訊息渲染正常
- [ ] 日期分組顯示正常
- [ ] 已讀狀態更新正常
- [ ] 刷新後訊息保持

### 用戶體驗

- [ ] 訊息發送流暢
- [ ] 訊息即時顯示
- [ ] 載入速度快（< 2 秒）
- [ ] 無明顯錯誤提示
- [ ] 響應式設計正常

---

## 📊 效能基準

### 資料庫查詢

- 取得 50 則訊息：< 100ms
- 發送訊息：< 50ms
- 批次標記已讀：< 100ms

### API 響應

- GET /messages：< 200ms
- POST /messages：< 150ms
- PUT /batch-read：< 150ms

### 前端渲染

- 渲染 50 則訊息：< 100ms
- 滾動流暢度：60 FPS
- 記憶體使用：< 50MB

---

## 🎉 測試完成

如果所有測試都通過，表示社交聊天功能已成功實作！

**下一步**:
1. 監控生產環境使用情況
2. 收集使用者回饋
3. 考慮實作進階功能（圖片、語音等）

---

**測試者**: _______________
**測試日期**: _______________
**測試結果**: ⭕ 通過 / ❌ 失敗
**備註**: _______________
