# 📊 ElderCare Database Schema

## 🎯 使用方式

### 方法 1：在 Supabase Dashboard 執行（推薦）

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 左側選單點擊 "SQL Editor"
4. 點擊 "New Query"
5. 複製 `eldercare_complete_schema.sql` 的全部內容
6. 貼上並執行（點擊 "Run" 或按 `Ctrl+Enter`）

### 方法 2：使用 psql 命令列

```bash
psql -h <your-supabase-host> -U postgres -d postgres -f eldercare_complete_schema.sql
```

---

## 📁 檔案說明

### `eldercare_complete_schema.sql` ✅ 使用這個！

**完整整合的資料庫架構**，包含：
- ✅ 使用者認證系統
- ✅ 對話系統（含訊息計數修正）
- ✅ 對話總結功能（單一對話 + 多對話）
- ✅ 快捷功能（天氣、用藥、笑話、健康諮詢）
- ✅ Row Level Security (RLS)
- ✅ 自動化觸發器
- ✅ 範例資料（5 個笑話）

### `supabase_complete_schema_with_auth.sql` ⚠️ 舊版本

這是舊版本的 schema，**建議不要使用**。
已被 `eldercare_complete_schema.sql` 取代。

### `migrations/` 資料夾

已清空。所有 migration 檔案已整合到 `eldercare_complete_schema.sql`。

---

## 🗂️ 資料表清單

### 核心表格（8 個）

1. **user_profiles** - 使用者檔案
2. **elders** - 長輩資料
3. **family_members** - 家屬資料
4. **elder_family_relations** - 家屬-長輩關聯
5. **conversations** - 對話會話
6. **messages** - 對話訊息
7. **conversation_summaries** - 對話總結

### 快捷功能表格（7 個）

8. **weather_queries** - 天氣查詢記錄
9. **medication_reminders** - 用藥提醒
10. **medication_logs** - 用藥記錄
11. **jokes** - 笑話資料庫
12. **joke_logs** - 笑話使用記錄
13. **health_consultations** - 健康諮詢記錄
14. **health_tracking** - 健康追蹤

---

## ✅ 重要功能

### 1. 訊息計數修正
- 新增 `messages_since_last_summary` 欄位
- 自動追蹤自上次總結後的訊息數
- 每 20 條訊息觸發總結提示

### 2. 對話總結改進
- 支援單一對話總結
- 支援多對話匯總
- 新增 `summary_type`、`is_latest`、`token_count` 欄位

### 3. 快捷功能
- 天氣查詢歷史
- 用藥提醒與記錄
- 笑話資料庫（已預載 5 個笑話）
- 健康諮詢與追蹤

---

## 🔄 重新建立資料庫步驟

如果您想要清空並重新建立所有表格：

1. **備份現有資料**（如果需要）
   ```sql
   -- 在 Supabase SQL Editor 執行
   SELECT * FROM user_profiles;
   SELECT * FROM conversations;
   -- 複製結果並儲存
   ```

2. **執行完整 Schema**
   - 開啟 `eldercare_complete_schema.sql`
   - 全選並複製
   - 在 Supabase SQL Editor 貼上並執行

3. **驗證**
   ```sql
   -- 檢查表格是否建立成功
   SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

   -- 檢查笑話是否插入
   SELECT COUNT(*) FROM jokes;  -- 應該顯示 5
   ```

---

## ⚠️ 注意事項

### 執行前
- ✅ 這個 SQL 會**刪除所有現有表格**
- ✅ 確保您已備份重要資料
- ✅ 建議在開發環境先測試

### 執行後
- ✅ 所有表格都會啟用 RLS
- ✅ 觸發器會自動設定
- ✅ 5 個範例笑話會自動插入

### RLS 注意事項
- Backend 使用 `supabaseAdmin` 繞過 RLS
- Frontend 需要登入才能存取資料
- 家屬可以查看關聯長輩的資料

---

## 🔧 常見問題

### Q: 執行 SQL 時出現錯誤怎麼辦？

**A:** 分段執行
1. 先執行 STEP 1（清理）
2. 再執行 STEP 2（擴展）
3. 依序執行其他 STEP

### Q: 我想保留部分資料怎麼辦？

**A:**
1. 先備份：`SELECT * FROM your_table;`
2. 執行 schema
3. 重新插入資料：`INSERT INTO your_table ...`

### Q: 我只想更新特定表格？

**A:** 從 `eldercare_complete_schema.sql` 複製相關的 `CREATE TABLE` 部分執行

---

## 📝 版本歷史

### v3.0 (2025-10-24) - 目前版本
- ✅ 整合所有 migration 檔案
- ✅ 新增快捷功能表格
- ✅ 修正訊息計數邏輯
- ✅ 改進對話總結功能

### v2.0 (2025-10-21)
- 原始 `supabase_complete_schema_with_auth.sql`

---

## 🎉 部署後檢查清單

執行完 schema 後，請確認：

- [ ] 15 個表格全部建立成功
- [ ] RLS 政策已啟用
- [ ] 觸發器正常運作
- [ ] 範例笑話已插入（5 個）
- [ ] Backend API 可以正常連接
- [ ] Frontend 可以正常登入和聊天

---

**建議**：將 `eldercare_complete_schema.sql` 納入版本控制（Git），方便日後還原或部署到其他環境。
