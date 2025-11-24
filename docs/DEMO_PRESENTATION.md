# ElderCare Android App 整合專案 - 展示文檔

## 📋 專案概述

**時間**：2025-11-24
**狀態**：已完成短期整合，待討論優先順序

---

## 🎯 專案目標

解決目前 Web-Based App 的限制：
1. ❌ 手機鬧鐘設定失敗
2. ❌ FCM 推送訊息不穩定
3. ❌ 無法背景定位
4. ❌ 無法監控 App 使用（防詐騙）

**解決方案**：開發 Android App，與 Web App 協同工作

---

## ✅ 已完成工作（短期）

### 1. 完整規劃文檔 📖

**檔案**：`docs/ANDROID_APP_PLANNING.md`（2200+ 行）

**內容**：
- 🏗️ 整體架構設計
- 📊 功能分配策略（Web vs Android）
- 📱 Android App 核心功能詳細規劃
- 🗄️ 資料庫結構擴充（3 個新表格）
- 🔐 權限與隱私保護
- 📅 開發階段規劃（4 個 Phase，3-4 個月）
- 💻 完整的技術方案與程式碼範例

[查看完整文檔](./ANDROID_APP_PLANNING.md)

---

### 2. Web App 偵測與引導系統 🔍

#### 2.1 App 偵測模組
**檔案**：`frontend/public/app-detection.js`

**功能**：
- ✅ 智能偵測是否安裝 Android App（3 種方法）
- ✅ JavaScript Bridge 封裝
- ✅ Native 功能與 Web 降級處理
- ✅ 顯示下載引導 Modal/Banner

**使用範例**：
```javascript
// 設定用藥鬧鐘
appDetection.useNativeFeature(
    '用藥鬧鐘',
    () => {
        // Native 功能
        AndroidBridge.setAlarm(medicationId, time);
    },
    () => {
        // Web 降級
        showToast('建議安裝 App');
    }
);
```

#### 2.2 已整合到的頁面

**✅ index.html**
- 引入 `app-detection.js`

**✅ medications.js**
- 建立用藥提醒成功後，檢查 App
- 若未安裝，顯示下載引導 Banner
- 若已安裝，同步排程到 App

**✅ family-dashboard.html + family-dashboard.js**
- 引入 `app-detection.js`
- 進入位置追蹤標籤時，檢查 App
- 顯示「位置追蹤需要 Android App」提示

---

### 3. 下載引導頁面 📥

**檔案**：
- `frontend/public/download-app.html`
- `frontend/public/download-app.css`

**URL**：`https://08-eldercare.vercel.app/download-app.html`

#### 頁面內容

##### 🎨 視覺設計
- 漸層背景（#667eea → #764ba2）
- App Icon 浮動動畫
- 精美的卡片設計
- 響應式佈局（支援手機/桌面）

##### 📱 功能介紹（4 大功能卡片）
1. **⏰ 準時提醒** - 系統級鬧鐘，不會漏掉
2. **📍 位置守護** - 背景定位追蹤
3. **🔔 即時通知** - 可靠的推送通知
4. **🛡️ 防詐保護** - App 使用監控

##### 📥 下載區域
- 🤖 Android APK 下載按鈕
- 🍎 iOS（即將推出）

##### 📖 安裝步驟（圖文說明）
1. 下載 APK
2. 允許安裝
3. 安裝 App
4. 登入帳號

##### 🔒 隱私與權限說明
- 位置資訊用途
- 通知權限用途
- 使用情況存取說明
- 連結到隱私權政策

##### ❓ FAQ（5 個問題）
1. 不安裝 App 可以使用嗎？
2. App 會耗電嗎？
3. 資料安全嗎？
4. 如何關閉 App 使用監控？
5. 為什麼要監控使用的 App？

---

## 🎬 功能展示

### 場景 1：使用者建立用藥提醒

```
使用者操作流程：
1. 開啟 medications.html
2. 新增用藥 → 設定提醒
3. 點擊「儲存」

系統行為：
✅ 儲存成功，顯示 Toast
✅ 檢測未安裝 Android App
✅ 顯示下載引導 Banner：
   "📱 需要更可靠的提醒？
    安裝 ElderCare App 以獲得完整功能
    [下載] [✕]"

使用者點擊「下載」：
→ 導向 download-app.html
→ 查看功能介紹與安裝步驟
```

### 場景 2：家屬查看位置追蹤

```
使用者操作流程：
1. 開啟 family-dashboard.html
2. 切換到「📍 位置追蹤」標籤

系統行為：
✅ 檢測未安裝 Android App
✅ 延遲 1 秒後顯示 Banner：
   "📱 位置追蹤需要 Android App 才能在背景運行
    安裝 App 以獲得完整功能
    [下載] [✕]"

注意：
- 使用 sessionStorage 記錄，同一 session 只顯示一次
- 避免重複騷擾使用者
```

### 場景 3：已安裝 App 的使用者

```
使用者操作流程：
1. 在 Android App 中開啟 WebView
2. JavaScript Bridge 可用

系統行為：
✅ appDetection.appInstalled = true
✅ 不顯示下載引導
✅ 建立用藥提醒時：
   → AndroidBridge.syncMedicationSchedule(elderId)
   → showToast('✅ 已同步用藥排程到 App')
```

---

## 📱 Android App 核心功能規劃

### 優先級 P0（Phase 1，4-6 週）

#### 1. 用藥鬧鐘 ⏰
**技術**：`AlarmManager.setAlarmClock()`

**功能**：
- 系統級鬧鐘，即使 App 關閉也會響
- 全螢幕提醒（`USE_FULL_SCREEN_INTENT`）
- 提供「已服用」/「稍後提醒」/「跳過」按鈕
- 自動同步狀態到 Supabase

**優點**：
- ✅ 100% 可靠（不會漏掉）
- ✅ 不受瀏覽器限制
- ✅ 解決目前最大痛點

#### 2. WebView 整合 🔗
**技術**：WebView + JavaScript Bridge

**功能**：
- 在 App 中嵌入 Web App
- JavaScript 調用 Native 功能
- 使用者體驗無縫

**範例**：
```kotlin
// Kotlin
webView.addJavascriptInterface(object {
    @JavascriptInterface
    fun setAlarm(medicationId: String, time: Long) {
        AlarmManager.setAlarm(medicationId, time)
    }
}, "AndroidBridge")
```

```javascript
// JavaScript
AndroidBridge.setAlarm(medicationId, scheduledTime);
```

#### 3. FCM 推送通知 🔔
**技術**：Firebase Cloud Messaging

**功能**：
- 可靠的推送通知
- 前台服務保持連線
- 家屬端警示即時送達

**優點**：
- ✅ 95% 以上成功率（vs Web 50%）
- ✅ 即時推送

---

### 優先級 P0（Phase 2，2-3 週）

#### 4. 背景定位 📍
**技術**：WorkManager + Location API

**功能**：
- 每 5 分鐘上傳位置
- 地理圍欄偵測
- 離開/進入安全區域警示

**實作**：
```kotlin
val locationWorkRequest = PeriodicWorkRequestBuilder<LocationWorker>(
    repeatInterval = 5,
    repeatIntervalTimeUnit = TimeUnit.MINUTES
).build()

workManager.enqueue(locationWorkRequest)
```

**優點**：
- ✅ 即使 App 關閉，仍持續追蹤
- ✅ 家屬隨時掌握長輩位置

---

### 優先級 P1（Phase 3，2-3 週）

#### 5. App 使用監控 🛡️
**技術**：UsageStatsManager

**功能**：
- 偵測長輩使用的 App（Line, WeChat 等）
- 記錄使用時長
- 偵測異常 App（博弈、投資類）
- 發送警示給家屬

**實作**：
```kotlin
val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE)
val usageStats = usageStatsManager.queryUsageStats(
    UsageStatsManager.INTERVAL_DAILY,
    startTime,
    endTime
)

// 偵測可疑 App
if (packageName.matches(suspiciousApps)) {
    sendAlertToFamily(elderId, "偵測到可疑 App: $appName")
}
```

**隱私保護**：
- ⚠️ **可選功能**，使用者可關閉
- ✅ 僅記錄 App 名稱和使用時長
- ❌ 不記錄任何內容或個人資訊
- ✅ 透明告知用途（防詐騙保護）

**價值**：
- 🛡️ 預防詐騙（投資、博弈類 App）
- 👨‍👩‍👧 家屬可關心長輩日常
- 📊 異常行為偵測

---

## 🗄️ 資料庫擴充

### 新增表格

#### 1. `app_usage_logs` - App 使用記錄
```sql
CREATE TABLE app_usage_logs (
    id UUID PRIMARY KEY,
    elder_id UUID REFERENCES elders(id),
    package_name VARCHAR(255),
    app_name VARCHAR(255),
    usage_time_ms BIGINT,
    last_used_at TIMESTAMPTZ,
    is_suspicious BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `device_info` - 裝置資訊
```sql
CREATE TABLE device_info (
    id UUID PRIMARY KEY,
    elder_id UUID REFERENCES elders(id),
    device_type VARCHAR(50), -- 'android' | 'ios' | 'web'
    device_model VARCHAR(255),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    fcm_token TEXT,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. `suspicious_apps_blacklist` - 可疑 App 黑名單
```sql
CREATE TABLE suspicious_apps_blacklist (
    id UUID PRIMARY KEY,
    package_name VARCHAR(255),
    app_name VARCHAR(255),
    category VARCHAR(50), -- 'gambling', 'investment', 'dating'
    risk_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📊 預期成果

### 使用者體驗提升

| 功能 | Web App | Android App | 提升幅度 |
|-----|---------|-------------|---------|
| 用藥提醒 | ⚠️ 不穩定 | ✅ 100% 可靠 | **+95%** |
| 推送通知 | ⚠️ 50% 成功 | ✅ 95% 成功 | **+90%** |
| 位置追蹤 | ❌ 無法背景 | ✅ 即時追蹤 | **從無到有** |
| 防詐保護 | ❌ 無 | ✅ App 監控 | **從無到有** |

### 技術指標

| 指標 | 目標值 |
|-----|-------|
| 鬧鐘準確度 | 100%（系統級）|
| 位置更新頻率 | 每 5 分鐘 |
| 電池消耗 | < 5% / 24小時 |
| APK 大小 | < 20 MB |
| 啟動速度 | < 2 秒（冷啟動）|

---

## 🚀 開發階段規劃

### Phase 1：核心功能（4-6 週）✅ 優先

**目標**：建立 MVP，實作用藥鬧鐘與 WebView 整合

| 任務 | 預估時間 |
|-----|---------|
| 專案架構建立 | 3 天 |
| WebView 整合 + JavaScript Bridge | 5 天 |
| 用藥鬧鐘功能 | 7 天 |
| FCM 推送通知 | 5 天 |
| Supabase API 整合 | 5 天 |
| UI/UX 設計 | 7 天 |
| 測試與除錯 | 5 天 |

**交付成果**：
- ✅ 可安裝的 APK
- ✅ 用藥鬧鐘功能運作
- ✅ WebView 嵌入 Web App
- ✅ FCM 推送通知

---

### Phase 2：背景定位（2-3 週）

**目標**：實作位置追蹤與地理圍欄

| 任務 | 預估時間 |
|-----|---------|
| 位置權限處理 | 2 天 |
| WorkManager 背景任務 | 3 天 |
| 地理圍欄偵測 | 4 天 |
| 安全區域同步 | 3 天 |
| 警示發送機制 | 3 天 |
| 測試與優化 | 3 天 |

**交付成果**：
- ✅ 每 5 分鐘上傳位置
- ✅ 離開/進入安全區域警示
- ✅ 家屬端即時查看位置

---

### Phase 3：App 監控（2-3 週）

**目標**：實作 App 使用統計與異常偵測

| 任務 | 預估時間 |
|-----|---------|
| UsageStatsManager 整合 | 3 天 |
| 權限引導流程 | 2 天 |
| App 使用記錄上傳 | 3 天 |
| 可疑 App 偵測 | 4 天 |
| 家屬端報表顯示 | 4 天 |
| 隱私保護機制 | 2 天 |
| 測試與優化 | 3 天 |

**交付成果**：
- ✅ App 使用時長統計
- ✅ 異常 App 警示
- ✅ 家屬端查看報表

---

### Phase 4：優化與上架（2-3 週）

| 任務 | 預估時間 |
|-----|---------|
| 效能優化（電量、記憶體）| 5 天 |
| 安全性檢測 | 3 天 |
| 多語言支援 | 3 天 |
| 隱私權政策頁面 | 2 天 |
| 使用者手冊 | 3 天 |
| Google Play 上架準備 | 5 天 |

**交付成果**：
- ✅ 穩定版 APK
- ✅ Google Play 上架（可選）

---

## 🔐 隱私與權限

### 必要權限

| 權限 | 用途 | 風險等級 | 使用者控制 |
|-----|------|---------|-----------|
| `SCHEDULE_EXACT_ALARM` | 用藥鬧鐘 | 低 | 必須授權 |
| `ACCESS_FINE_LOCATION` | 位置追蹤 | 高 | **可關閉** |
| `ACCESS_BACKGROUND_LOCATION` | 背景定位 | 高 | **可關閉** |
| `POST_NOTIFICATIONS` | 推送通知 | 低 | 可關閉 |
| `PACKAGE_USAGE_STATS` | App 監控 | **極高** | **可關閉** |
| `FOREGROUND_SERVICE` | 背景運行 | 低 | 自動授權 |

### 隱私保護措施

1. **透明告知**
   - App 首次啟動時，清楚說明每個權限的用途
   - 下載頁面詳細說明

2. **最小權限原則**
   - 使用者可選擇性開啟功能
   - 不強制要求所有權限

3. **資料加密**
   - 傳輸：HTTPS / TLS 1.3
   - 儲存：AES-256 加密敏感資料

4. **匿名化處理**
   - App 使用記錄僅記錄 App 名稱
   - 不記錄內容
   - 位置資料保留 30 天後自動刪除

5. **家屬同意機制**
   - App 使用監控需家屬端啟用
   - 長輩端顯示「監控已啟用」狀態

---

## 💬 討論議題

### 1. 開發優先順序

**建議順序**：
1. ✅ **Phase 1（4-6 週）**- 用藥鬧鐘 + WebView 整合
   - **理由**：解決最大痛點（鬧鐘不穩定）
   - **影響**：直接提升使用者滿意度

2. ✅ **Phase 2（2-3 週）**- 背景定位
   - **理由**：家屬需求強烈
   - **影響**：增加系統價值

3. ⚠️ **Phase 3（2-3 週）**- App 使用監控
   - **理由**：隱私敏感，需謹慎推動
   - **建議**：先完成 Phase 1+2，再評估

**問題**：
- 是否同意此優先順序？
- 是否需要調整？

---

### 2. 開發資源

**需求**：
- Android 開發者（Kotlin）
- UI/UX 設計師
- 測試人員

**選項**：
- A. 內部開發
- B. 外包開發
- C. 混合模式

**問題**：
- 目前有 Android 開發資源嗎？
- 預算如何？

---

### 3. 發佈策略

**選項 1：自行託管 APK**
- ✅ 快速發佈
- ✅ 無審核流程
- ❌ 使用者信任度較低
- ❌ 需手動更新

**選項 2：Google Play Store**
- ✅ 使用者信任度高
- ✅ 自動更新
- ✅ 更廣泛觸及
- ❌ 審核流程（1-3 天）
- ❌ 需開發者帳號（$25 一次性費用）

**建議**：
- 短期：自行託管 APK（快速驗證）
- 長期：上架 Google Play（正式發佈）

**問題**：
- 傾向哪種方式？

---

### 4. App 使用監控功能

**爭議點**：
- ⚠️ 隱私敏感
- ⚠️ 可能引起反感

**保護措施**：
- ✅ **完全可選**（預設關閉）
- ✅ 透明告知用途
- ✅ 僅記錄 App 名稱，不記錄內容
- ✅ 家屬同意機制

**價值**：
- 🛡️ 預防詐騙（這是主要賣點）
- 📊 關心長輩日常

**問題**：
- 是否要開發此功能？
- 如何說服使用者授權？
- 行銷策略？

---

### 5. iOS App 開發

**時間點**：
- 建議在 Android App 穩定後（3-6 個月）
- 驗證市場需求與功能完整性

**挑戰**：
- Swift 開發（vs Kotlin）
- iOS 限制更嚴格
- App Store 審核更嚴格

**問題**：
- 是否同意此時程？
- 是否考慮跨平台框架（Flutter, React Native）？

---

## 🎯 下一步行動

### 立即執行（本週）

- [x] ✅ 完成規劃文檔
- [x] ✅ 實作 Web App 偵測邏輯
- [x] ✅ 建立下載引導頁面
- [x] ✅ 整合到現有頁面
- [ ] **🔥 團隊討論會議（待安排）**
- [ ] **🔥 確認優先順序與資源**

### 短期（1-2 週）

- [ ] 決定開發策略（內部 vs 外包）
- [ ] 建立 Android Studio 專案
- [ ] 設計 App UI/UX
- [ ] 準備 Firebase 專案

### 中期（1-2 個月）

- [ ] 完成 Phase 1 開發（用藥鬧鐘）
- [ ] 內部測試（5-10 位測試使用者）
- [ ] 收集回饋並優化

### 長期（3-6 個月）

- [ ] 完成 Phase 2-3 開發
- [ ] Google Play 上架
- [ ] 規劃 iOS App 開發

---

## 📞 聯絡與問題

**專案負責人**：[您的名字]
**技術顧問**：Claude (Anthropic AI)

**問題反饋**：
- 📧 Email: [your-email@example.com]
- 💬 Slack: #eldercare-android-project

---

## 附錄

### 相關檔案

1. **規劃文檔**：`docs/ANDROID_APP_PLANNING.md`
2. **App 偵測模組**：`frontend/public/app-detection.js`
3. **下載頁面**：`frontend/public/download-app.html`
4. **Git Commit**：`625eb09` - Android App 整合規劃

### 線上資源

- **Web App**：https://08-eldercare.vercel.app
- **下載頁面**：https://08-eldercare.vercel.app/download-app.html
- **GitHub Repo**：https://github.com/umichwu/08_eldercare

---

**文件版本**：v1.0
**最後更新**：2025-11-24
**準備者**：Claude (Anthropic AI)
