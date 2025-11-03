# 👨‍👩‍👧 家屬監控面板使用指南

> 完整的家屬監控功能說明

---

## 📋 目錄

1. [功能概覽](#功能概覽)
2. [主要功能](#主要功能)
3. [使用方式](#使用方式)
4. [權限設定](#權限設定)
5. [API 端點](#api-端點)
6. [未來規劃](#未來規劃)

---

## 功能概覽

家屬監控面板提供給家屬成員使用，讓家屬能夠：
- 👀 即時監控長輩的健康狀況
- 💊 查看用藥記錄和遵從率
- 💬 查看 AI 對話記錄
- ⚠️ 接收異常警示
- 📊 分析健康趨勢

### 存取方式

- **URL**: `/family-dashboard.html`
- **權限**: 僅限 `family_member` 角色
- **快捷入口**: 主頁面快捷按鈕「👨‍👩‍👧 家屬監控」

---

## 主要功能

### 1. 📊 總覽儀表板

#### 關鍵指標卡片

顯示 4 個重要指標：

| 指標 | 說明 | 狀態顏色 |
|------|------|----------|
| 💊 今日用藥遵從率 | 當日服藥準時率 | 綠色(≥80%) / 橘色(60-79%) / 紅色(<60%) |
| 💬 今日對話次數 | 長輩與 AI 的對話次數 | 顯示是否活躍 |
| 🕐 最後活動時間 | 長輩最後使用系統的時間 | 綠色(<6h) / 橘色(6-24h) / 紅色(>24h) |
| ⚠️ 待處理警示 | 未處理的異常通知數量 | 根據警示數量顯示 |

#### 用藥遵從趨勢圖

- 📈 折線圖顯示最近 7 天的用藥遵從率
- 使用 Chart.js 繪製
- 可視化健康趨勢

#### 最近活動列表

- 顯示最近 10 筆活動記錄
- 包含對話時間和訊息數量
- 點擊「查看」可開啟對話詳情

---

### 2. 💊 用藥記錄

#### 功能特色

- **篩選功能**
  - 按狀態：全部 / 已服用 / 已錯過 / 遲服用
  - 按日期：選擇特定日期查看

- **記錄顯示**
  - 藥物名稱和劑量
  - 預定服藥時間
  - 實際服藥時間
  - 狀態標籤（顏色編碼）

- **狀態顏色**
  - ✓ 已服用：綠色
  - ✗ 已錯過：紅色
  - ⚠ 遲服用：橘色
  - ⏳ 待服用：藍色

#### 用藥統計（最近 30 天）

顯示以下統計數據：
- 📊 總計次數
- ✅ 已服用次數
- ⏰ 遲服用次數
- ❌ 已錯過次數
- 📈 總遵從率

---

### 3. 💬 對話記錄

#### 功能特色

- 顯示長輩與 AI 助手的所有對話
- 按時間倒序排列（最新在最上方）
- 顯示對話標題、時間和訊息數量

#### 對話詳情 Modal

點擊「查看詳情」後彈出 Modal，顯示：
- 完整對話內容
- 使用者和 AI 的訊息分別顯示
- 每則訊息的時間戳記
- 支援滾動查看長對話

#### 篩選功能

- 按日期篩選對話
- 手動重新整理

---

### 4. 🔔 警示系統

#### 警示類型

| 類型 | 圖示 | 說明 |
|------|------|------|
| 用藥相關 | 💊 | 錯過服藥、未按時服藥 |
| 健康異常 | 🏥 | 健康數據異常 |
| 活動異常 | 📊 | 長時間無活動 |
| 緊急求助 | 🆘 | 長輩發出求助訊號 |

#### 警示狀態

- **待處理**：需要家屬確認或處理
- **已處理**：已確認並採取行動
- **全部狀態**：顯示所有警示

#### 警示操作

- 查看詳情
- 標記為已處理
- 查看處理記錄

**⚠️ 注意：警示系統目前為開發中功能**

---

## 使用方式

### 登入

1. 使用家屬帳號登入系統
2. 確認個人資料的 `role` 為 `family_member`

### 存取家屬監控面板

**方式一：主頁快捷按鈕**
- 登入後在主頁面
- 點擊「👨‍👩‍👧 家屬監控」按鈕

**方式二：直接訪問**
- 訪問 `/family-dashboard.html`

### 選擇長輩

1. 在頁面頂部的下拉選單中選擇要監控的長輩
2. 系統會自動載入該長輩的資料
3. 可隨時切換不同長輩

### 查看各項資料

1. **總覽** - 預設顯示，查看整體狀況
2. **用藥記錄** - 切換到「💊 用藥記錄」標籤
3. **對話記錄** - 切換到「💬 對話記錄」標籤
4. **警示** - 切換到「🔔 警示」標籤

---

## 權限設定

### 資料庫關聯

家屬需要與長輩建立關聯，透過 `elder_family_relationships` 表：

```sql
-- 範例：建立家屬與長輩的關聯
INSERT INTO elder_family_relationships (
  elder_id,
  family_member_id,
  relationship,
  created_at
) VALUES (
  '<長輩 UUID>',
  '<家屬 UUID>',
  '子女',  -- 關係類型：子女、配偶、親戚等
  NOW()
);
```

### 支援的關係類型

- 子女
- 配偶
- 父母
- 兄弟姐妹
- 親戚
- 照護者
- 其他

### 權限檢查

系統會自動檢查：
1. ✅ 使用者是否為 `family_member` 角色
2. ✅ 使用者是否與長輩有關聯
3. ✅ 使用者是否有權限查看該長輩的資料

如果權限不符，會顯示錯誤訊息並導回主頁。

---

## API 端點

### 1. 取得長輩列表

查詢家屬關聯的所有長輩。

**Supabase 查詢**：
```javascript
const { data, error } = await supabaseClient
  .from('elder_family_relationships')
  .select(`
    elder_id,
    relationship,
    elders (
      id,
      name,
      nickname,
      age,
      phone,
      email
    )
  `)
  .eq('family_member_id', currentFamilyMemberId);
```

### 2. 取得用藥記錄

```
GET /api/medication-logs/elder/:elderId?days=30&status=all
```

**參數**：
- `elderId`: 長輩 UUID（必填）
- `days`: 查詢最近幾天的記錄（預設 30）
- `status`: 狀態篩選（all / taken / missed / late / pending）

**回應範例**：
```json
{
  "success": true,
  "message": "查詢成功",
  "data": [
    {
      "id": "uuid",
      "medication_name": "降血壓藥",
      "dosage": "1 顆",
      "scheduled_time": "2025-11-03T08:00:00Z",
      "taken_at": "2025-11-03T08:05:00Z",
      "status": "taken",
      "notes": null,
      "created_at": "2025-11-02T20:00:00Z"
    }
  ]
}
```

### 3. 取得用藥統計

```
GET /api/medication-logs/statistics/:elderId?days=30
```

**參數**：
- `elderId`: 長輩 UUID（必填）
- `days`: 統計最近幾天（預設 7）

**回應範例**：
```json
{
  "message": "查詢成功",
  "data": {
    "totalLogs": 90,
    "takenCount": 75,
    "lateCount": 10,
    "missedCount": 5,
    "adherenceRate": 94
  }
}
```

### 4. 取得對話記錄

**Supabase 查詢**：
```javascript
const { data, error } = await supabaseClient
  .from('conversations')
  .select('id, title, created_at, updated_at, message_count')
  .eq('user_id', currentElderId)
  .order('created_at', { ascending: false })
  .limit(50);
```

### 5. 取得對話詳情

**Supabase 查詢**：
```javascript
const { data, error } = await supabaseClient
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true });
```

---

## 未來規劃

### 短期（1-2 個月）

#### 🔔 警示系統完善
- [ ] 實作警示資料庫表
- [ ] 自動產生用藥警示
- [ ] 活動異常偵測
- [ ] Email/FCM 推播警示通知

#### 📊 健康數據整合
- [ ] 血壓記錄顯示
- [ ] 血糖記錄顯示
- [ ] 心率監控
- [ ] 健康趨勢圖表

#### 💬 對話分析
- [ ] 情緒分析
- [ ] 關鍵字偵測
- [ ] 異常對話警示
- [ ] 對話摘要

### 中期（3-6 個月）

#### 📱 行動 APP
- [ ] iOS / Android APP
- [ ] 推播通知
- [ ] 離線查看

#### 🤖 AI 輔助
- [ ] 智能健康建議
- [ ] 異常預測
- [ ] 個人化報告

#### 👨‍👩‍👧 多家屬協作
- [ ] 家屬群組
- [ ] 共同照護計畫
- [ ] 任務分配

### 長期（6-12 個月）

#### ⌚ 穿戴裝置整合
- [ ] 智慧手錶數據同步
- [ ] 即時健康監測
- [ ] 跌倒偵測

#### 🏥 醫療整合
- [ ] 醫院系統對接
- [ ] 電子病歷整合
- [ ] 遠距醫療諮詢

---

## 技術架構

### 前端

- **框架**: Vanilla JavaScript
- **UI**: HTML5 + CSS3
- **圖表**: Chart.js 4.4.0
- **資料庫**: Supabase JS Client

### 後端

- **框架**: Node.js + Express
- **資料庫**: PostgreSQL (Supabase)
- **API**: RESTful

### 檔案結構

```
eldercare-app/
├── frontend/public/
│   ├── family-dashboard.html      # 監控面板 HTML
│   ├── family-dashboard.js        # 前端邏輯
│   └── family-dashboard.css       # 樣式
└── backend/routes/
    └── medicationApi.js           # 用藥 API（含新端點）
```

---

## 常見問題

### Q1: 為什麼看不到「家屬監控」按鈕？

**A:** 檢查以下項目：
1. 確認已登入
2. 確認使用者角色為 `family_member`
3. 檢查 `user_profiles` 表的 `role` 欄位
4. 重新整理頁面

### Q2: 顯示「尚未關聯長輩」怎麼辦？

**A:** 需要在資料庫中建立家屬與長輩的關聯：
```sql
INSERT INTO elder_family_relationships (elder_id, family_member_id, relationship)
VALUES ('<長輩ID>', '<家屬ID>', '子女');
```

### Q3: 用藥記錄顯示為空？

**A:** 可能原因：
1. 長輩尚未新增藥物
2. 尚未設定提醒
3. 日期篩選過短（嘗試增加天數）

### Q4: 對話記錄沒有顯示？

**A:** 確認：
1. 長輩是否使用過系統
2. 是否有對話記錄
3. 資料庫連線是否正常

### Q5: 警示功能顯示「功能開發中」？

**A:** 警示系統尚在開發，預計下個版本推出。目前可以：
- 手動查看用藥記錄
- 查看活動狀態
- 關注遵從率

---

## 支援

如有任何問題或建議，請：
1. 查看 [完整文件](COMPLETE_DOCUMENTATION.md)
2. 提交 GitHub Issues
3. 聯繫開發團隊

---

**家屬監控面板，讓您隨時掌握長輩的健康狀況！❤️**
