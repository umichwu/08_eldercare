# Android App 整合 - 測試指南

## 🧪 測試環境

**測試 URL**：https://08-eldercare.vercel.app

**需要測試的頁面**：
1. `index.html` - 主頁面
2. `medications.html` - 用藥管理（實際上是 index.html，使用 router）
3. `family-dashboard.html` - 家屬監控面板
4. `download-app.html` - App 下載頁面

---

## 📝 測試案例

### 測試 1：App 偵測模組載入

**測試頁面**：所有頁面
**預期結果**：

1. 開啟瀏覽器開發者工具（F12）→ Console 標籤
2. 應該看到：
   ```
   ✅ Android App 偵測模組已載入
   ❌ Android App 未安裝
   ```

3. 檢查全域物件：
   ```javascript
   typeof appDetection
   // 應該返回: "object"

   appDetection.appInstalled
   // 應該返回: false（因為在瀏覽器中）
   ```

---

### 測試 2：用藥提醒 - 下載引導

**測試頁面**：`/medications.html`（或主頁 → 用藥管理標籤）

**步驟**：
1. 登入系統
2. 新增一個用藥
3. 點擊「設定提醒」
4. 設定提醒時間
5. 點擊「儲存」

**預期結果**：
- ✅ 顯示 Toast：「提醒設定已儲存」
- ✅ 關閉提醒設定 Modal
- ✅ 0.5 秒後，頁面底部出現 Banner：

```
┌─────────────────────────────────────────────────┐
│ 📱  需要更可靠的提醒？                            │
│     安裝 App 以獲得完整功能                       │
│                               [下載] [✕]         │
└─────────────────────────────────────────────────┘
```

- ✅ 點擊「下載」→ 導向 `/download-app.html`
- ✅ 點擊「✕」→ Banner 消失

**Console 應該顯示**：
```
✅ Android App 偵測模組已載入
```

---

### 測試 3：家屬監控 - 位置追蹤引導

**測試頁面**：`/family-dashboard.html`

**步驟**：
1. 登入系統（家屬帳號或長輩帳號）
2. 選擇一位長輩
3. 點擊「📍 位置追蹤」標籤

**預期結果**：
- ✅ 頁面載入位置追蹤介面
- ✅ 延遲 1 秒後，頁面底部出現 Banner：

```
┌─────────────────────────────────────────────────┐
│ 📱  位置追蹤需要 Android App 才能在背景運行       │
│     安裝 App 以獲得完整功能                       │
│                               [下載] [✕]         │
└─────────────────────────────────────────────────┘
```

- ✅ 點擊「下載」→ 導向 `/download-app.html`
- ✅ 點擊「✕」→ Banner 消失

**重要**：同一個瀏覽器 session 中，此 Banner 只顯示一次
- 刷新頁面或再次進入標籤，不會重複顯示
- 關閉瀏覽器重新開啟，會再次顯示

**Console 應該顯示**：
```
✅ 家屬監控面板 - Android App 整合模組已載入
```

---

### 測試 4：下載頁面 UI

**測試頁面**：`/download-app.html`

**步驟**：
1. 直接訪問 https://08-eldercare.vercel.app/download-app.html

**預期結果**：
- ✅ 漸層背景（紫色系）
- ✅ App Icon（💊 圖示，浮動動畫）
- ✅ 標題：「ElderCare 長照小幫手」
- ✅ 副標題：「讓照護更安心，讓陪伴更貼心」
- ✅ 4 個功能卡片：
  - ⏰ 準時提醒
  - 📍 位置守護
  - 🔔 即時通知
  - 🛡️ 防詐保護
- ✅ 下載區域：
  - 🤖 Android（點擊後顯示：「APK 檔案尚未準備...」Toast）
  - 🍎 iOS（灰色，顯示「即將推出」）
- ✅ 安裝步驟（1-4 步驟）
- ✅ 隱私與權限說明
- ✅ FAQ（5 個可折疊問題）
- ✅ 支援聯絡方式
- ✅ 「返回 Web 版」按鈕

**測試互動**：
1. 點擊 FAQ 問題 → 應該展開顯示答案
2. 點擊「返回 Web 版」→ 導向 index.html
3. 點擊 Android 下載 → 顯示 Toast（因為 APK 尚未準備）

**響應式測試**：
- 桌面：卡片應該是 2x2 排列
- 手機：卡片應該是垂直堆疊

---

### 測試 5：已安裝 App 情境（模擬）

**測試方式**：在 Console 中手動模擬

**步驟**：
1. 開啟任意頁面（如 medications.html）
2. 在 Console 中執行：
   ```javascript
   // 模擬 Android Bridge
   window.AndroidBridge = {
       checkAppInstalled: () => true,
       syncMedicationSchedule: (elderId) => {
           console.log('🔄 同步用藥排程到 App:', elderId);
       },
       setAlarm: (medicationId, time) => {
           console.log('⏰ 設定鬧鐘:', medicationId, time);
       }
   };

   // 標記已安裝
   localStorage.setItem('eldercare_app_installed', 'true');

   // 重新檢查
   appDetection.checkInstallation();
   ```

3. 刷新頁面
4. 建立用藥提醒並儲存

**預期結果**：
- ✅ Console 顯示：「✅ Android App 已安裝」
- ✅ 儲存提醒後，不顯示下載 Banner
- ✅ Console 顯示：「🔄 同步用藥排程到 App: [elderId]」
- ✅ 顯示 Toast：「✅ 已同步用藥排程到 App」

**清除模擬**：
```javascript
delete window.AndroidBridge;
localStorage.removeItem('eldercare_app_installed');
location.reload();
```

---

## 🐛 已知問題與限制

### 1. APK 檔案尚未準備
**狀態**：下載按鈕點擊後顯示 Toast 提示
**解決**：需等待 Android App 開發完成

### 2. JavaScript Bridge 僅在 WebView 中可用
**狀態**：瀏覽器中無法測試 Native 功能
**解決**：需在 Android App WebView 中測試

### 3. Banner 樣式可能需要微調
**狀態**：目前使用 inline CSS
**建議**：後續可移至 CSS 檔案

---

## ✅ 檢查清單

在部署到生產環境前，請確認：

- [ ] App 偵測模組正常載入（所有頁面）
- [ ] 用藥提醒頁面顯示下載引導
- [ ] 家屬監控頁面顯示下載引導
- [ ] 下載頁面 UI 正確顯示
- [ ] 下載頁面響應式設計正常（手機/桌面）
- [ ] FAQ 折疊/展開功能正常
- [ ] Toast 通知正常顯示
- [ ] Console 沒有 JavaScript 錯誤
- [ ] 所有連結正確（download-app.html, privacy-policy.html 等）

---

## 📊 測試報告模板

**測試日期**：____________________
**測試人員**：____________________
**測試環境**：□ Desktop  □ Mobile  □ Tablet
**瀏覽器**：□ Chrome  □ Firefox  □ Safari  □ Edge

### 測試結果

| 測試案例 | 結果 | 備註 |
|---------|-----|------|
| 測試 1：App 偵測模組載入 | ☐ PASS ☐ FAIL | |
| 測試 2：用藥提醒 - 下載引導 | ☐ PASS ☐ FAIL | |
| 測試 3：家屬監控 - 位置追蹤引導 | ☐ PASS ☐ FAIL | |
| 測試 4：下載頁面 UI | ☐ PASS ☐ FAIL | |
| 測試 5：已安裝 App 情境 | ☐ PASS ☐ FAIL | |

### 發現問題

1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

### 建議改進

1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

---

**文件版本**：v1.0
**最後更新**：2025-11-24
