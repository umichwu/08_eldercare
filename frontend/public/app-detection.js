/**
 * Android App 偵測與整合
 *
 * 功能：
 * - 偵測是否安裝 Android App
 * - 提供 JavaScript Bridge 調用
 * - 顯示下載引導
 * - 功能降級處理
 */

class AndroidAppDetection {
    constructor() {
        this.appInstalled = false;
        this.checkInstallation();
    }

    /**
     * 檢查是否安裝 Android App
     */
    checkInstallation() {
        // 方法 1：檢查 JavaScript Bridge
        if (typeof AndroidBridge !== 'undefined') {
            try {
                this.appInstalled = AndroidBridge.checkAppInstalled();
                console.log('✅ Android App 已安裝 (Bridge 檢測)');
                return true;
            } catch (e) {
                console.warn('⚠️ Bridge 存在但調用失敗:', e);
            }
        }

        // 方法 2：檢查 User Agent
        const ua = navigator.userAgent;
        if (ua.includes('ElderCareApp') || ua.includes('eldercare-android')) {
            this.appInstalled = true;
            console.log('✅ Android App 已安裝 (User Agent 檢測)');
            // 標記到 localStorage
            localStorage.setItem('eldercare_app_installed', 'true');
            return true;
        }

        // 方法 3：檢查 localStorage 標記
        if (localStorage.getItem('eldercare_app_installed') === 'true') {
            // 二次確認（避免誤判）
            if (typeof AndroidBridge !== 'undefined') {
                this.appInstalled = true;
                console.log('✅ Android App 已安裝 (localStorage 標記)');
                return true;
            } else {
                // Bridge 不存在，可能是在瀏覽器中開啟
                console.log('⚠️ localStorage 有標記，但 Bridge 不存在，清除標記');
                localStorage.removeItem('eldercare_app_installed');
            }
        }

        console.log('❌ Android App 未安裝');
        this.appInstalled = false;
        return false;
    }

    /**
     * 使用 Native 功能（如果可用），否則降級到 Web 功能
     *
     * @param {string} featureName - 功能名稱（顯示在提示中）
     * @param {Function} nativeFunction - Native 功能
     * @param {Function} fallbackFunction - Web 降級功能（可選）
     * @returns {boolean} - 是否成功使用 Native 功能
     */
    useNativeFeature(featureName, nativeFunction, fallbackFunction = null) {
        if (this.appInstalled && typeof AndroidBridge !== 'undefined') {
            try {
                nativeFunction();
                console.log(`✅ 使用 Native 功能: ${featureName}`);
                return true;
            } catch (e) {
                console.error(`❌ Native 功能調用失敗 (${featureName}):`, e);
            }
        }

        // 降級處理
        console.log(`⚠️ Native 功能不可用，使用 Web 降級 (${featureName})`);

        if (fallbackFunction) {
            fallbackFunction();
        } else {
            // 沒有降級功能，顯示下載引導
            this.showDownloadPrompt(featureName);
        }

        return false;
    }

    /**
     * 顯示下載引導 Modal
     *
     * @param {string} featureName - 功能名稱
     */
    showDownloadPrompt(featureName) {
        // 避免重複顯示
        if (document.getElementById('app-download-modal')) {
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'app-download-modal';
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>📱 需要安裝 ElderCare App</h2>
                    <button class="modal-close" onclick="document.getElementById('app-download-modal').remove()">
                        &times;
                    </button>
                </div>
                <div class="modal-body" style="padding: 25px;">
                    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                        「<strong>${featureName}</strong>」功能需要安裝 Android App 才能使用
                    </p>

                    <div style="background: #f7fafc; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                        <h4 style="color: #2d3748; margin-bottom: 15px; font-size: 16px;">✨ App 增強功能</h4>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 8px 0; color: #4a5568; font-size: 14px;">
                                <span style="color: #48bb78; font-weight: bold;">✓</span>
                                系統級鬧鐘提醒（不會漏掉）
                            </li>
                            <li style="padding: 8px 0; color: #4a5568; font-size: 14px;">
                                <span style="color: #48bb78; font-weight: bold;">✓</span>
                                背景位置追蹤（更安全）
                            </li>
                            <li style="padding: 8px 0; color: #4a5568; font-size: 14px;">
                                <span style="color: #48bb78; font-weight: bold;">✓</span>
                                可靠的推送通知
                            </li>
                            <li style="padding: 8px 0; color: #4a5568; font-size: 14px;">
                                <span style="color: #48bb78; font-weight: bold;">✓</span>
                                日常活動監控（防詐騙）
                            </li>
                        </ul>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button
                            class="btn-primary"
                            onclick="window.location.href='/download-app.html'"
                            style="flex: 1; padding: 12px; font-size: 16px;">
                            立即下載
                        </button>
                        <button
                            class="btn-secondary"
                            onclick="document.getElementById('app-download-modal').remove()"
                            style="padding: 12px 20px; font-size: 16px;">
                            稍後再說
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 點擊背景關閉
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * 顯示簡單的 Banner 提示
     *
     * @param {string} message - 提示訊息
     */
    showDownloadBanner(message) {
        // 避免重複顯示
        if (document.getElementById('app-download-banner')) {
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'app-download-banner';
        banner.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 15px;
            max-width: 90%;
            animation: slideUp 0.3s ease;
        `;

        banner.innerHTML = `
            <style>
                @keyframes slideUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            </style>
            <span style="font-size: 24px;">📱</span>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 3px;">${message}</div>
                <div style="font-size: 13px; opacity: 0.9;">安裝 App 以獲得完整功能</div>
            </div>
            <button
                onclick="window.location.href='/download-app.html'"
                style="background: white; color: #667eea; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                下載
            </button>
            <button
                onclick="this.parentElement.remove()"
                style="background: transparent; color: white; border: none; font-size: 20px; cursor: pointer; padding: 0 8px;">
                ✕
            </button>
        `;

        document.body.appendChild(banner);

        // 10 秒後自動消失
        setTimeout(() => {
            banner.remove();
        }, 10000);
    }
}

// 全域實例
const appDetection = new AndroidAppDetection();

// 如果已安裝 App，標記到 body（方便 CSS 調整樣式）
if (appDetection.appInstalled) {
    document.body.classList.add('android-app-installed');
}

// ==================== 使用範例 ====================

/**
 * 設定用藥鬧鐘
 *
 * @param {string} medicationId - 用藥 ID
 * @param {number} scheduledTime - 預定時間（timestamp）
 */
function setMedicationAlarm(medicationId, scheduledTime) {
    appDetection.useNativeFeature(
        '用藥鬧鐘',
        () => {
            // Native 功能：設定系統鬧鐘
            AndroidBridge.setAlarm(medicationId, scheduledTime);
            showToast('✅ 鬧鐘設定成功', 'success');
        },
        () => {
            // Web 降級功能：嘗試 Web 推送
            showToast('⚠️ 建議安裝 App 以獲得更可靠的提醒', 'warning');
            requestWebPushNotification();
        }
    );
}

/**
 * 同步用藥排程到 Native App
 *
 * @param {string} elderId - 長輩 ID
 */
function syncMedicationScheduleToApp(elderId) {
    if (appDetection.appInstalled && typeof AndroidBridge !== 'undefined') {
        try {
            AndroidBridge.syncMedicationSchedule(elderId);
            console.log('✅ 已同步用藥排程到 App');
        } catch (e) {
            console.error('❌ 同步失敗:', e);
        }
    }
}

/**
 * 立即上傳位置
 */
function uploadLocationNow() {
    appDetection.useNativeFeature(
        '位置上傳',
        () => {
            AndroidBridge.uploadLocationNow();
            showToast('✅ 位置已上傳', 'success');
        },
        () => {
            showToast('⚠️ 需要安裝 App 才能上傳位置', 'warning');
        }
    );
}

console.log('✅ Android App 偵測模組已載入');
