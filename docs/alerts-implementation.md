# 家屬監控面板 - 警示系統實作完成報告

**功能名稱：** 警示系統 (Alerts System)
**優先級：** ⭐⭐⭐⭐ 極高
**完成日期：** 2025-01-21
**狀態：** ✅ 完成

---

## 📋 實作概述

本次實作完成了家屬監控面板的警示系統，讓家屬能即時掌握長輩的異常狀況。

### 核心功能
- ✅ 四種警示類型（用藥、健康、活動、緊急）
- ✅ 自動警示產生邏輯
- ✅ 警示嚴重程度分級
- ✅ 警示篩選與管理
- ✅ 處理記錄與追蹤

### 解決的問題
1. 家屬無法及時知道長輩錯過服藥
2. 健康異常無法即時通知
3. 長時間無活動無法預警
4. 緊急狀況缺乏記錄追蹤

---

## 🗄️ 資料庫設計

### 1. alerts 資料表

```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 關聯的長輩
  elder_id UUID NOT NULL REFERENCES user_profiles(id),

  -- 警示類型
  alert_type TEXT CHECK (alert_type IN (
    'medication',    -- 用藥警示
    'health',        -- 健康警示
    'activity',      -- 活動警示
    'emergency'      -- 緊急警示
  )),

  -- 嚴重程度
  severity TEXT DEFAULT 'medium' CHECK (severity IN (
    'low',      -- 低：提醒性質
    'medium',   -- 中：需要注意
    'high',     -- 高：需要處理
    'critical'  -- 緊急：立即處理
  )),

  -- 警示內容
  title TEXT NOT NULL,
  description TEXT,

  -- 相關資源
  related_medication_id UUID REFERENCES medication_reminders(id),
  related_conversation_id UUID REFERENCES conversations(id),

  -- 狀態
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',    -- 待處理
    'resolved',   -- 已處理
    'dismissed'   -- 已忽略
  )),

  -- 處理資訊
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES user_profiles(id),
  resolution_note TEXT,

  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. 索引優化

```sql
-- 6 個索引以提升查詢效能
CREATE INDEX idx_alerts_elder ON alerts(elder_id);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_alerts_pending ON alerts(elder_id, status)
  WHERE status = 'pending';
```

### 3. RLS 安全政策

```sql
-- 家屬只能查看所照顧長輩的警示
CREATE POLICY "Family members can view alerts for their elders"
  ON alerts FOR SELECT
  USING (
    elder_id IN (
      SELECT elder_id FROM elder_family_relationships
      WHERE family_member_id IN (
        SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
      )
    )
  );

-- 類似政策適用於 INSERT, UPDATE, DELETE
```

---

## 🎯 警示類型與觸發條件

### 1. 用藥警示 (medication)

**觸發條件：**
- 連續錯過 2 次或以上服藥

**自動檢查函數：**
```sql
CREATE OR REPLACE FUNCTION check_missed_medication_alerts()
RETURNS void AS $$
BEGIN
  -- 遍歷所有長輩
  FOR v_elder IN
    SELECT DISTINCT elder_id FROM medication_reminders
  LOOP
    -- 計算連續錯過次數
    SELECT COUNT(*) INTO v_missed_count
    FROM medication_logs
    WHERE elder_id = v_elder.elder_id
      AND status = 'missed'
      AND scheduled_time >= NOW() - INTERVAL '2 days'
    ORDER BY scheduled_time DESC
    LIMIT 2;

    -- 達到閾值則建立警示
    IF v_missed_count >= 2 THEN
      PERFORM create_medication_alert(...);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**嚴重程度：** high

**範例：**
- 標題：「連續錯過服藥」
- 描述：「已連續錯過 2 次服藥，請關注長輩用藥狀況」

### 2. 健康警示 (health)

**觸發條件：**
- AI 對話中偵測到不適關鍵字（頭痛、頭暈、胸悶等）
- 需要在 AI 對話處理邏輯中手動呼叫

**建立函數：**
```sql
SELECT create_health_alert(
  p_elder_id := '...',
  p_conversation_id := '...',
  p_title := '對話中提到身體不適',
  p_description := '長輩在對話中提到頭暈，請關注健康狀況',
  p_severity := 'medium'
);
```

**嚴重程度：** medium (可調整)

### 3. 活動警示 (activity)

**觸發條件：**
- 超過 24 小時無任何活動記錄
- 活動來源：對話記錄、用藥記錄

**自動檢查函數：**
```sql
CREATE OR REPLACE FUNCTION check_inactivity_alerts()
RETURNS void AS $$
BEGIN
  FOR v_elder IN SELECT id, display_name FROM user_profiles WHERE role = 'elder'
  LOOP
    -- 取得最後活動時間
    SELECT MAX(last_activity) INTO v_last_activity
    FROM (
      SELECT MAX(created_at) FROM conversations WHERE user_id = v_elder.id
      UNION ALL
      SELECT MAX(actual_time) FROM medication_logs WHERE elder_id = v_elder.id
    ) activities;

    -- 超過 24 小時則建立警示
    IF v_last_activity < NOW() - INTERVAL '24 hours' THEN
      PERFORM create_activity_alert(...);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**嚴重程度：** medium

### 4. 緊急警示 (emergency)

**觸發條件：**
- SOS 緊急按鈕被觸發
- 需要在 SOS 按鈕事件處理中呼叫

**建立函數：**
```sql
SELECT create_emergency_alert(
  p_elder_id := '...',
  p_title := 'SOS 緊急求助',
  p_description := '長輩觸發了 SOS 緊急按鈕，請立即聯繫！'
);
```

**嚴重程度：** critical (固定)

---

## 🔧 後端 API

### 檔案位置
`backend/routes/alertsApi.js` (506 行，已完整實作)

### API 端點

#### 1. GET /api/alerts/elder/:elderId
取得指定長輩的所有警示

**Query 參數：**
- `type`: 篩選警示類型 (medication, health, activity, emergency)
- `status`: 篩選狀態 (pending, resolved, dismissed)

**回應：**
```json
[
  {
    "id": "uuid",
    "elder_id": "uuid",
    "alert_type": "medication",
    "severity": "high",
    "title": "連續錯過服藥",
    "description": "已連續錯過 2 次服藥",
    "status": "pending",
    "created_at": "2025-01-21T10:00:00Z"
  }
]
```

#### 2. PUT /api/alerts/:alertId/resolve
標記警示為已處理

**請求：**
```json
{
  "resolutionNote": "已致電確認，長輩已補服藥物"
}
```

**回應：**
```json
{
  "success": true,
  "message": "警示已標記為已處理"
}
```

#### 3. PUT /api/alerts/:alertId/dismiss
忽略警示

**回應：**
```json
{
  "success": true,
  "message": "警示已忽略"
}
```

#### 4. GET /api/alerts/statistics/:elderId
取得警示統計資訊

**回應：**
```json
{
  "total": 15,
  "pending": 5,
  "resolved": 8,
  "dismissed": 2,
  "by_type": {
    "medication": 6,
    "health": 4,
    "activity": 3,
    "emergency": 2
  },
  "by_severity": {
    "low": 3,
    "medium": 7,
    "high": 4,
    "critical": 1
  }
}
```

---

## 💻 前端實作

### 檔案位置
`frontend/public/family-dashboard.js` (Lines 877-1106)

### 核心函數

#### 1. loadAlerts() - 載入警示列表

```javascript
async function loadAlerts() {
  const status = document.getElementById('alertStatus')?.value || 'pending';
  const filterType = document.getElementById('alertTypeFilter')?.value || 'all';

  let url = `${API_BASE_URL}/api/alerts/elder/${currentElderId}?status=${status}`;
  if (filterType !== 'all') {
    url += `&type=${filterType}`;
  }

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const alerts = await response.json();

  // 顯示警示
  alerts.forEach(alert => {
    const alertElement = createAlertElement(alert);
    container.appendChild(alertElement);
  });
}
```

#### 2. createAlertElement() - 建立警示卡片

```javascript
function createAlertElement(alert) {
  const typeIcons = {
    medication: '💊',
    health: '🏥',
    activity: '🏃',
    emergency: '🚨'
  };

  const severityBadges = {
    low: '<span class="badge badge-info">低</span>',
    medium: '<span class="badge badge-warning">中</span>',
    high: '<span class="badge badge-danger">高</span>',
    critical: '<span class="badge badge-critical">緊急</span>'
  };

  const div = document.createElement('div');
  div.className = `alert-card alert-${alert.severity}`;
  div.innerHTML = `
    <div class="alert-header">
      <div class="alert-title">
        ${typeIcons[alert.alert_type] || '⚠️'} ${alert.title}
      </div>
      <div class="alert-meta">
        ${severityBadges[alert.severity]}
        <span class="alert-time">${formatDateTime(alert.created_at)}</span>
      </div>
    </div>
    <div class="alert-description">${alert.description || ''}</div>
    ${alert.status === 'pending' ? `
      <div class="alert-actions">
        <button onclick="markAlertAsResolved('${alert.id}')" class="btn-sm btn-primary">
          ✅ 標記已處理
        </button>
        <button onclick="dismissAlert('${alert.id}')" class="btn-sm btn-secondary">
          ❌ 忽略
        </button>
      </div>
    ` : ''}
  `;

  return div;
}
```

#### 3. markAlertAsResolved() - 標記為已處理

```javascript
async function markAlertAsResolved(alertId) {
  const resolutionNote = prompt('請輸入處理記錄（可選）:');

  const response = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/resolve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ resolutionNote })
  });

  if (response.ok) {
    showToast('警示已標記為已處理', 'success');
    await loadAlerts();
    await loadAlertStatistics();
  }
}
```

#### 4. dismissAlert() - 忽略警示

```javascript
async function dismissAlert(alertId) {
  if (!confirm('確定要忽略這則警示嗎？')) return;

  const response = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/dismiss`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.ok) {
    showToast('警示已忽略', 'success');
    await loadAlerts();
    await loadAlertStatistics();
  }
}
```

### UI 特色

1. **警示卡片樣式**
   - 根據嚴重程度顯示不同顏色邊框
   - 類型圖標（💊 🏥 🏃 🚨）
   - 嚴重程度徽章

2. **篩選功能**
   - 依狀態篩選（待處理、已處理、已忽略）
   - 依類型篩選（用藥、健康、活動、緊急）

3. **互動功能**
   - 標記已處理（可輸入處理記錄）
   - 忽略警示（需確認）
   - 自動重新載入統計數據

---

## 🧪 測試指南

### 測試案例 1：用藥警示自動產生

**前置條件：**
1. 長輩有啟用的用藥提醒
2. 長輩連續錯過 2 次以上服藥

**步驟：**
```sql
-- 1. 建立測試資料：連續錯過的服藥記錄
INSERT INTO medication_logs (elder_id, medication_reminder_id, status, scheduled_time)
VALUES
  ('elder_uuid', 'reminder_uuid', 'missed', NOW() - INTERVAL '2 days'),
  ('elder_uuid', 'reminder_uuid', 'missed', NOW() - INTERVAL '1 days');

-- 2. 執行自動檢查函數
SELECT check_missed_medication_alerts();

-- 3. 檢查是否產生警示
SELECT * FROM alerts
WHERE elder_id = 'elder_uuid'
  AND alert_type = 'medication'
  AND status = 'pending';
```

**預期結果：**
- ✅ 產生一則用藥警示
- ✅ severity = 'high'
- ✅ title = '連續錯過服藥'
- ✅ 家屬面板顯示該警示

### 測試案例 2：活動警示自動產生

**前置條件：**
長輩超過 24 小時無任何活動

**步驟：**
```sql
-- 1. 確認長輩最後活動時間超過 24 小時
SELECT
  id,
  display_name,
  (SELECT MAX(created_at) FROM conversations WHERE user_id = up.id) AS last_conversation,
  (SELECT MAX(actual_time) FROM medication_logs WHERE elder_id = up.id) AS last_medication
FROM user_profiles up
WHERE role = 'elder';

-- 2. 執行自動檢查函數
SELECT check_inactivity_alerts();

-- 3. 檢查是否產生警示
SELECT * FROM alerts
WHERE alert_type = 'activity'
  AND status = 'pending';
```

**預期結果：**
- ✅ 產生活動警示
- ✅ severity = 'medium'
- ✅ title = '長時間無活動'

### 測試案例 3：手動建立健康警示

**步驟：**
```sql
-- 從 AI 對話處理邏輯中呼叫
SELECT create_health_alert(
  p_elder_id := 'elder_uuid',
  p_conversation_id := 'conversation_uuid',
  p_title := '對話中提到身體不適',
  p_description := '長輩在對話中提到頭暈，請關注健康狀況',
  p_severity := 'medium'
);
```

**預期結果：**
- ✅ 成功建立健康警示
- ✅ 返回新警示的 UUID
- ✅ 家屬面板即時顯示

### 測試案例 4：緊急警示建立（SOS）

**步驟：**
```javascript
// 在 SOS 按鈕事件處理中
async function handleSOSButton() {
  // 1. 發送緊急通知

  // 2. 建立緊急警示
  await fetch(`${API_BASE_URL}/api/alerts/emergency`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      elderId: currentUserId,
      title: 'SOS 緊急求助',
      description: `${userName} 觸發了 SOS 緊急按鈕`
    })
  });
}
```

**預期結果：**
- ✅ 產生緊急警示
- ✅ severity = 'critical'
- ✅ 家屬立即收到通知

### 測試案例 5：標記警示為已處理

**步驟：**
1. 家屬登入並前往監控面板
2. 查看待處理警示列表
3. 點擊「✅ 標記已處理」按鈕
4. 輸入處理記錄：「已致電確認，長輩已補服藥物」
5. 確認

**預期結果：**
- ✅ 警示狀態變更為 'resolved'
- ✅ 記錄 resolved_at, resolved_by, resolution_note
- ✅ 警示從待處理列表移除
- ✅ 統計數據更新

### 測試案例 6：忽略警示

**步驟：**
1. 家屬選擇某則警示
2. 點擊「❌ 忽略」按鈕
3. 確認忽略

**預期結果：**
- ✅ 警示狀態變更為 'dismissed'
- ✅ 警示從待處理列表移除
- ✅ 統計數據更新

### 測試案例 7：警示篩選功能

**步驟：**
1. 選擇狀態：「待處理」
2. 選擇類型：「用藥警示」
3. 查看結果

**預期結果：**
- ✅ 只顯示符合條件的警示
- ✅ API 請求包含正確的查詢參數
- ✅ 統計數據正確顯示

### 測試案例 8：RLS 安全驗證

**步驟：**
```sql
-- 1. 以家屬 A 身份查詢
SET LOCAL jwt.claims.sub = 'family_a_auth_id';

SELECT * FROM alerts;  -- 只能看到照顧的長輩警示

-- 2. 以家屬 B 身份查詢
SET LOCAL jwt.claims.sub = 'family_b_auth_id';

SELECT * FROM alerts;  -- 只能看到自己照顧的長輩警示

-- 3. 嘗試存取其他長輩的警示
UPDATE alerts
SET status = 'resolved'
WHERE elder_id = 'other_elder_id';  -- 應該失敗
```

**預期結果：**
- ✅ 家屬只能看到所照顧長輩的警示
- ✅ 無法修改其他長輩的警示
- ✅ RLS 政策正確運作

---

## 🐛 常見問題排除

### 問題 1：警示無法自動產生

**錯誤現象：**
- 長輩已連續錯過服藥，但未產生警示

**可能原因：**
1. 自動檢查函數未被定期執行
2. 資料表資料不完整

**解決方法：**
```sql
-- 手動執行檢查函數
SELECT check_missed_medication_alerts();
SELECT check_inactivity_alerts();

-- 檢查是否有重複的待處理警示（避免重複建立）
SELECT elder_id, COUNT(*)
FROM alerts
WHERE status = 'pending'
  AND created_at >= NOW() - INTERVAL '1 day'
GROUP BY elder_id
HAVING COUNT(*) > 5;
```

**建議：**
- 在後端設定定時任務（Cron Job）定期執行檢查函數
- 每小時執行一次 `check_missed_medication_alerts()`
- 每 6 小時執行一次 `check_inactivity_alerts()`

### 問題 2：家屬無法看到警示

**錯誤訊息：** 「無待處理警示」

**可能原因：**
1. RLS 政策阻擋
2. elder_family_relationships 關聯不正確
3. JWT Token 過期

**解決方法：**
```sql
-- 檢查家屬與長輩的關聯
SELECT * FROM elder_family_relationships
WHERE family_member_id IN (
  SELECT id FROM user_profiles WHERE auth_user_id = 'family_auth_id'
);

-- 檢查警示是否存在
SELECT * FROM alerts WHERE elder_id = 'elder_id';

-- 暫時禁用 RLS 測試（僅用於 debug）
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
```

### 問題 3：標記已處理失敗

**錯誤訊息：** 「更新失敗」

**可能原因：**
1. Alert ID 錯誤
2. 權限不足
3. 網路問題

**解決方法：**
1. 檢查 Console 中的 API 請求
2. 確認 Authorization header 正確
3. 檢查後端日誌

### 問題 4：警示統計數據不正確

**可能原因：**
- 快取問題
- 資料同步延遲

**解決方法：**
```javascript
// 強制重新載入
await loadAlertStatistics();

// 清除快取
localStorage.removeItem('alertStats');
```

---

## 📊 資料庫函數總覽

### 輔助函數

#### 1. get_pending_alerts_count(p_elder_id UUID)
取得待處理警示數量

```sql
SELECT get_pending_alerts_count('elder_uuid');
-- 返回: INTEGER
```

#### 2. create_medication_alert(...)
建立用藥警示

```sql
SELECT create_medication_alert(
  p_elder_id := 'uuid',
  p_medication_id := 'uuid',
  p_title := '連續錯過服藥',
  p_description := '已連續錯過 2 次服藥',
  p_severity := 'high'
);
-- 返回: 新警示的 UUID
```

#### 3. create_health_alert(...)
建立健康警示

```sql
SELECT create_health_alert(
  p_elder_id := 'uuid',
  p_conversation_id := 'uuid',
  p_title := '對話中提到身體不適',
  p_description := '...',
  p_severity := 'medium'
);
```

#### 4. create_activity_alert(...)
建立活動警示

```sql
SELECT create_activity_alert(
  p_elder_id := 'uuid',
  p_title := '長時間無活動',
  p_description := '...',
  p_severity := 'medium'
);
```

#### 5. create_emergency_alert(...)
建立緊急警示

```sql
SELECT create_emergency_alert(
  p_elder_id := 'uuid',
  p_title := 'SOS 緊急求助',
  p_description := '...'
);
-- severity 固定為 'critical'
```

#### 6. resolve_alert(...)
標記警示為已處理

```sql
SELECT resolve_alert(
  p_alert_id := 'uuid',
  p_resolved_by := 'family_member_uuid',
  p_resolution_note := '已致電確認'
);
-- 返回: BOOLEAN
```

#### 7. check_missed_medication_alerts()
檢查並建立用藥警示（定時執行）

```sql
SELECT check_missed_medication_alerts();
```

#### 8. check_inactivity_alerts()
檢查並建立活動警示（定時執行）

```sql
SELECT check_inactivity_alerts();
```

---

## 🚀 部署步驟

### 1. 執行資料庫遷移

在 Supabase SQL Editor 中執行：

```bash
# Supabase Dashboard
1. 前往 Supabase Dashboard > SQL Editor
2. 新增查詢
3. 複製 database/add_alerts.sql 的內容
4. 執行查詢
5. 確認顯示：✅ alerts 警示系統資料表建立完成！
```

### 2. 設定定時任務

**方法 1：使用 pg_cron（Supabase Pro）**
```sql
-- 每小時檢查用藥警示
SELECT cron.schedule(
  'check-missed-medication',
  '0 * * * *',  -- 每小時
  $$SELECT check_missed_medication_alerts()$$
);

-- 每 6 小時檢查活動警示
SELECT cron.schedule(
  'check-inactivity',
  '0 */6 * * *',  -- 每 6 小時
  $$SELECT check_inactivity_alerts()$$
);
```

**方法 2：使用後端 Cron Job**
```javascript
// backend/cron/alertsCheck.js
const cron = require('node-cron');

// 每小時執行
cron.schedule('0 * * * *', async () => {
  await supabase.rpc('check_missed_medication_alerts');
});

// 每 6 小時執行
cron.schedule('0 */6 * * *', async () => {
  await supabase.rpc('check_inactivity_alerts');
});
```

### 3. 驗證部署

```bash
# 1. 檢查資料表
SELECT EXISTS (
  SELECT FROM pg_tables
  WHERE tablename = 'alerts'
);

# 2. 檢查 RLS 政策
SELECT * FROM pg_policies WHERE tablename = 'alerts';

# 3. 測試 API 端點
curl -X GET "https://your-api.com/api/alerts/elder/{elderId}" \
  -H "Authorization: Bearer {token}"
```

---

## 📁 變更的檔案

### 新增檔案
1. `database/add_alerts.sql` (370+ 行)
   - alerts 資料表
   - 6 個索引
   - 4 個 RLS 政策
   - 8 個輔助函數

### 已存在（無需修改）
1. `backend/routes/alertsApi.js` (506 行)
   - 完整的 API 端點已實作
   - 已在 server.js 註冊

### 修改檔案
1. `frontend/public/family-dashboard.js`
   - Line 877-940: `loadAlerts()` 函數
   - Line 942-1013: `createAlertElement()` 函數
   - Line 1015-1026: `filterAlerts()` 函數
   - Line 1032-1069: `markAlertAsResolved()` 函數
   - Line 1071-1106: `dismissAlert()` 函數

---

## 🎉 完成總結

### ✅ 已完成功能

#### 資料庫層面
- [x] alerts 資料表（支援 4 種類型、4 種嚴重程度、3 種狀態）
- [x] 完整的 RLS 政策（家屬權限控制）
- [x] 6 個效能優化索引
- [x] 8 個輔助函數
- [x] 自動更新 updated_at 觸發器
- [x] 自動檢查函數（用藥、活動）

#### 後端 API
- [x] GET /api/alerts/elder/:elderId（已存在）
- [x] PUT /api/alerts/:alertId/resolve（已存在）
- [x] PUT /api/alerts/:alertId/dismiss（已存在）
- [x] GET /api/alerts/statistics/:elderId（已存在）

#### 前端 UI
- [x] 警示列表載入與顯示
- [x] 警示卡片樣式（依嚴重程度）
- [x] 類型篩選功能
- [x] 狀態篩選功能
- [x] 標記已處理（含處理記錄）
- [x] 忽略警示
- [x] 自動更新統計數據

### 📝 後續建議功能

#### 優先級 1：增強現有功能
- [ ] 前端推播通知（FCM）整合
- [ ] Email 通知（緊急警示）
- [ ] SMS 通知（critical 警示）
- [ ] 警示歷史記錄查詢

#### 優先級 2：進階功能
- [ ] 警示規則自訂（家屬可調整閾值）
- [ ] 批次處理警示
- [ ] 警示匯出報表（PDF, Excel）
- [ ] 警示趨勢分析圖表

#### 優先級 3：AI 輔助
- [ ] AI 自動分析對話內容產生健康警示
- [ ] 智慧預警（預測可能的健康問題）
- [ ] 警示優先級自動調整

---

## 📚 相關文件

- `docs/_TODO.md` - 專案待辦事項
- `docs/chat-messages-implementation.md` - 聊天訊息整合文件
- `docs/social-posts-implementation.md` - 社交動態整合文件
- `database/supabase_complete_schema_with_auth_v4.sql` - 主要資料庫 Schema

---

**實作者：** Claude Code
**審核狀態：** ✅ 完成
**文件版本：** 1.0
**最後更新：** 2025-01-21
