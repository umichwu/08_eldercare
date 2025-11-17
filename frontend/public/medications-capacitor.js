/**
 * Capacitor 整合版本
 *
 * 這個檔案展示如何在現有的 medications.js 中加入 Capacitor 支援
 * 使用方式：
 * 1. 安裝 Capacitor 後，將此檔案內容複製到 medications.js 的對應位置
 * 2. 或者直接用這個檔案取代 medications.js
 */

// ==================== Capacitor 初始化 ====================

let Capacitor, AlarmPlugin, isNativeApp = false;

/**
 * 初始化 Capacitor 環境檢測
 */
async function initCapacitor() {
  try {
    // 動態載入 Capacitor（避免在 Web 環境報錯）
    if (typeof window.Capacitor !== 'undefined') {
      Capacitor = window.Capacitor;
      isNativeApp = Capacitor.isNativePlatform();

      console.log(`📱 環境檢測：${isNativeApp ? '原生 App' : 'Web 瀏覽器'}`);

      if (isNativeApp) {
        // 嘗試載入鬧鐘插件
        try {
          // 方法 1: 如果使用社群插件
          if (window.AlarmPlugin) {
            AlarmPlugin = window.AlarmPlugin;
            console.log('✅ 鬧鐘插件已載入（社群版本）');
          }
          // 方法 2: 如果使用自定義插件
          else if (Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin) {
            AlarmPlugin = Capacitor.Plugins.AlarmPlugin;
            console.log('✅ 鬧鐘插件已載入（自定義版本）');
          } else {
            console.log('⚠️ 未找到鬧鐘插件，將使用手動設定方式');
          }
        } catch (e) {
          console.log('⚠️ 鬧鐘插件載入失敗:', e.message);
        }
      }
    } else {
      console.log('ℹ️ 純 Web 環境，使用手動設定方式');
    }
  } catch (e) {
    console.error('❌ Capacitor 初始化失敗:', e);
  }
}

// ==================== 修改後的 setPhoneAlarm 函數 ====================

/**
 * 設定手機鬧鐘（支援原生和 Web 兩種模式）
 * @param {string} time - ISO 8601 格式的時間
 * @param {string} medicineName - 藥物名稱
 * @param {string} dosage - 劑量
 * @param {number} index - 按鈕索引
 */
async function setPhoneAlarm(time, medicineName, dosage, index) {
  console.log(`⏰ 設定鬧鐘: ${time} - ${medicineName}`);

  // 將 UTC 時間轉換為本地時間
  const scheduledDate = new Date(time);
  const hours = scheduledDate.getHours();
  const minutes = scheduledDate.getMinutes();
  const timeStr = `${hours}:${String(minutes).padStart(2, '0')}`;
  const label = `用藥提醒 ${medicineName} ${dosage}`.trim();

  console.log(`📅 本地時間: ${timeStr}`);
  console.log(`📝 鬧鐘標籤: ${label}`);

  // ==================== 原生 App 模式 ====================
  if (isNativeApp && AlarmPlugin) {
    try {
      console.log('📱 使用原生 API 設定鬧鐘');

      // 調用原生鬧鐘 API
      await AlarmPlugin.setAlarm({
        hour: hours,
        minute: minutes,
        message: label,
        skipUi: false  // false = 顯示鬧鐘設定畫面
      });

      // 成功後顯示提示
      showToast(`✅ 鬧鐘設定畫面已開啟`, 'success', 3000);

      // 更新按鈕狀態
      updateAlarmButtonState(index, true);

      return;
    } catch (error) {
      console.error('❌ 原生鬧鐘設定失敗:', error);
      showToast('⚠️ 原生設定失敗，改用手動方式', 'warning');
      // 降級到手動方式
    }
  }

  // ==================== Web 模式或降級方案 ====================
  console.log('🌐 使用手動設定方式');

  const message =
    `請在您的手機時鐘 App 中設定鬧鐘：\n\n` +
    `⏰ 時間：${timeStr}\n` +
    `💊 標籤：${label}\n\n` +
    `點擊「確定」後，請開啟手機的「時鐘」App 來新增鬧鐘。`;

  if (confirm(message)) {
    showToast(`⏰ 請設定：${timeStr} - ${medicineName}`, 'info', 5000);
    console.log(`✅ 請手動設定鬧鐘：${timeStr} - ${label}`);

    // 更新按鈕狀態（即使是手動，也標記為「已提示」）
    updateAlarmButtonState(index, false);
  }
}

/**
 * 更新鬧鐘按鈕狀態
 * @param {number} index - 按鈕索引
 * @param {boolean} isNativeSet - 是否透過原生 API 設定
 */
function updateAlarmButtonState(index, isNativeSet) {
  const buttons = document.querySelectorAll('.btn-set-alarm');
  if (buttons[index]) {
    buttons[index].classList.add('set');
    buttons[index].innerHTML = isNativeSet ? '✅ 已設定' : '✅ 已提示';
  }
}

// ==================== 頁面載入時初始化 ====================

// 在原有的 DOMContentLoaded 事件中加入 Capacitor 初始化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📱 頁面開始初始化...');

  // 1. 初始化 Capacitor（新增）
  await initCapacitor();

  // 2. 原有的初始化流程
  await checkAuth();
  await loadCurrentUser();
  await loadMedications();
  setTodayDate();

  // 3. 裝置偵測
  setTimeout(() => {
    initDeviceBasedReminder();
  }, 1000);
});

// ==================== 環境資訊顯示（除錯用）====================

/**
 * 在 Console 顯示當前環境資訊
 */
function showEnvironmentInfo() {
  console.log('='.repeat(50));
  console.log('📱 ElderCare App 環境資訊');
  console.log('='.repeat(50));
  console.log(`環境類型: ${isNativeApp ? '原生 App' : 'Web 瀏覽器'}`);
  console.log(`Capacitor: ${Capacitor ? '已載入' : '未載入'}`);
  console.log(`鬧鐘插件: ${AlarmPlugin ? '已載入' : '未載入'}`);

  if (Capacitor) {
    console.log(`平台: ${Capacitor.getPlatform()}`);
    console.log(`是否原生: ${Capacitor.isNativePlatform()}`);
  }

  console.log('='.repeat(50));
}

// 在初始化後顯示環境資訊
setTimeout(showEnvironmentInfo, 2000);

/**
 * 注意事項：
 *
 * 1. 這個檔案可以同時在 Web 和原生環境中使用
 * 2. 如果在 Web 環境，會自動降級到手動設定方式
 * 3. 如果在原生環境但沒有鬧鐘插件，也會降級
 * 4. 原生環境需要安裝 Capacitor 和鬧鐘插件才能使用原生功能
 *
 * 安裝指令：
 * npm install @capacitor/core @capacitor/cli
 * npx cap init eldercare-app com.eldercare.app --web-dir=public
 * npm install @capacitor/android
 * npx cap add android
 *
 * 同步代碼：
 * npx cap sync
 *
 * 開啟 Android Studio：
 * npx cap open android
 */
