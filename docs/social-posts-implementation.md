# 社交動態貼文資料庫整合 - 實作完成報告

**功能名稱：** 動態貼文資料庫整合
**優先級：** ⭐⭐⭐⭐ 高
**完成日期：** 2025-01-21
**狀態：** ✅ 完成

---

## 📋 實作概述

本次實作完成了社交功能中的動態貼文資料庫整合，實現了完整的社交動態系統。

### 發現
- ✅ **前端已完整實作** - loadTimeline(), submitPost(), loadNotifications() 都已呼叫後端 API
- ✅ **後端 API 已完整** - 所有路由都已實作
- ❌ **缺少資料庫表格** - 需要建立 social_posts, post_likes, post_comments, social_notifications

### 解決方案
1. 建立完整的社交動態資料庫 schema
2. 建立相關表格、索引、觸發器
3. 實作 RLS 安全政策
4. 建立輔助視圖和函數

---

## 🗄️ 資料庫變更

### 新增資料表

#### 1. social_posts（動態貼文）

```sql
CREATE TABLE social_posts (
  id UUID PRIMARY KEY,
  user_profile_id UUID REFERENCES user_profiles(id),
  content TEXT NOT NULL,
  mood TEXT,
  visibility TEXT DEFAULT 'friends',  -- public, friends, private
  media_url TEXT,
  media_type TEXT,  -- image, video, audio
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

**功能：**
- 儲存使用者動態貼文
- 支援心情狀態
- 三種可見性：公開、好友、私人
- 自動統計按讚和留言數量
- 軟刪除機制

#### 2. post_likes（按讚）

```sql
CREATE TABLE post_likes (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES social_posts(id),
  user_profile_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_profile_id)
);
```

**功能：**
- 儲存貼文按讚記錄
- 每個使用者對每則貼文只能按讚一次
- 自動觸發 likes_count 更新

#### 3. post_comments（留言）

```sql
CREATE TABLE post_comments (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES social_posts(id),
  user_profile_id UUID REFERENCES user_profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

**功能：**
- 儲存貼文留言
- 支援軟刪除
- 自動觸發 comments_count 更新

#### 4. social_notifications（通知）

```sql
CREATE TABLE social_notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  actor_id UUID REFERENCES user_profiles(id),
  actor_name TEXT,
  actor_avatar TEXT,
  notification_type TEXT,  -- like, comment, friend_request, etc.
  message TEXT,
  post_id UUID REFERENCES social_posts(id),
  comment_id UUID REFERENCES post_comments(id),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**功能：**
- 儲存各類社交通知
- 支援多種通知類型
- 已讀狀態追蹤
- 包含觸發者資訊

---

### 視圖和輔助函數

#### v_post_timeline（動態時間軸視圖）

```sql
CREATE VIEW v_post_timeline AS
SELECT
  p.id,
  p.user_profile_id AS author_id,
  up.display_name AS author_name,
  up.avatar_url AS author_avatar,
  p.content,
  p.mood,
  p.visibility,
  p.media_url,
  p.media_type,
  p.likes_count,
  p.comments_count,
  p.created_at
FROM social_posts p
JOIN user_profiles up ON p.user_profile_id = up.id
WHERE p.deleted_at IS NULL;
```

**功能：**
- 簡化動態查詢
- 自動包含作者資訊
- 過濾已刪除貼文

#### 輔助函數

1. **get_unread_notifications_count(user_profile_id)** - 取得未讀通知數量
2. **create_notification(...)** - 建立通知（簡化通知創建流程）

---

### 自動觸發器

#### 1. 自動更新 updated_at

```sql
CREATE TRIGGER trigger_update_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_posts_updated_at();
```

#### 2. 自動更新按讚數量

```sql
CREATE TRIGGER trigger_post_likes_count
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_post_likes_count();
```

#### 3. 自動更新留言數量

```sql
CREATE TRIGGER trigger_post_comments_count
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comments_count();
```

---

### Row Level Security (RLS)

所有表格都啟用了 RLS，確保資料安全：

#### social_posts 政策
- ✅ 使用者可以查看公開貼文
- ✅ 使用者可以查看自己的貼文
- ✅ 使用者可以查看好友的貼文
- ✅ 使用者只能建立自己的貼文
- ✅ 使用者只能編輯/刪除自己的貼文

#### post_likes 政策
- ✅ 任何人都可以查看按讚
- ✅ 使用者只能按讚為自己
- ✅ 使用者只能取消自己的按讚

#### post_comments 政策
- ✅ 任何人都可以查看留言
- ✅ 使用者只能建立自己的留言
- ✅ 使用者只能編輯/刪除自己的留言

#### social_notifications 政策
- ✅ 使用者只能查看自己的通知
- ✅ 系統可以建立通知
- ✅ 使用者可以標記自己的通知為已讀

---

## 💻 前端和後端狀態

### ✅ 前端已完整實作

#### loadTimeline() - Line 187-239
```javascript
const response = await fetch(`${API_BASE_URL}/api/social/posts/timeline`, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'x-user-id': user.id
  }
});
```

**功能：**
- 從後端 API 載入動態時間軸
- 顯示自己和好友的動態
- 支援分頁載入

#### submitPost() - Line 538-611
```javascript
const response = await fetch(`${API_BASE_URL}/api/social/posts`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'x-user-id': user.id
  },
  body: JSON.stringify({
    content, mood, visibility, mediaUrls
  })
});
```

**功能：**
- 發布新動態到資料庫
- 支援心情和可見性設定
- 支援媒體上傳

#### loadNotifications() - Line 1082-1132
```javascript
const response = await fetch(`${API_BASE_URL}/api/social/notifications`, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'x-user-id': user.id
  }
});
```

**功能：**
- 載入通知列表
- 顯示按讚、留言、好友請求等通知
- 支援已讀/未讀狀態

---

### ✅ 後端 API 已完整實作

#### 動態相關 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/social/posts/timeline` | 取得動態時間軸 |
| POST | `/api/social/posts` | 發布動態 |
| GET | `/api/social/posts/:postId` | 取得單一動態 |
| POST | `/api/social/posts/:postId/like` | 按讚 |
| DELETE | `/api/social/posts/:postId/like` | 取消按讚 |
| GET | `/api/social/posts/:postId/comments` | 取得留言列表 |
| POST | `/api/social/posts/:postId/comments` | 新增留言 |

#### 通知相關 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/social/notifications` | 取得通知列表 |
| PUT | `/api/social/notifications/:id/read` | 標記已讀 |

**檔案位置：** `backend/routes/socialApi.js`

---

## 🚀 部署步驟

### 步驟 1：執行資料庫遷移

在 **Supabase Dashboard** 執行：

1. 前往 Supabase Dashboard
2. 選擇 SQL Editor
3. 新增查詢
4. 複製 `database/add_social_posts.sql` 的完整內容
5. 執行查詢
6. 確認看到：`✅ 社交動態貼文資料表建立完成！`

**注意事項：**
- 確保 `user_profiles` 表已存在
- 確保 `v_user_friends` 視圖已存在（好友關係）
- 執行時間約 10-15 秒

### 步驟 2：推送代碼到 Git

```bash
git add database/add_social_posts.sql
git add docs/social-posts-implementation.md

git commit -m "✨ 實作社交動態貼文資料庫整合

功能：
- 建立 social_posts 資料表（動態貼文）
- 建立 post_likes 資料表（按讚）
- 建立 post_comments 資料表（留言）
- 建立 social_notifications 資料表（通知）
- 建立 v_post_timeline 視圖
- 實作完整的 RLS 政策
- 自動更新統計數量觸發器

特點：
- 前端和後端已完整實作
- 只需執行資料庫遷移即可使用
- 完整的安全性控制
- 自動化統計功能

變更：
- 新增 database/add_social_posts.sql
- 新增 docs/social-posts-implementation.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin08e main
```

### 步驟 3：驗證功能

1. 登入應用程式
2. 前往社交頁面 (`/social.html`)
3. 測試發布動態
4. 測試按讚功能
5. 測試留言功能
6. 查看通知列表

---

## 🧪 測試指南

### 測試案例 1：發布動態

**步驟：**
1. 登入應用程式
2. 前往社交頁面
3. 點擊「發布動態」按鈕
4. 輸入動態內容
5. 選擇心情（可選）
6. 選擇可見性（公開/好友/私人）
7. 點擊「發布」

**預期結果：**
- ✅ 動態成功發布
- ✅ 顯示在動態時間軸頂部
- ✅ 包含發布時間和作者資訊
- ✅ Console 顯示：`✅ 動態發布成功`

### 測試案例 2：查看動態時間軸

**步驟：**
1. 前往社交頁面
2. 查看動態時間軸
3. 滾動查看不同動態

**預期結果：**
- ✅ 顯示自己的動態
- ✅ 顯示好友的動態
- ✅ 顯示公開動態
- ✅ 動態按時間倒序排列
- ✅ 顯示按讚和留言數量

### 測試案例 3：按讚功能

**步驟：**
1. 在動態時間軸找一則動態
2. 點擊愛心按鈕
3. 觀察按讚數量變化
4. 再次點擊取消按讚

**預期結果：**
- ✅ 按讚後愛心變成實心
- ✅ 按讚數量 +1
- ✅ 取消按讚後愛心變空心
- ✅ 按讚數量 -1

### 測試案例 4：留言功能

**步驟：**
1. 在動態時間軸找一則動態
2. 點擊留言圖示
3. 輸入留言內容
4. 點擊發送

**預期結果：**
- ✅ 留言成功發送
- ✅ 留言顯示在動態下方
- ✅ 留言數量 +1
- ✅ 包含留言者資訊和時間

### 測試案例 5：通知功能

**步驟：**
1. 用另一個帳號對你的動態按讚或留言
2. 切換回自己的帳號
3. 點擊通知圖示

**預期結果：**
- ✅ 顯示通知列表
- ✅ 按讚通知：「某某某 按讚了你的動態」
- ✅ 留言通知：「某某某 留言了你的動態」
- ✅ 未讀通知有特殊標記

### 測試案例 6：資料庫驗證

**在 Supabase SQL Editor 執行：**

```sql
-- 查看最近的動態
SELECT
  sp.content,
  up.display_name AS author,
  sp.likes_count,
  sp.comments_count,
  sp.created_at
FROM social_posts sp
JOIN user_profiles up ON sp.user_profile_id = up.id
ORDER BY sp.created_at DESC
LIMIT 5;

-- 查看最近的通知
SELECT
  actor_name,
  notification_type,
  message,
  is_read,
  created_at
FROM social_notifications
ORDER BY created_at DESC
LIMIT 10;

-- 查看按讚統計
SELECT
  sp.content,
  sp.likes_count AS total_likes,
  COUNT(pl.id) AS actual_likes
FROM social_posts sp
LEFT JOIN post_likes pl ON sp.id = pl.post_id
GROUP BY sp.id, sp.content, sp.likes_count
LIMIT 5;
```

---

## 🐛 常見問題排除

### 問題 1：發布動態失敗

**錯誤訊息：** `發布動態失敗`

**可能原因：**
1. 資料表尚未建立
2. RLS 政策阻擋
3. user_profiles 關聯錯誤

**解決方法：**
```sql
-- 檢查資料表是否存在
SELECT tablename FROM pg_tables WHERE tablename = 'social_posts';

-- 檢查 RLS 政策
SELECT * FROM pg_policies WHERE tablename = 'social_posts';

-- 暫時禁用 RLS 測試（僅用於debug）
ALTER TABLE social_posts DISABLE ROW LEVEL SECURITY;
```

### 問題 2：動態時間軸空白

**可能原因：**
1. 沒有任何動態
2. 視圖查詢權限問題
3. 好友關係未建立

**解決方法：**
1. 先發布一則測試動態
2. 檢查 Console 錯誤訊息
3. 確認後端 API 返回結果

### 問題 3：按讚數量不更新

**可能原因：**
- 觸發器未正確建立

**解決方法：**
```sql
-- 檢查觸發器是否存在
SELECT * FROM pg_trigger WHERE tgname LIKE '%likes_count%';

-- 重新建立觸發器
DROP TRIGGER IF EXISTS trigger_post_likes_count ON post_likes;
CREATE TRIGGER trigger_post_likes_count
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_post_likes_count();
```

### 問題 4：通知不顯示

**可能原因：**
1. social_notifications 表無資料
2. RLS 政策阻擋
3. API 路由錯誤

**解決方法：**
```sql
-- 手動建立測試通知
SELECT create_notification(
  (SELECT id FROM user_profiles LIMIT 1),  -- user_id
  (SELECT id FROM user_profiles OFFSET 1 LIMIT 1),  -- actor_id
  'like',
  '測試通知',
  NULL,
  NULL
);
```

---

## 📊 資料表統計

### 表格大小估算

假設 1000 個活躍使用者：

| 表格 | 預估記錄數 | 每筆大小 | 總大小 |
|------|-----------|---------|--------|
| social_posts | ~10,000 | ~1 KB | ~10 MB |
| post_likes | ~50,000 | ~0.1 KB | ~5 MB |
| post_comments | ~20,000 | ~0.5 KB | ~10 MB |
| social_notifications | ~100,000 | ~0.3 KB | ~30 MB |
| **總計** | | | **~55 MB** |

### 索引說明

| 索引名稱 | 表格 | 欄位 | 用途 |
|---------|------|------|------|
| idx_social_posts_user | social_posts | user_profile_id | 快速查詢使用者的貼文 |
| idx_social_posts_created_at | social_posts | created_at DESC | 時間軸排序 |
| idx_post_likes_post | post_likes | post_id | 查詢貼文的按讚列表 |
| idx_notifications_user | social_notifications | user_id | 查詢使用者的通知 |
| idx_notifications_is_read | social_notifications | user_id, is_read | 查詢未讀通知 |

---

## 🎉 完成總結

### ✅ 已完成
- [x] 建立完整的社交動態資料庫 schema
- [x] 實作 4 個核心表格
- [x] 建立完整的 RLS 安全政策
- [x] 實作自動統計觸發器
- [x] 建立輔助視圖和函數
- [x] 前端已完整整合 API
- [x] 後端 API 已完整實作

### 📝 後續可選功能

#### 優先級 1：基礎功能增強
- [ ] 動態編輯功能
- [ ] 動態刪除確認對話框
- [ ] 留言編輯和刪除
- [ ] 按讚列表顯示（誰按了讚）

#### 優先級 2：進階功能
- [ ] @提及使用者功能
- [ ] 動態分享功能
- [ ] 動態收藏功能
- [ ] 圖片/影片上傳（目前只支援 URL）
- [ ] 多圖上傳（目前只支援單圖）

#### 優先級 3：使用者體驗
- [ ] 動態無限滾動載入
- [ ] 即時通知推播
- [ ] 動態草稿儲存
- [ ] 表情符號選擇器
- [ ] GIF 搜尋和插入

---

## 📚 相關文件

- `docs/_TODO.md` - 專案待辦事項
- `docs/SOCIAL_API_DOCUMENTATION.md` - 社交 API 完整文件
- `backend/routes/socialApi.js` - 後端 API 實作
- `frontend/public/social.js` - 前端實作

---

**實作者：** Claude Code
**審核狀態：** ✅ 完成
**文件版本：** 1.0
**最後更新：** 2025-01-21
