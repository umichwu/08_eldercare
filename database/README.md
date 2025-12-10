# ElderCare 資料庫 Schema

> **✨ 最新版本：v5.1** (2025-01-21)
> 完整整合版本，包含所有功能模組

---

## 📁 當前檔案結構

```
database/
├── supabase_complete_schema_v5.sql ← ⭐ 請使用這個檔案
├── backup/ ← 所有舊版本的備份
└── README.md ← 本文件
```

**🎯 重要：** `database/` 目錄現在只包含一個主 Schema 檔案。
所有舊版本和分散的 SQL 檔案已移至：
- **備份位置：** `database/backup/`
- **歸檔位置：** `docs_delete/`（已整合的舊檔案）

---

## 🚀 快速開始

### 新專案部署

1. 登入 Supabase Dashboard
2. 前往 **SQL Editor**
3. 複製 `supabase_complete_schema_v5.sql` 的內容
4. 貼上並執行
5. ✅ 完成！所有表格、函數、觸發器、RLS 政策都已建立

### 從舊版升級

請參考 `docs/database-consolidation-report.md` 了解升級步驟。

---

## 📋 v5.1 完整功能清單

### 1️⃣ 核心系統（基礎）
- ✅ 使用者認證系統（本地帳號 + Google OAuth）
- ✅ 角色管理（長輩、家屬）
- ✅ 家庭關係管理
- ✅ FCM 推送通知

### 2️⃣ 用藥管理系統
- ✅ 長期用藥管理
- ✅ 短期用藥管理（次數控制、進度追蹤）
- ✅ 用藥提醒（定時通知）
- ✅ 服藥記錄追蹤
- ✅ 藥物圖片上傳

### 3️⃣ AI 對話系統
- ✅ 長輩與 AI 聊天
- ✅ 對話記錄管理
- ✅ 對話摘要生成

### 4️⃣ 心靈照護模組
- ✅ 情緒日誌
- ✅ 靈性內容推薦
- ✅ 心情日記（含圖片）
- ✅ 心靈照護任務
- ✅ 每週心靈報告

### 5️⃣ 地理位置追蹤
- ✅ 位置歷史記錄
- ✅ 安全區域設定
- ✅ 地理圍欄警示
- ✅ 家屬地理位置設定

### 6️⃣ 活動追蹤
- ✅ 長輩活動記錄
- ✅ 家屬查看記錄

### 7️⃣ 社交功能（v5.1 新增）
- ✅ 好友邀請系統
- ✅ 一對一聊天
- ✅ 群組聊天（群組管理、成員權限）
- ✅ 社交貼文（發文、按讚、留言）
- ✅ 社交通知

### 8️⃣ 每日生活提醒（v5.1 新增）
- ✅ 6 種提醒類別
  - 💊 用藥提醒
  - 💧 喝水提醒
  - 🍽️ 飲食提醒
  - 🏃 運動提醒
  - 🏥 回診提醒
  - 😴 睡眠提醒
- ✅ Cron 排程支援
- ✅ 提醒記錄追蹤
- ✅ 家屬通知設定

### 9️⃣ 監控警示系統（v5.1 新增）
- ✅ 4 種警示類型（用藥、健康、活動、緊急）
- ✅ 4 級嚴重程度（低、中、高、緊急）
- ✅ 家屬個人化設定
- ✅ 警示閾值自訂

---

## 📊 資料表總覽

### 總計：39 個資料表

#### 核心使用者表（4 個）
- `user_profiles` - 使用者個人資料（含 device_info）
- `elders` - 長輩資料
- `family_members` - 家屬資料
- `elder_family_relations` - 長輩與家屬關係

#### 對話系統表（3 個）
- `conversations` - AI 對話記錄
- `messages` - 對話訊息
- `conversation_summaries` - 對話摘要

#### 用藥管理表（3 個）
- `medications` - 藥物資料
- `medication_reminders` - 用藥提醒（含 metadata）
- `medication_logs` - 服藥記錄

#### 心靈照護表（4 個）
- `emotional_journals` - 情緒日誌
- `spiritual_contents` - 靈性內容
- `spiritual_care_tasks` - 心靈照護任務
- `spiritual_weekly_reports` - 每週心靈報告

#### 圖片上傳表（4 個）
- `uploaded_images` - 上傳的圖片
- `medication_images` - 藥物圖片
- `mood_diaries` - 心情日記
- `mood_diary_images` - 心情日記圖片
- `image_tags` - 圖片標籤

#### 地理位置表（4 個）
- `safe_zones` - 安全區域
- `location_history` - 位置歷史
- `geofence_alerts` - 地理圍欄警示
- `family_geolocation_settings` - 家屬地理位置設定

#### 活動追蹤表（2 個）
- `elder_activity_tracking` - 長輩活動記錄
- `family_view_logs` - 家屬查看記錄

#### 社交功能表（9 個）⭐ v5.1 新增
- `pending_invitations` - 好友邀請
- `chat_messages` - 聊天訊息（一對一 + 群組）
- `chat_groups` - 聊天群組
- `chat_group_members` - 群組成員
- `chat_group_invites` - 群組邀請
- `social_posts` - 社交貼文
- `post_likes` - 貼文按讚
- `post_comments` - 貼文留言
- `social_notifications` - 社交通知

#### 每日提醒表（3 個）⭐ v5.1 新增
- `reminder_categories` - 提醒類別參考表
- `daily_reminders` - 每日提醒主表
- `daily_reminder_logs` - 每日提醒記錄表

#### 監控警示表（2 個）⭐ v5.1 新增
- `alerts` - 警示表
- `family_settings` - 家屬設定表

---

## 🔐 安全機制

### Row Level Security (RLS)
- ✅ 所有 39 個表都已啟用 RLS
- ✅ 約 95 個 RLS 政策
- ✅ 確保資料存取權限正確

### 權限管理
- ✅ 使用者只能存取自己的資料
- ✅ 家屬可以查看關聯長輩的資料
- ✅ 好友可以查看彼此的公開資訊
- ✅ 群組成員可以查看群組訊息
- ✅ 警示系統家屬權限控制

---

## 🛠️ 技術規格

| 項目 | 數量 |
|------|------|
| **資料表** | 39 個 |
| **函數** | 33 個 |
| **觸發器** | 31 個 |
| **RLS 政策** | ~95 個 |
| **索引** | ~115 個 |
| **總行數** | 3,777 行 |
| **檔案大小** | 145 KB |

---

## 📚 相關文件

### 整合文件
- **整合計畫：** `docs/database-consolidation-plan.md`
- **整合報告：** `docs/database-consolidation-report.md`
- **移動記錄：** `docs_delete/CONSOLIDATION_MOVED_FILES.md`

### Schema 指南
- **Schema 指南：** `docs/database-schema-guide.md`

---

## 📝 版本歷史

| 版本 | 日期 | 更新內容 | 新增表數 |
|------|------|----------|----------|
| **v5.1** | 2025-01-21 | 社交功能、每日提醒、監控警示 | +14 個 |
| v5.0 | 2025-11-29 | 短期用藥、圖片上傳、地理位置 | +10 個 |
| v4.0 | 2025-11-xx | 修正 RLS 政策、整合心靈照護 | - |

---

## ⚠️ 重要注意事項

### ❌ 不要使用的檔案
以下檔案已過時，請勿使用：
- ❌ `supabase_complete_schema_with_auth_v4.sql`（已移至 docs_delete）
- ❌ `add_*.sql`（已整合至 v5.1）
- ❌ `migrations/add_*.sql`（已整合至 v5.1）

### ✅ 請使用
- ✅ **唯一主檔案：** `database/supabase_complete_schema_v5.sql`

### 💾 備份位置
- **完整備份：** `database/backup/`（所有原始檔案）
- **歸檔檔案：** `docs_delete/`（已整合的舊檔案）

---

## 🧪 部署驗證

部署完成後，建議驗證以下項目：

```sql
-- 1. 檢查表數量（應為 39 個）
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public';

-- 2. 檢查 RLS 政策數量
SELECT count(*) FROM pg_policies;

-- 3. 檢查函數數量
SELECT count(*) FROM pg_proc
WHERE pronamespace = 'public'::regnamespace;

-- 4. 檢查觸發器數量
SELECT count(*) FROM pg_trigger
WHERE tgisinternal = false;
```

預期結果：
- 表數量：39
- RLS 政策：~95
- 函數：33
- 觸發器：31

---

## 📞 支援與問題回報

### 遇到問題？

1. **檢查 Supabase Logs**
   - Dashboard → Logs → 查看錯誤訊息

2. **驗證權限**
   - 確保帳號有執行 Schema 的權限

3. **參考文件**
   - `docs/database-consolidation-report.md`
   - `docs_delete/CONSOLIDATION_MOVED_FILES.md`

4. **還原備份**
   - 如需回滾，可從 `database/backup/` 還原

---

## 🎉 總結

ElderCare v5.1 資料庫 Schema 提供完整的長輩照護系統功能，包含：
- 用藥管理
- AI 對話
- 心靈照護
- 社交互動
- 每日提醒
- 監控警示

所有功能已整合在單一 Schema 檔案中，易於部署和維護！

---

**最後更新：** 2025-01-21
**當前版本：** v5.1
**維護者：** ElderCare Development Team
