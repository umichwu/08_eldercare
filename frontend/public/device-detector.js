// ===================================
// 裝置偵測與 LINE In-App Browser 處理
// ===================================

/**
 * 裝置偵測工具
 * 提供裝置類型檢測、LINE In-App Browser 檢測和處理功能
 */

const DeviceDetector = {
  /**
   * 檢測是否為行動裝置
   * @returns {boolean} true 表示行動裝置，false 表示桌面裝置
   */
  isMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // 檢查常見的行動裝置關鍵字
    const mobileKeywords = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;

    // 方法 1: UserAgent 檢測
    const isMobileUA = mobileKeywords.test(userAgent);

    // 方法 2: 螢幕寬度檢測（作為輔助判斷）
    const isMobileScreen = window.innerWidth <= 768;

    // 方法 3: Touch 事件支援（作為輔助判斷）
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // 綜合判斷：UserAgent 為主，螢幕寬度和觸控為輔
    return isMobileUA || (isMobileScreen && hasTouchScreen);
  },

  /**
   * 檢測是否為平板裝置
   * @returns {boolean}
   */
  isTablet() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const tabletKeywords = /ipad|android(?!.*mobile)|tablet/i;
    return tabletKeywords.test(userAgent);
  },

  /**
   * 檢測是否為 LINE In-App Browser
   * @returns {boolean}
   */
  isLINEBrowser() {
    const userAgent = navigator.userAgent || '';
    // LINE 的 User-Agent 包含 'Line' 或 'LINE'
    return /Line/i.test(userAgent);
  },

  /**
   * 檢測是否為其他 In-App Browser（Facebook, Instagram, WeChat 等）
   * @returns {object} 包含各個應用的檢測結果
   */
  isInAppBrowser() {
    const userAgent = navigator.userAgent || '';

    return {
      isLINE: this.isLINEBrowser(),
      isFacebook: /FBAN|FBAV/i.test(userAgent),
      isInstagram: /Instagram/i.test(userAgent),
      isWeChat: /MicroMessenger/i.test(userAgent),
      isTwitter: /Twitter/i.test(userAgent),
      isAny: /FBAN|FBAV|Instagram|MicroMessenger|Twitter|Line/i.test(userAgent)
    };
  },

  /**
   * 獲取裝置類型
   * @returns {string} 'mobile' | 'tablet' | 'desktop'
   */
  getDeviceType() {
    if (this.isTablet()) return 'tablet';
    if (this.isMobile()) return 'mobile';
    return 'desktop';
  },

  /**
   * 獲取作業系統
   * @returns {string} 'iOS' | 'Android' | 'Windows' | 'MacOS' | 'Linux' | 'Unknown'
   */
  getOS() {
    const userAgent = navigator.userAgent || '';

    if (/iPad|iPhone|iPod/i.test(userAgent)) return 'iOS';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Mac OS X/i.test(userAgent)) return 'MacOS';
    if (/Linux/i.test(userAgent)) return 'Linux';

    return 'Unknown';
  },

  /**
   * 獲取瀏覽器資訊
   * @returns {object} 包含瀏覽器名稱和版本
   */
  getBrowser() {
    const userAgent = navigator.userAgent || '';
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';

    // 檢測瀏覽器
    if (/Edg/i.test(userAgent)) {
      browserName = 'Edge';
      browserVersion = userAgent.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
    } else if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) {
      browserName = 'Chrome';
      browserVersion = userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
    } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
      browserName = 'Safari';
      browserVersion = userAgent.match(/Version\/(\d+)/)?.[1] || 'Unknown';
    } else if (/Firefox/i.test(userAgent)) {
      browserName = 'Firefox';
      browserVersion = userAgent.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
    }

    return { name: browserName, version: browserVersion };
  },

  /**
   * 完整的裝置資訊
   * @returns {object} 包含所有裝置資訊
   */
  getDeviceInfo() {
    return {
      isMobile: this.isMobile(),
      isTablet: this.isTablet(),
      deviceType: this.getDeviceType(),
      os: this.getOS(),
      browser: this.getBrowser(),
      inAppBrowser: this.isInAppBrowser(),
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      userAgent: navigator.userAgent
    };
  },

  /**
   * 將裝置資訊輸出到 console（用於調試）
   */
  logDeviceInfo() {
    const info = this.getDeviceInfo();
    console.log('📱 裝置偵測資訊:');
    console.log('  裝置類型:', info.deviceType);
    console.log('  作業系統:', info.os);
    console.log('  瀏覽器:', `${info.browser.name} ${info.browser.version}`);
    console.log('  螢幕尺寸:', `${info.screenWidth}x${info.screenHeight}`);
    console.log('  In-App Browser:', info.inAppBrowser);
    console.log('  完整 UserAgent:', info.userAgent);
  }
};

// ===================================
// LINE In-App Browser 處理
// ===================================

const LINEBrowserHandler = {
  /**
   * 檢查並處理 LINE In-App Browser
   * 這個函數應在應用程式最開始執行，在任何 OAuth 流程之前
   *
   * @param {object} options - 設定選項
   * @param {boolean} options.autoRedirect - 是否自動重導向（預設: true）
   * @param {function} options.onDetected - 當偵測到 LINE 瀏覽器時的回調函數
   * @param {function} options.beforeRedirect - 重導向前的回調函數
   * @returns {boolean} 是否偵測到 LINE 瀏覽器
   */
  checkAndHandle(options = {}) {
    const {
      autoRedirect = true,
      onDetected = null,
      beforeRedirect = null
    } = options;

    // 檢查是否為 LINE In-App Browser
    const isLINE = DeviceDetector.isLINEBrowser();

    if (!isLINE) {
      console.log('✅ 不是 LINE In-App Browser，無需處理');
      return false;
    }

    console.log('⚠️ 偵測到 LINE In-App Browser');

    // 執行偵測回調
    if (onDetected && typeof onDetected === 'function') {
      onDetected();
    }

    // 檢查 URL 是否已包含 openExternalBrowser 參數
    const urlParams = new URLSearchParams(window.location.search);
    const hasExternalParam = urlParams.has('openExternalBrowser');

    if (hasExternalParam) {
      console.log('✅ URL 已包含 openExternalBrowser 參數，不再重導向');
      return true;
    }

    // 如果啟用自動重導向
    if (autoRedirect) {
      console.log('🔄 準備重導向到外部瀏覽器...');

      // 執行重導向前的回調
      if (beforeRedirect && typeof beforeRedirect === 'function') {
        beforeRedirect();
      }

      // 添加參數並重導向
      this.redirectToExternalBrowser();
    }

    return true;
  },

  /**
   * 重導向到外部瀏覽器
   * 在當前 URL 加上 openExternalBrowser=1 參數
   */
  redirectToExternalBrowser() {
    try {
      // 取得當前 URL
      const currentUrl = new URL(window.location.href);

      // 添加 openExternalBrowser 參數
      currentUrl.searchParams.set('openExternalBrowser', '1');

      const newUrl = currentUrl.toString();

      console.log('🔗 原始 URL:', window.location.href);
      console.log('🔗 新 URL:', newUrl);

      // 使用 window.location.replace() 重導向（不會在歷史記錄中留下痕跡）
      window.location.replace(newUrl);

    } catch (error) {
      console.error('❌ 重導向失敗:', error);

      // 備用方案：使用簡單的參數添加方式
      const separator = window.location.href.includes('?') ? '&' : '?';
      const newUrl = window.location.href + separator + 'openExternalBrowser=1';
      window.location.replace(newUrl);
    }
  },

  /**
   * 顯示使用者提示（如果自動重導向失敗）
   * @param {string} message - 自訂提示訊息
   */
  showUserPrompt(message = '請在外部瀏覽器中開啟以使用 Google 登入功能') {
    const promptHTML = `
      <div id="lineBrowserPrompt" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #00b900 0%, #009900 100%);
        color: white;
        padding: 16px 20px;
        text-align: center;
        font-size: 16px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 99999;
        line-height: 1.6;
      ">
        <div style="max-width: 800px; margin: 0 auto;">
          <div style="font-size: 24px; margin-bottom: 8px;">💚 LINE 用戶提示</div>
          <div style="font-size: 16px;">${message}</div>
          <div style="margin-top: 12px; font-size: 14px; opacity: 0.9;">
            點擊右上角「...」選單 → 選擇「在瀏覽器中開啟」
          </div>
          <button onclick="document.getElementById('lineBrowserPrompt').remove()"
            style="
              margin-top: 12px;
              padding: 8px 20px;
              background: white;
              color: #00b900;
              border: none;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
            ">
            我知道了
          </button>
        </div>
      </div>
    `;

    // 在頁面載入後插入提示
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.insertAdjacentHTML('afterbegin', promptHTML);
      });
    } else {
      document.body.insertAdjacentHTML('afterbegin', promptHTML);
    }
  }
};

// ===================================
// UI 切換工具
// ===================================

const UIAdapter = {
  /**
   * 根據裝置類型自動套用對應的 CSS class
   * 這會在 body 標籤上添加 'mobile-view', 'tablet-view', 或 'desktop-view' class
   */
  applyDeviceClass() {
    const deviceType = DeviceDetector.getDeviceType();

    // 移除所有裝置類別
    document.body.classList.remove('mobile-view', 'tablet-view', 'desktop-view');

    // 添加當前裝置類別
    document.body.classList.add(`${deviceType}-view`);

    console.log(`📱 套用裝置類別: ${deviceType}-view`);

    return deviceType;
  },

  /**
   * 設定全域 CSS 變數供樣式表使用
   */
  setDeviceCSSVariables() {
    const info = DeviceDetector.getDeviceInfo();

    document.documentElement.style.setProperty('--is-mobile', info.isMobile ? '1' : '0');
    document.documentElement.style.setProperty('--is-tablet', info.isTablet ? '1' : '0');
    document.documentElement.style.setProperty('--screen-width', `${info.screenWidth}px`);
    document.documentElement.style.setProperty('--screen-height', `${info.screenHeight}px`);
  },

  /**
   * 初始化 UI 適配
   * 應在頁面載入時立即執行
   */
  initialize() {
    // 檢查 body 是否存在，如果不存在則等待 DOM 載入
    if (!document.body) {
      console.log('⏳ document.body 尚未載入，等待 DOMContentLoaded...');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ DOM 已載入，開始套用裝置類別');
        this._doInitialize();
      });
      return null;
    } else {
      return this._doInitialize();
    }
  },

  _doInitialize() {
    const deviceType = this.applyDeviceClass();
    this.setDeviceCSSVariables();

    // 監聽視窗大小變化（用於響應式調整）
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.applyDeviceClass();
        this.setDeviceCSSVariables();
      }, 250);
    });

    return deviceType;
  },

  /**
   * 動態載入行動版 CSS（如果需要）
   * @param {string} cssPath - CSS 檔案路徑
   */
  loadMobileCSS(cssPath = 'mobile.css') {
    if (DeviceDetector.isMobile() && !document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssPath;
      document.head.appendChild(link);
      console.log('📱 已載入行動版 CSS');
    }
  }
};

// ===================================
// 自動初始化（可選）
// ===================================

/**
 * 自動初始化函數
 * 在頁面載入時自動執行裝置偵測和 LINE 瀏覽器檢查
 *
 * @param {object} options - 設定選項
 * @param {boolean} options.checkLINE - 是否檢查 LINE 瀏覽器（預設: true）
 * @param {boolean} options.autoRedirect - 是否自動重導向（預設: true）
 * @param {boolean} options.loadMobileCSS - 是否自動載入行動版 CSS（預設: true）
 * @param {boolean} options.logDeviceInfo - 是否輸出裝置資訊到 console（預設: true）
 */
function initDeviceDetection(options = {}) {
  const {
    checkLINE = true,
    autoRedirect = true,
    loadMobileCSS = true,
    logDeviceInfo = true
  } = options;

  console.log('🚀 開始裝置偵測初始化...');

  // 1. 檢查 LINE In-App Browser（優先執行，因為可能會重導向）
  if (checkLINE) {
    const isLINE = LINEBrowserHandler.checkAndHandle({
      autoRedirect,
      onDetected: () => {
        console.log('💚 偵測到 LINE 瀏覽器');
      },
      beforeRedirect: () => {
        console.log('🔄 即將重導向...');
      }
    });

    // 如果偵測到 LINE 且正在重導向，就不繼續執行後續步驟
    if (isLINE && autoRedirect && !new URLSearchParams(window.location.search).has('openExternalBrowser')) {
      return; // 頁面即將重導向，停止後續處理
    }
  }

  // 2. 初始化 UI 適配
  UIAdapter.initialize();

  // 3. 載入行動版 CSS（如果需要）
  if (loadMobileCSS) {
    UIAdapter.loadMobileCSS();
  }

  // 4. 輸出裝置資訊
  if (logDeviceInfo) {
    DeviceDetector.logDeviceInfo();
  }

  console.log('✅ 裝置偵測初始化完成');
}

// ===================================
// 導出到全域（供 HTML 使用）
// ===================================

window.DeviceDetector = DeviceDetector;
window.LINEBrowserHandler = LINEBrowserHandler;
window.UIAdapter = UIAdapter;
window.initDeviceDetection = initDeviceDetection;

// ===================================
// 使用範例（在 HTML 中）
// ===================================

/*
<!-- 在 HTML 的 <head> 中引入 -->
<script src="device-detector.js"></script>
<script>
  // 方法 1: 自動初始化（推薦）
  initDeviceDetection({
    checkLINE: true,        // 檢查 LINE 瀏覽器
    autoRedirect: true,     // 自動重導向
    loadMobileCSS: true,    // 自動載入行動版 CSS
    logDeviceInfo: true     // 輸出裝置資訊
  });

  // 方法 2: 手動控制
  // 檢查裝置類型
  if (DeviceDetector.isMobile()) {
    console.log('這是行動裝置');
  }

  // 檢查 LINE 瀏覽器
  if (DeviceDetector.isLINEBrowser()) {
    LINEBrowserHandler.redirectToExternalBrowser();
  }

  // 取得完整裝置資訊
  const deviceInfo = DeviceDetector.getDeviceInfo();
  console.log(deviceInfo);
</script>
*/
