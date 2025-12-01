# 資料庫遷移說明

## 📋 需要執行的 Schema

本專案有以下資料庫 schema 需要執行：

1. **群組聊天功能** - `group_chat_schema.sql`
2. **短期用藥提醒功能** - `short_term_medication_schema.sql`

---

## 🚀 執行方式

### 方式一：Supabase Dashboard（推薦）

1. **開啟 Supabase Dashboard**
   - 前往：https://app.supabase.com/project/oatdjdelzybcacwqafkk
   - 登入您的帳號

2. **開啟 SQL Editor**
   - 左側選單點選 `SQL Editor`
   - 點擊 `New Query`

3. **執行 Schema**

   #### 步驟 1：執行群組聊天 Schema
   ```bash
   # 1. 複製 database/group_chat_schema.sql 的全部內容
   # 2. 貼到 SQL Editor
   # 3. 點擊 Run（或按 Ctrl+Enter）
   # 4. 確認執行成功（查看是否有錯誤訊息）
   ```

   #### 步驟 2：執行短期用藥提醒 Schema
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

這是正常的！SQL 檔案中使用了 `IF NOT EXISTS`、`IF EXISTS` 等語法，重複執行是安全的。

### 2. 執行時出現權限錯誤

請確認：
- 您使用的是 Service Role Key（不是 Anon Key）
- 您在 Supabase Dashboard 已登入有權限的帳號

### 3. `update_updated_at_column()` 函數不存在

您可能需要先建立這個觸發器函數：

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 📞 需要協助？

如果遇到問題，請檢查：
1. Supabase Dashboard 的 Logs（查看錯誤訊息）
2. SQL Editor 的執行結果（紅色表示錯誤）
3. 資料表是否已在 Table Editor 中顯示

---

**最後更新：** 2025-12-01
