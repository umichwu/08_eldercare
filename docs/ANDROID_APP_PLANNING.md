# ElderCare Android App 整合規劃

## 📋 專案概述

**目標**：開發 Android App 解決 Web-Based App 的限制，同時保持 Web App 的完整功能。

**核心原則**：
- ✅ Web App 保持完整功能，向後兼容
- ✅ Android App 提供增強功能（鬧鐘、背景定位、App 使用監控）
- ✅ 無縫整合，資料同步透過 Supabase
- ✅ 漸進式引導使用者下載 Android App

---

## 🏗️ 整體架構

```
┌─────────────────────────────────────────────────────────┐
│                    使用者裝置                              │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Web-Based App   │         │   Android App    │     │
│  │  (瀏覽器)         │◄───────►│  (Native APK)    │     │
│  │                  │  互補    │                  │     │
│  │  - 基本功能      │         │  - 增強功能      │     │
│  │  - 用藥管理      │         │  - 鬧鐘提醒      │     │
│  │  - AI 對話       │         │  - 背景定位      │     │
│  │  - 家屬監控      │         │  - FCM 推送      │     │
│  └──────────────────┘         │  - App 監控      │     │
│           │                    └──────────────────┘     │
│           │                             │                │
└───────────┼─────────────────────────────┼────────────────┘
            │                             │
            │        Supabase API         │
            └─────────────┬───────────────┘
                          │
                ┌─────────▼─────────┐
                │   Supabase DB     │
                │                   │
                │  - 用藥記錄       │
                │  - 位置歷史       │
                │  - App 使用記錄   │
                │  - FCM Tokens     │
                └───────────────────┘
```

---

## 🎯 功能分配策略

### 📱 Web-Based App（現有功能，保持不變）

| 功能模組 | 說明 | 使用場景 |
|---------|------|---------|
| 用藥管理 | 新增/編輯/刪除用藥 | 家屬或長輩設定用藥 |
| AI 對話 | Claude 智能助手 | 長輩日常健康諮詢 |
| 用藥時間軸 | 顯示每日用藥排程 | 長輩查看今日用藥 |
| 家屬監控 | 用藥遵從率、對話記錄 | 家屬遠端監控 |
| 位置管理 | 安全區域設定 | 家屬設定地理圍欄 |
| Google 登入 | OAuth 認證 | 使用者註冊/登入 |

**優點**：
- ✅ 跨平台（Android、iOS、桌面）
- ✅ 無需安裝，即開即用
- ✅ 適合家屬在電腦上管理

**限制**：
- ❌ 無法設定系統鬧鐘
- ❌ 背景執行受限（瀏覽器關閉後停止）
- ❌ FCM 推送不穩定
- ❌ 無法監控其他 App 使用情況

---

### 📲 Android App（新增增強功能）

#### 核心功能模組

| 功能模組 | 優先級 | 說明 | 技術方案 |
|---------|-------|------|---------|
| **1. 用藥鬧鐘** | P0 | 系統級鬧鐘提醒 | AlarmManager + RTC_WAKEUP |
| **2. 背景定位** | P0 | 每 5 分鐘上傳位置 | WorkManager + Location API |
| **3. FCM 推送** | P0 | 可靠的推送通知 | Firebase Cloud Messaging |
| **4. App 使用監控** | P1 | 偵測使用的 App | UsageStatsManager |
| **5. WebView 整合** | P0 | 嵌入 Web App | WebView + JavaScript Bridge |
| **6. 前台服務** | P0 | 保持背景運行 | Foreground Service |

#### 詳細功能規劃

##### 1️⃣ 用藥鬧鐘 (Medication Alarm)

**功能**：
- 從 Supabase 同步用藥排程
- 設定系統級鬧鐘（即使 App 關閉也會響）
- 鬧鐘響起時顯示全螢幕提醒
- 提供「已服用」/「稍後提醒」/「跳過」按鈕
- 自動同步服藥狀態到 Supabase

**技術實作**：
```kotlin
// AlarmManager 設定精確鬧鐘
val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
val intent = Intent(context, MedicationAlarmReceiver::class.java)
val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)

// 使用 setAlarmClock 確保最高優先級
alarmManager.setAlarmClock(
    AlarmManager.AlarmClockInfo(triggerTime, pendingIntent),
    pendingIntent
)
```

**權限需求**：
- `SCHEDULE_EXACT_ALARM`（Android 12+）
- `USE_FULL_SCREEN_INTENT`（全螢幕提醒）
- `WAKE_LOCK`（喚醒螢幕）

---

##### 2️⃣ 背景定位 (Background Location)

**功能**：
- 每 5 分鐘自動上傳位置
- 計算是否在安全區域內
- 離開/進入安全區域時發送警示
- 位置歷史本地快取（網路斷線時）

**技術實作**：
```kotlin
// WorkManager 定期任務
val locationWorkRequest = PeriodicWorkRequestBuilder<LocationWorker>(
    repeatInterval = 5,
    repeatIntervalTimeUnit = TimeUnit.MINUTES
).setConstraints(
    Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
).build()

workManager.enqueueUniquePeriodicWork(
    "location_upload",
    ExistingPeriodicWorkPolicy.KEEP,
    locationWorkRequest
)
```

**權限需求**：
- `ACCESS_FINE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`（Android 10+）
- `FOREGROUND_SERVICE_LOCATION`（Android 14+）

**隱私考量**：
- ✅ 明確告知使用者位置用途
- ✅ 提供開關選項
- ✅ 家屬同意機制

---

##### 3️⃣ App 使用監控 (App Usage Tracking)

**功能**：
- 偵測長輩使用的 App（Line, WeChat, 電話等）
- 記錄使用時長和頻率
- 偵測異常 App（如博弈、詐騙 App）
- 家屬可查看長輩 App 使用報表

**技術實作**：
```kotlin
// UsageStatsManager 查詢 App 使用統計
val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
val endTime = System.currentTimeMillis()
val startTime = endTime - (1000 * 60 * 60) // 過去 1 小時

val usageStats = usageStatsManager.queryUsageStats(
    UsageStatsManager.INTERVAL_DAILY,
    startTime,
    endTime
)

// 上傳到 Supabase
usageStats.forEach { stat ->
    supabase.from("app_usage_logs").insert(mapOf(
        "elder_id" to elderId,
        "package_name" to stat.packageName,
        "app_name" to getAppName(stat.packageName),
        "usage_time_ms" to stat.totalTimeInForeground,
        "last_used_at" to stat.lastTimeUsed
    ))
}
```

**權限需求**：
- `PACKAGE_USAGE_STATS`（需引導使用者到設定頁面授權）

**隱私考量**：
- ⚠️ **敏感功能**，需明確告知並取得同意
- ✅ 提供「詐騙防護」價值主張
- ✅ 家屬端顯示時隱藏敏感 App（如約會、健康類）
- ✅ 僅記錄 App 名稱和使用時長，不記錄內容

**異常 App 偵測**：
```kotlin
// 預設詐騙/風險 App 清單
val suspiciousApps = listOf(
    "com.gambling.*",
    "com.investment.high_return.*",
    // 從 Supabase 動態更新清單
)

// 偵測到時發送警示給家屬
if (packageName.matches(suspiciousApps)) {
    sendAlertToFamily(elderId, "偵測到可疑 App: $appName")
}
```

---

##### 4️⃣ WebView 整合 (Hybrid App)

**功能**：
- 在 Android App 中嵌入 Web App
- JavaScript Bridge 溝通
- Native 功能供 Web 調用

**技術實作**：
```kotlin
// WebView 設定
webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
}

// JavaScript Bridge
webView.addJavascriptInterface(object {
    @JavascriptInterface
    fun setAlarm(medicationId: String, time: Long) {
        // Native 設定鬧鐘
        MedicationAlarmManager.setAlarm(medicationId, time)
    }

    @JavascriptInterface
    fun checkAppInstalled(): Boolean {
        return true // 告訴 Web App 已安裝 Android App
    }

    @JavascriptInterface
    fun uploadLocation() {
        // 立即上傳位置
        LocationWorker.uploadNow()
    }
}, "AndroidBridge")
```

**Web App 調用範例**：
```javascript
// 檢查是否安裝 Android App
if (typeof AndroidBridge !== 'undefined' && AndroidBridge.checkAppInstalled()) {
    console.log('✅ Android App 已安裝');

    // 設定鬧鐘時，調用 Native 功能
    AndroidBridge.setAlarm(medicationId, scheduledTime);
} else {
    console.log('⚠️ 未安裝 Android App，使用 Web 功能');
    // 降級到 Web 推送或提示下載 App
}
```

---

##### 5️⃣ 前台服務 (Foreground Service)

**功能**：
- 顯示常駐通知
- 保持背景運行（定位、鬧鐘同步）
- 提供快速操作按鈕

**技術實作**：
```kotlin
// 前台服務通知
val notification = NotificationCompat.Builder(context, CHANNEL_ID)
    .setContentTitle("ElderCare 運行中")
    .setContentText("位置追蹤與用藥提醒已啟用")
    .setSmallIcon(R.drawable.ic_medication)
    .addAction(R.drawable.ic_location, "查看位置", locationPendingIntent)
    .addAction(R.drawable.ic_medication, "今日用藥", medicationPendingIntent)
    .build()

startForeground(NOTIFICATION_ID, notification)
```

**權限需求**：
- `FOREGROUND_SERVICE`
- `POST_NOTIFICATIONS`（Android 13+）

---

## 🔄 Web App 與 Android App 協作流程

### 場景 1：用藥鬧鐘設定

```
使用者操作                 Web App              Android App        Supabase
    │                         │                      │                 │
    ├─ 新增用藥 ─────────────►│                      │                 │
    │                         ├─ 儲存到 DB ─────────┼────────────────►│
    │                         │                      │                 │
    │                         ├─ 檢查 Android App ───┤                 │
    │                         │  是否已安裝？        │                 │
    │                         │                      │                 │
    │◄─ 顯示提示：           │                      │                 │
    │   「是否設定鬧鐘？」    │                      │                 │
    │                         │                      │                 │
    ├─ 點擊「設定鬧鐘」 ─────►│                      │                 │
    │                         │                      │                 │
    │   【情況 A：已安裝 Android App】              │                 │
    │                         ├─ 調用 Bridge ───────►│                 │
    │                         │  AndroidBridge       │                 │
    │                         │  .setAlarm()         │                 │
    │                         │                      ├─ 設定系統鬧鐘   │
    │◄──────────────────────────────────────────────┤                 │
    │   鬧鐘設定成功                                │                 │
    │                         │                      │                 │
    │   【情況 B：未安裝 Android App】              │                 │
    │                         ├─ 顯示下載引導 ─────►│                 │
    │◄─ 「下載 App 以       │                      │                 │
    │     啟用鬧鐘功能」      │                      │                 │
    │                         │                      │                 │
    ├─ 點擊下載 APK ─────────►│                      │                 │
    │                         ├─ 導向 APK URL       │                 │
    │                         │                      │                 │
    └─ 安裝 App ────────────────────────────────────►│                 │
                              │                      │                 │
                              │                      ├─ 首次啟動       │
                              │                      ├─ 同步排程 ◄────┤
                              │                      ├─ 設定所有鬧鐘   │
                              │                      │                 │
```

---

### 場景 2：背景定位上傳

```
Android App              WorkManager           Location API        Supabase
     │                        │                      │                 │
     ├─ 啟動 App ────────────►│                      │                 │
     │                        ├─ 排程 5分鐘 任務    │                 │
     │                        │                      │                 │
     │   ⏰ 5 分鐘後           │                      │                 │
     │                        ├─ 執行 Worker ───────►│                 │
     │                        │                      ├─ 取得位置       │
     │                        │◄─────────────────────┤                 │
     │                        │                      │                 │
     │                        ├─ 檢查安全區域       │                 │
     │                        ├─ 上傳位置 ─────────────────────────────►│
     │                        │                      │                 │
     │   【若離開安全區域】   │                      │                 │
     │                        ├─ 建立警示 ─────────────────────────────►│
     │                        ├─ 發送 FCM ─────────────────────────────►│
     │                        │                      │   (通知家屬)    │
     │                        │                      │                 │
     │   ⏰ 再過 5 分鐘        │                      │                 │
     │                        ├─ 重複執行...        │                 │
```

---

### 場景 3：App 使用監控

```
Android App              UsageStatsManager      Supabase           家屬端
     │                        │                      │                 │
     ├─ 每小時檢查 ──────────►│                      │                 │
     │                        ├─ 取得 App 使用統計   │                 │
     │◄───────────────────────┤                      │                 │
     │  (過去 1 小時)         │                      │                 │
     │                        │                      │                 │
     ├─ 過濾與分析            │                      │                 │
     │  - Line: 30 分鐘       │                      │                 │
     │  - WeChat: 15 分鐘     │                      │                 │
     │  - 電話: 5 分鐘        │                      │                 │
     │                        │                      │                 │
     ├─ 上傳記錄 ───────────────────────────────────►│                 │
     │                        │                      │                 │
     │   【偵測到可疑 App】   │                      │                 │
     ├─ 檢查黑名單            │                      │                 │
     ├─ 發送警示 ───────────────────────────────────►│                 │
     │                        │                      ├─ 通知家屬 ─────►│
     │                        │                      │  「偵測到投資App」│
     │                        │                      │                 │
```

---

## 📥 App 下載引導流程

### 1️⃣ Web App 偵測邏輯

```javascript
// frontend/public/app-detection.js

class AndroidAppDetection {
    constructor() {
        this.appInstalled = false;
        this.checkInstallation();
    }

    // 檢查是否安裝 Android App
    checkInstallation() {
        // 方法 1：檢查 JavaScript Bridge
        if (typeof AndroidBridge !== 'undefined') {
            try {
                this.appInstalled = AndroidBridge.checkAppInstalled();
                console.log('✅ Android App 已安裝 (Bridge)');
                return true;
            } catch (e) {
                console.log('❌ Bridge 不可用');
            }
        }

        // 方法 2：檢查 User Agent
        const ua = navigator.userAgent;
        if (ua.includes('ElderCareApp')) {
            this.appInstalled = true;
            console.log('✅ Android App 已安裝 (UA)');
            return true;
        }

        // 方法 3：檢查 localStorage 標記（App 首次啟動時設定）
        if (localStorage.getItem('eldercare_app_installed') === 'true') {
            this.appInstalled = true;
            console.log('✅ Android App 已安裝 (localStorage)');
            return true;
        }

        console.log('⚠️ Android App 未安裝');
        return false;
    }

    // 顯示下載引導
    showDownloadPrompt(featureName) {
        if (this.appInstalled) return;

        const modal = `
            <div class="app-download-modal">
                <div class="modal-content">
                    <h3>📱 需要安裝 ElderCare App</h3>
                    <p>「${featureName}」功能需要安裝 Android App 才能使用</p>
                    <div class="features-list">
                        <h4>App 增強功能：</h4>
                        <ul>
                            <li>✅ 系統級鬧鐘提醒（不會漏掉）</li>
                            <li>✅ 背景位置追蹤（更安全）</li>
                            <li>✅ 可靠的推送通知</li>
                            <li>✅ 日常活動監控（防詐騙）</li>
                        </ul>
                    </div>
                    <button onclick="downloadApp()">立即下載</button>
                    <button onclick="closeModal()">稍後再說</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);
    }

    // 使用 Native 功能（如果可用）
    useNativeFeature(featureName, nativeFunction, fallbackFunction) {
        if (this.appInstalled && typeof AndroidBridge !== 'undefined') {
            try {
                nativeFunction();
                return true;
            } catch (e) {
                console.error('Native 功能調用失敗:', e);
            }
        }

        // 降級到 Web 功能
        if (fallbackFunction) {
            fallbackFunction();
        } else {
            this.showDownloadPrompt(featureName);
        }
        return false;
    }
}

// 全域實例
const appDetection = new AndroidAppDetection();

// 使用範例
function setMedicationAlarm(medicationId, scheduledTime) {
    appDetection.useNativeFeature(
        '用藥鬧鐘',
        () => {
            // Native 功能
            AndroidBridge.setAlarm(medicationId, scheduledTime);
            showToast('✅ 鬧鐘設定成功', 'success');
        },
        () => {
            // Web 降級功能
            showToast('⚠️ 瀏覽器推送通知不穩定，建議安裝 App', 'warning');
            // 仍然嘗試設定 Web 推送
            requestWebPushNotification();
        }
    );
}
```

---

### 2️⃣ 引導觸發時機

| 觸發場景 | 時機 | 引導方式 |
|---------|-----|---------|
| 首次設定用藥 | 建立第一個用藥提醒時 | Modal 彈窗 |
| 設定鬧鐘失敗 | 嘗試設定 Web 推送但失敗 | Toast 提示 + Banner |
| 進入位置追蹤 | 首次開啟家屬監控 | 功能說明 + 下載按鈕 |
| App 使用異常 | 偵測到長輩可能被詐騙 | 家屬端警示 + 建議安裝 |

---

### 3️⃣ 下載頁面設計

**URL**: `https://08-eldercare.vercel.app/download-app.html`

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>下載 ElderCare App</title>
    <link rel="stylesheet" href="download-app.css">
</head>
<body>
    <div class="download-container">
        <div class="app-icon">
            <img src="images/app-icon.png" alt="ElderCare">
        </div>

        <h1>ElderCare 長照小幫手</h1>
        <p class="subtitle">讓照護更安心，讓陪伴更貼心</p>

        <div class="features">
            <div class="feature-item">
                <span class="icon">⏰</span>
                <h3>準時提醒</h3>
                <p>系統級鬧鐘，不會漏掉任何用藥時間</p>
            </div>

            <div class="feature-item">
                <span class="icon">📍</span>
                <h3>位置守護</h3>
                <p>背景定位追蹤，家人隨時掌握長輩位置</p>
            </div>

            <div class="feature-item">
                <span class="icon">🔔</span>
                <h3>即時通知</h3>
                <p>可靠的推送通知，重要訊息不漏接</p>
            </div>

            <div class="feature-item">
                <span class="icon">🛡️</span>
                <h3>防詐保護</h3>
                <p>監控異常 App 使用，預防詐騙風險</p>
            </div>
        </div>

        <div class="download-section">
            <h2>立即下載</h2>

            <!-- Android -->
            <a href="/downloads/eldercare-v1.0.0.apk" class="download-btn android">
                <span class="platform-icon">🤖</span>
                <div class="btn-content">
                    <div class="platform-name">Android</div>
                    <div class="file-info">APK · 15 MB</div>
                </div>
            </a>

            <!-- iOS (未來) -->
            <div class="download-btn ios disabled">
                <span class="platform-icon">🍎</span>
                <div class="btn-content">
                    <div class="platform-name">iOS</div>
                    <div class="file-info">即將推出</div>
                </div>
            </div>
        </div>

        <div class="installation-guide">
            <h3>📖 安裝步驟</h3>
            <ol>
                <li>點擊上方「Android」按鈕下載 APK</li>
                <li>開啟手機「設定」→「安全性」</li>
                <li>允許「安裝未知來源的應用程式」</li>
                <li>開啟下載的 APK 檔案並安裝</li>
                <li>啟動 App 並登入您的帳號</li>
            </ol>
        </div>

        <div class="privacy-note">
            <h3>🔒 隱私與權限</h3>
            <p>App 需要以下權限以提供完整功能：</p>
            <ul>
                <li><strong>位置資訊</strong>：用於位置追蹤與安全區域監控</li>
                <li><strong>通知權限</strong>：用於用藥提醒與重要警示</li>
                <li><strong>使用情況存取</strong>：用於 App 使用監控（可選）</li>
            </ul>
            <p class="privacy-link">
                詳細資訊請參閱 <a href="/privacy-policy.html">隱私權政策</a>
            </p>
        </div>

        <div class="faq">
            <h3>❓ 常見問題</h3>

            <details>
                <summary>不安裝 App 可以使用嗎？</summary>
                <p>可以！您仍然可以透過瀏覽器使用所有基本功能。但部分增強功能（如系統鬧鐘、背景定位）需要安裝 App。</p>
            </details>

            <details>
                <summary>App 會耗電嗎？</summary>
                <p>我們已優化背景執行機制，正常使用下每日耗電約 3-5%。位置追蹤採用智能節能模式。</p>
            </details>

            <details>
                <summary>資料安全嗎？</summary>
                <p>所有資料透過 HTTPS 加密傳輸，儲存於 Supabase 雲端資料庫。我們不會分享您的個人資料給第三方。</p>
            </details>

            <details>
                <summary>如何關閉 App 使用監控？</summary>
                <p>App 設定 → 隱私設定 → 關閉「App 使用監控」。關閉後仍可使用其他功能。</p>
            </details>
        </div>

        <div class="support">
            <p>需要協助？請聯絡我們：<a href="mailto:support@eldercare.com">support@eldercare.com</a></p>
        </div>
    </div>

    <script src="download-app.js"></script>
</body>
</html>
```

---

## 🗄️ 資料庫結構擴充

### 新增資料表

#### 1. `app_usage_logs` - App 使用記錄

```sql
CREATE TABLE app_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
    package_name VARCHAR(255) NOT NULL,
    app_name VARCHAR(255),
    usage_time_ms BIGINT, -- 使用時長（毫秒）
    last_used_at TIMESTAMPTZ,
    is_suspicious BOOLEAN DEFAULT FALSE, -- 是否為可疑 App
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_usage_logs_elder_id ON app_usage_logs(elder_id);
CREATE INDEX idx_app_usage_logs_recorded_at ON app_usage_logs(recorded_at);
```

#### 2. `device_info` - 裝置資訊

```sql
CREATE TABLE device_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
    device_type VARCHAR(50), -- 'android' | 'ios' | 'web'
    device_model VARCHAR(255),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    fcm_token TEXT,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_device_info_elder_id ON device_info(elder_id);
```

#### 3. `suspicious_apps_blacklist` - 可疑 App 黑名單

```sql
CREATE TABLE suspicious_apps_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_name VARCHAR(255) NOT NULL,
    app_name VARCHAR(255),
    category VARCHAR(50), -- 'gambling', 'investment', 'dating', 'malware'
    risk_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_suspicious_apps_package ON suspicious_apps_blacklist(package_name);
```

---

## 🔐 權限與隱私

### 必要權限

| 權限 | 用途 | 風險等級 | 使用者控制 |
|-----|------|---------|-----------|
| `SCHEDULE_EXACT_ALARM` | 用藥鬧鐘 | 低 | 必須授權 |
| `ACCESS_FINE_LOCATION` | 位置追蹤 | 高 | 可關閉 |
| `ACCESS_BACKGROUND_LOCATION` | 背景定位 | 高 | 可關閉 |
| `POST_NOTIFICATIONS` | 推送通知 | 低 | 可關閉 |
| `PACKAGE_USAGE_STATS` | App 使用監控 | **極高** | 可關閉 |
| `FOREGROUND_SERVICE` | 背景運行 | 低 | 自動授權 |

### 隱私保護措施

1. **透明告知**：
   - App 首次啟動時，清楚說明每個權限的用途
   - 提供「為什麼需要此權限」的詳細說明

2. **最小權限原則**：
   - 使用者可選擇性開啟功能
   - 不強制要求所有權限

3. **資料加密**：
   - 傳輸：HTTPS / TLS 1.3
   - 儲存：AES-256 加密敏感資料

4. **匿名化處理**：
   - App 使用記錄僅記錄 App 名稱，不記錄內容
   - 位置資料保留 30 天後自動刪除

5. **家屬同意機制**：
   - App 使用監控需家屬端啟用
   - 長輩端顯示「監控已啟用」狀態

---

## 📱 Android App 技術棧

### 開發環境
- **語言**：Kotlin
- **IDE**：Android Studio Hedgehog (2023.1.1)
- **最低版本**：Android 8.0 (API 26)
- **目標版本**：Android 14 (API 34)

### 核心技術
| 技術 | 用途 |
|-----|------|
| **Jetpack Compose** | UI 框架 |
| **Room Database** | 本地資料庫（快取） |
| **WorkManager** | 背景任務 |
| **Hilt / Dagger** | 依賴注入 |
| **Retrofit** | HTTP 請求（Supabase API） |
| **Firebase SDK** | FCM 推送通知 |
| **Location API** | 位置服務 |
| **AlarmManager** | 系統鬧鐘 |
| **WebView** | 嵌入 Web App |

### 專案結構
```
eldercare-android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/eldercare/
│   │   │   │   ├── alarm/           # 鬧鐘模組
│   │   │   │   │   ├── AlarmManager.kt
│   │   │   │   │   ├── AlarmReceiver.kt
│   │   │   │   │   └── AlarmActivity.kt
│   │   │   │   ├── location/        # 定位模組
│   │   │   │   │   ├── LocationWorker.kt
│   │   │   │   │   └── GeofenceManager.kt
│   │   │   │   ├── monitoring/      # App 監控模組
│   │   │   │   │   ├── UsageStatsWorker.kt
│   │   │   │   │   └── SuspiciousAppDetector.kt
│   │   │   │   ├── fcm/             # FCM 推送
│   │   │   │   │   └── FCMService.kt
│   │   │   │   ├── webview/         # WebView 整合
│   │   │   │   │   ├── MainActivity.kt
│   │   │   │   │   └── JavaScriptBridge.kt
│   │   │   │   ├── data/            # 資料層
│   │   │   │   │   ├── database/
│   │   │   │   │   ├── repository/
│   │   │   │   │   └── api/
│   │   │   │   └── service/         # 前台服務
│   │   │   │       └── ForegroundService.kt
│   │   │   ├── res/
│   │   │   └── AndroidManifest.xml
│   │   └── test/
│   └── build.gradle.kts
├── gradle/
├── build.gradle.kts
└── settings.gradle.kts
```

---

## 🚀 開發階段規劃

### Phase 1：核心功能 (4-6 週)

**目標**：建立 MVP，實作用藥鬧鐘與 WebView 整合

| 任務 | 預估時間 | 優先級 |
|-----|---------|-------|
| 專案架構建立 | 3 天 | P0 |
| WebView 整合 + JavaScript Bridge | 5 天 | P0 |
| 用藥鬧鐘功能 | 7 天 | P0 |
| FCM 推送通知 | 5 天 | P0 |
| Supabase API 整合 | 5 天 | P0 |
| UI/UX 設計 | 7 天 | P0 |
| 測試與除錯 | 5 天 | P0 |

**交付成果**：
- ✅ 可安裝的 APK
- ✅ 用藥鬧鐘功能運作
- ✅ WebView 嵌入 Web App
- ✅ FCM 推送通知

---

### Phase 2：背景定位 (2-3 週)

**目標**：實作位置追蹤與地理圍欄

| 任務 | 預估時間 | 優先級 |
|-----|---------|-------|
| 位置權限處理 | 2 天 | P0 |
| WorkManager 背景任務 | 3 天 | P0 |
| 地理圍欄偵測 | 4 天 | P0 |
| 安全區域同步 | 3 天 | P0 |
| 警示發送機制 | 3 天 | P0 |
| 測試與優化 | 3 天 | P0 |

**交付成果**：
- ✅ 每 5 分鐘上傳位置
- ✅ 離開/進入安全區域警示
- ✅ 家屬端即時查看位置

---

### Phase 3：App 使用監控 (2-3 週)

**目標**：實作 App 使用統計與異常偵測

| 任務 | 預估時間 | 優先級 |
|-----|---------|-------|
| UsageStatsManager 整合 | 3 天 | P1 |
| 權限引導流程 | 2 天 | P1 |
| App 使用記錄上傳 | 3 天 | P1 |
| 可疑 App 偵測 | 4 天 | P1 |
| 家屬端報表顯示 | 4 天 | P1 |
| 隱私保護機制 | 2 天 | P1 |
| 測試與優化 | 3 天 | P1 |

**交付成果**：
- ✅ App 使用時長統計
- ✅ 異常 App 警示
- ✅ 家屬端查看報表

---

### Phase 4：優化與上架 (2-3 週)

| 任務 | 預估時間 | 優先級 |
|-----|---------|-------|
| 效能優化（電量、記憶體） | 5 天 | P0 |
| 安全性檢測 | 3 天 | P0 |
| 多語言支援 | 3 天 | P1 |
| 隱私權政策頁面 | 2 天 | P0 |
| 使用者手冊 | 3 天 | P1 |
| Google Play 上架準備 | 5 天 | P1 |

**交付成果**：
- ✅ 穩定版 APK
- ✅ Google Play 上架（可選）

---

## 📊 Web App 修改清單

### 1. 新增 App 偵測與引導

**檔案**：`frontend/public/app-detection.js`（新檔案）

```javascript
// 已在上文提供完整程式碼
```

**修改**：
- 在 `index.html` 引入此檔案
- 在需要 Native 功能的地方調用 `appDetection.useNativeFeature()`

---

### 2. 修改用藥設定頁面

**檔案**：`frontend/public/medications.js`

```javascript
// 在 createMedicationReminder() 函數中加入
async function createMedicationReminder() {
    // ... 現有邏輯

    // ✅ 新增：儲存成功後，提示設定鬧鐘
    if (result.success) {
        showToast('用藥提醒建立成功！', 'success');

        // 檢查是否安裝 Android App
        if (appDetection.appInstalled) {
            // 調用 Native 設定鬧鐘
            appDetection.useNativeFeature(
                '用藥鬧鐘',
                () => {
                    AndroidBridge.syncMedicationSchedule(elderId);
                    showToast('✅ 鬧鐘已自動設定', 'success');
                }
            );
        } else {
            // 顯示下載引導
            showAppDownloadPrompt('用藥鬧鐘');
        }
    }
}

function showAppDownloadPrompt(featureName) {
    const banner = `
        <div class="app-download-banner">
            <div class="banner-content">
                <span class="icon">📱</span>
                <div class="text">
                    <strong>需要更可靠的提醒？</strong>
                    <p>安裝 ElderCare App 以啟用系統級鬧鐘</p>
                </div>
                <button onclick="window.location.href='/download-app.html'">
                    下載 App
                </button>
                <button class="close" onclick="this.parentElement.parentElement.remove()">
                    ✕
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', banner);
}
```

---

### 3. 修改家屬監控頁面

**檔案**：`frontend/public/family-dashboard.js`

```javascript
// 在 loadGeolocationTab() 函數中加入
async function loadGeolocationTab() {
    // ... 現有邏輯

    // ✅ 新增：檢查 Android App 狀態
    checkAndroidAppForLocation();
}

function checkAndroidAppForLocation() {
    if (!appDetection.appInstalled) {
        const notice = `
            <div class="feature-notice">
                <h4>📱 建議安裝 Android App</h4>
                <p>位置追蹤需要 Android App 在背景運行，才能提供即時更新。</p>
                <button onclick="window.location.href='/download-app.html'">
                    下載 App
                </button>
            </div>
        `;
        document.getElementById('geolocation-tab')
            .insertAdjacentHTML('afterbegin', notice);
    }
}
```

---

### 4. 新增 App 使用監控頁面

**檔案**：`frontend/public/app-usage.html`（新檔案）

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>App 使用監控 - ElderCare</title>
    <link rel="stylesheet" href="styles-modern.css">
</head>
<body>
    <nav class="top-nav">
        <button class="nav-back" onclick="window.location.href='family-dashboard.html'">
            ← 返回
        </button>
        <h1 class="nav-title">📊 App 使用監控</h1>
    </nav>

    <div class="container">
        <!-- 日期選擇 -->
        <div class="filter-bar">
            <input type="date" id="dateFilter" onchange="loadAppUsage()">
            <select id="categoryFilter" onchange="filterByCategory()">
                <option value="all">全部 App</option>
                <option value="social">社交通訊</option>
                <option value="suspicious">可疑 App</option>
            </select>
        </div>

        <!-- 統計卡片 -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">📱</div>
                <div class="stat-content">
                    <div class="stat-label">今日使用 App 數</div>
                    <div class="stat-value" id="totalApps">-</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">⏱️</div>
                <div class="stat-content">
                    <div class="stat-label">總使用時長</div>
                    <div class="stat-value" id="totalTime">-</div>
                </div>
            </div>

            <div class="stat-card alert">
                <div class="stat-icon">⚠️</div>
                <div class="stat-content">
                    <div class="stat-label">可疑 App</div>
                    <div class="stat-value" id="suspiciousCount">-</div>
                </div>
            </div>
        </div>

        <!-- App 使用列表 -->
        <div id="appUsageList" class="app-usage-list">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>載入中...</p>
            </div>
        </div>
    </div>

    <script src="app-usage.js"></script>
</body>
</html>
```

---

## 🧪 測試計畫

### 功能測試

| 測試項目 | 測試場景 | 預期結果 |
|---------|---------|---------|
| 用藥鬧鐘 | 設定鬧鐘後，關閉 App | 時間到時仍然響鈴 |
| 背景定位 | App 在背景運行 5 分鐘 | 位置成功上傳到 Supabase |
| 地理圍欄 | 長輩離開安全區域 | 家屬收到警示推送 |
| App 監控 | 使用 Line 30 分鐘 | 家屬端顯示使用記錄 |
| WebView 整合 | 在 App 中操作 Web 功能 | 功能正常，JavaScript Bridge 運作 |
| 異常偵測 | 安裝博弈類 App | 家屬收到可疑 App 警示 |

### 效能測試

| 測試項目 | 目標指標 |
|---------|---------|
| 電池消耗 | < 5% / 24 小時 |
| 記憶體使用 | < 150 MB |
| APK 大小 | < 20 MB |
| 啟動速度 | < 2 秒（冷啟動）|

---

## 🔄 部署流程

### Android App 發佈

1. **開發版**：
   - 直接安裝 APK（給測試人員）
   - URL: `https://08-eldercare.vercel.app/downloads/eldercare-v1.0.0-debug.apk`

2. **正式版**：
   - **選項 A**：自行託管 APK
     - 放在 Vercel `/public/downloads/` 目錄
     - 提供直接下載連結

   - **選項 B**：Google Play Store（建議）
     - 更廣泛觸及
     - 自動更新
     - 使用者信任度高

### Web App 修改部署

1. 加入新檔案到 `frontend/public/`:
   - `app-detection.js`
   - `download-app.html`
   - `download-app.css`
   - `app-usage.html`
   - `app-usage.js`

2. 修改現有檔案:
   - `index.html`（引入 app-detection.js）
   - `medications.js`（加入 App 引導）
   - `family-dashboard.js`（加入 App 偵測）

3. 推送到 GitHub → Vercel 自動部署

---

## 📝 下一步行動

### 立即執行（本次規劃）

- [x] 完成整體架構規劃
- [x] 設計功能分配策略
- [x] 規劃資料庫擴充
- [ ] 建立下載引導頁面
- [ ] 實作 Web App 偵測邏輯

### 短期（1-2 週）

- [ ] 建立 Android 專案
- [ ] 實作 WebView + JavaScript Bridge
- [ ] 實作用藥鬧鐘功能
- [ ] Web App 整合測試

### 中期（1-2 個月）

- [ ] 完成 Phase 1-3 開發
- [ ] 內部測試與除錯
- [ ] 準備 APK 發佈

### 長期（3-6 個月）

- [ ] Google Play 上架
- [ ] iOS App 開發規劃
- [ ] 功能擴充（智能分析、AI 建議）

---

## 💬 總結

此規劃確保：

✅ **Web App 功能完整保留**
- 所有現有功能繼續透過瀏覽器運作
- 無需 Android App 即可使用基本功能

✅ **Android App 提供增強功能**
- 系統級鬧鐘（解決 FCM 不穩定問題）
- 背景定位追蹤
- App 使用監控（防詐騙）

✅ **無縫整合**
- JavaScript Bridge 連接 Web 與 Native
- 資料同步透過 Supabase
- 漸進式引導下載 App

✅ **隱私優先**
- 透明告知權限用途
- 使用者可控制功能開關
- 符合 GDPR / 個資法

---

**文件版本**：v1.0
**最後更新**：2025-11-24
**作者**：Claude (Anthropic)
