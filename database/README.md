# 資料庫遷移說明

## 📋 需要執行的 Schema

本專案有以下資料庫 schema 需要執行：

1. **群組聊天功能** - `group_chat_schema.sql`
2. **短期用藥提醒功能** - `short_term_medication_schema.sql`

---

## 🚀 執行方式

### 方式一：Supabase Dashboard（推薦）⭐

#### ⚠️ 重要提示

**請先確認是否已執行過 `social_media_schema.sql`**

- 如果您**已經執行過** `social_media_schema.sql`，`chat_messages` 表已存在
- 執行 `group_chat_schema.sql` 時會自動處理表格衝突（關閉 RLS、刪除舊政策等）
- **這是安全的！** 現有的一對一聊天訊息不會被刪除，只會新增 `group_id` 欄位

#### 執行步驟

1. **開啟 Supabase Dashboard**
   - 前往：https://app.supabase.com/project/oatdjdelzybcacwqafkk
   - 登入您的帳號

2. **開啟 SQL Editor**
   - 左側選單點選 `SQL Editor`
   - 點擊 `New Query`

3. **執行 Schema**

   #### 步驟 1：執行群組聊天 Schema ✅
   ```bash
   # 1. 複製 database/group_chat_schema.sql 的全部內容
   # 2. 貼到 SQL Editor
   # 3. 點擊 Run（或按 Ctrl+Enter）
   # 4. 確認執行成功（查看執行結果）

   # ⚠️ 注意事項：
   # - 執行過程中可能會看到一些 NOTICE 訊息（例如：表格已存在、政策已存在等）
   # - 這些是正常的，不影響執行結果
   # - 只要最後顯示 "Success. No rows returned" 就表示執行成功
   ```

   #### 步驟 2：執行短期用藥提醒 Schema ✅
   ```bash
   # 1. 複製 database/short_term_medication_schema.sql 的全部內容
   # 2. 貼到新的 SQL Editor Query
   # 3. 點擊 Run（或按 Ctrl+Enter）
   # 4. 確認執行成功
   ```

4. **驗證資料表是否建立成功**
   - 左側選單點選 `Table Editor`
   - 應該可以看到以下新表格：
     - ✅ `chat_groups`（群組表）
     - ✅ `chat_group_members`（群組成員表）
     - ✅ `chat_group_invites`（群組邀請表）
     - ✅ `chat_messages` 應該新增了 `group_id` 欄位
     - ✅ `medication_reminders` 應該新增了 `metadata` 欄位（JSONB）

---

### 方式二：使用 psql（進階）

如果您有安裝 PostgreSQL 客戶端：

```bash
# 1. 從 Supabase Dashboard 取得資料庫連線字串
# Settings > Database > Connection string > URI

# 2. 執行 SQL 檔案
psql "postgresql://postgres:[YOUR-PASSWORD]@db.oatdjdelzybcacwqafkk.supabase.co:5432/postgres" \
  -f database/group_chat_schema.sql

psql "postgresql://postgres:[YOUR-PASSWORD]@db.oatdjdelzybcacwqafkk.supabase.co:5432/postgres" \
  -f database/short_term_medication_schema.sql
```

---

## ✅ 驗證清單

執行完成後，請確認：

- [ ] `chat_groups` 表已建立
- [ ] `chat_group_members` 表已建立
- [ ] `chat_group_invites` 表已建立
- [ ] `chat_messages` 表新增了 `group_id` 欄位
- [ ] `chat_messages` 表新增了 `CHECK` 約束（訊息類型檢查）
- [ ] `medication_reminders` 表新增了 `metadata` 欄位（JSONB）
- [ ] RLS 政策已啟用（可在 Authentication > Policies 查看）
- [ ] 觸發器已建立（自動更新 `updated_at`、建立者自動加入群組等）
- [ ] 視圖已建立（`chat_group_stats`、`short_term_medication_reminders`）
- [ ] 函數已建立（`restore_short_term_medication()`、`is_short_term_medication_completed()` 等）

---

## ⚠️ 常見問題

### 1. 執行時出現「already exists」錯誤

**這是正常的！** ✅

- SQL 檔案中使用了 `IF NOT EXISTS`、`IF EXISTS` 等語法
- 重複執行是安全的，不會覆蓋現有資料
- 這些訊息是 PostgreSQL 的 NOTICE，不是錯誤

### 2. 執行時出現 `column "receiver_id" does not exist` 錯誤

**已修復！** ✅（2025-12-01 更新）

- 新版本的 `group_chat_schema.sql` 已使用 `DO $$ BEGIN ... END $$` 區塊
- 會先檢查欄位是否存在再進行修改
- 如果仍遇到此錯誤，請確認您使用的是最新版本的 SQL 檔案

### 3. 執行時出現權限錯誤

請確認：
- 您在 Supabase Dashboard 已登入有權限的帳號
- 使用 SQL Editor 執行（不是透過 API）
- 檢查是否有防火牆或網路限制

### 4. `update_updated_at_column()` 函數不存在

**已包含在 Schema 中！** ✅

- 新版本的 `group_chat_schema.sql` 已自動建立此函數
- 如果仍出現錯誤，可手動執行：

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 5. 執行後發現 `chat_messages` 表的資料消失了

**不會發生！** ✅

- `group_chat_schema.sql` 只會**修改表格結構**（新增 `group_id` 欄位）
- **不會刪除 `chat_messages` 表**或其中的資料
- 所有現有的一對一聊天訊息都會保留

### 6. RLS 政策衝突

如果出現政策名稱衝突，執行以下 SQL 清理：

```sql
-- 刪除舊的群組訊息政策
DROP POLICY IF EXISTS "Group members can view group messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Group members can send group messages" ON public.chat_messages;

-- 然後重新執行 group_chat_schema.sql
```

---

## 📞 需要協助？

如果遇到問題，請檢查：
1. Supabase Dashboard 的 Logs（查看錯誤訊息）
2. SQL Editor 的執行結果（紅色表示錯誤）
3. 資料表是否已在 Table Editor 中顯示

---

**最後更新：** 2025-12-01
