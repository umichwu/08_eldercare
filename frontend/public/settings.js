/**
 * 設定模組
 * 管理使用者偏好設定（語言、字體大小、主題等）
 */

class SettingsManager {
  constructor() {
    this.modal = null;
    this.currentSettings = {
      language: localStorage.getItem('language') || 'zh-TW',
      fontSize: parseInt(localStorage.getItem('fontSize')) || 24,
      theme: localStorage.getItem('theme') || 'light',
      llmProvider: localStorage.getItem('llmProvider') || 'gemini'
    };
    this.init();
  }

  /**
   * 初始化設定管理器
   */
  init() {
    this.createModal();
    this.attachEventListeners();
    this.applySettings();
  }

  /**
   * 建立設定模態框
   */
  createModal() {
    const modalHTML = `
      <div id="settingsModal" class="modal" style="display: none;">
        <div class="modal-content settings-modal">
          <div class="modal-header">
            <h2 data-i18n="settings.title">設定</h2>
            <button class="modal-close" id="closeSettings">&times;</button>
          </div>
          <div class="modal-body">
            <!-- 語言設定 -->
            <div class="setting-group">
              <label class="setting-label" data-i18n="settings.language">
                語言 / Language
              </label>
              <select id="languageSelect" class="setting-select">
                <!-- 動態載入語言選項 -->
              </select>
            </div>

            <!-- 字體大小設定 -->
            <div class="setting-group">
              <label class="setting-label" data-i18n="settings.fontSize">
                字體大小
              </label>
              <div class="font-size-options">
                <button class="font-size-btn" data-size="18" data-i18n="fontSize.small">小</button>
                <button class="font-size-btn" data-size="24" data-i18n="fontSize.medium">中</button>
                <button class="font-size-btn" data-size="32" data-i18n="fontSize.large">大</button>
                <button class="font-size-btn" data-size="40" data-i18n="fontSize.extraLarge">特大</button>
              </div>
            </div>

            <!-- 主題設定 -->
            <div class="setting-group">
              <label class="setting-label" data-i18n="settings.theme">
                主題
              </label>
              <div class="theme-options">
                <button class="theme-btn" data-theme="light" data-i18n="theme.light">
                  ☀️ 淺色
                </button>
                <button class="theme-btn" data-theme="dark" data-i18n="theme.dark">
                  🌙 深色
                </button>
              </div>
            </div>

            <!-- LLM提供商設定 -->
            <div class="setting-group">
              <label class="setting-label" data-i18n="settings.llmProvider">
                AI 模型
              </label>
              <select id="llmProviderSelect" class="setting-select">
                <option value="gemini">Google Gemini (推薦免費)</option>
                <option value="openai">OpenAI ChatGPT</option>
                <option value="deepseek">Deepseek</option>
              </select>
            </div>

            <!-- Gemini API Key 設定 -->
            <div class="setting-group" id="geminiApiKeyGroup">
              <label class="setting-label">
                Gemini API Key (選填)
                <a href="https://aistudio.google.com/app/apikey" target="_blank" style="font-size: 12px; margin-left: 8px;">
                  (取得免費 API Key)
                </a>
              </label>
              <input
                type="password"
                id="geminiApiKeyInput"
                class="setting-input"
                placeholder="已使用預設 API Key（可選填自己的）"
                style="font-family: monospace;"
              />
              <small style="color: #666; font-size: 12px; margin-top: 4px; display: block;">
                💡 POC 階段已提供預設 API Key，您也可以使用自己的 Key
              </small>
            </div>
          </div>
          <div class="modal-footer">
            <button id="saveSettings" class="btn btn-primary" data-i18n="settings.save">
              儲存
            </button>
            <button id="cancelSettings" class="btn btn-secondary" data-i18n="settings.close">
              關閉
            </button>
          </div>
        </div>
      </div>
    `;

    // 插入到 body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('settingsModal');

    // 載入語言選項
    this.loadLanguageOptions();

    // 載入LLM提供商選項
    this.loadLLMProviderOptions();

    // 更新選擇狀態
    this.updateSelectedOptions();
  }

  /**
   * 載入LLM提供商選項
   */
  loadLLMProviderOptions() {
    const select = document.getElementById('llmProviderSelect');
    if (select) {
      select.value = this.currentSettings.llmProvider;
    }
  }

  /**
   * 載入語言選項
   */
  loadLanguageOptions() {
    const select = document.getElementById('languageSelect');
    const languages = window.i18n.getSupportedLanguages();

    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.nativeName;
      if (lang.code === this.currentSettings.language) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  /**
   * 綁定事件監聽器
   */
  attachEventListeners() {
    // 開啟設定
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.show());
    }

    // 關閉設定
    const closeBtn = document.getElementById('closeSettings');
    const cancelBtn = document.getElementById('cancelSettings');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hide());
    }

    // 點擊背景關閉
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // 語言變更
    const languageSelect = document.getElementById('languageSelect');
    languageSelect.addEventListener('change', (e) => {
      this.currentSettings.language = e.target.value;
    });

    // LLM提供商變更
    const llmProviderSelect = document.getElementById('llmProviderSelect');
    if (llmProviderSelect) {
      llmProviderSelect.addEventListener('change', (e) => {
        this.currentSettings.llmProvider = e.target.value;
      });
    }

    // 字體大小按鈕
    document.querySelectorAll('.font-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = parseInt(btn.dataset.size);
        this.currentSettings.fontSize = size;
        console.log(`🔧 字體大小已變更為: ${size}px`);

        // 立即套用（預覽效果）
        this.applySettings();
      });
    });

    // 主題按鈕
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentSettings.theme = btn.dataset.theme;
        console.log(`🔧 主題已變更為: ${btn.dataset.theme}`);

        // 立即套用（預覽效果）
        this.applySettings();
      });
    });

    // 儲存設定
    const saveBtn = document.getElementById('saveSettings');
    saveBtn.addEventListener('click', () => this.saveSettings());
  }

  /**
   * 更新選擇狀態
   */
  updateSelectedOptions() {
    // 更新字體大小按鈕
    document.querySelectorAll('.font-size-btn').forEach(btn => {
      const size = parseInt(btn.dataset.size);
      if (size === this.currentSettings.fontSize) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 更新主題按鈕
    document.querySelectorAll('.theme-btn').forEach(btn => {
      if (btn.dataset.theme === this.currentSettings.theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * 套用設定
   */
  applySettings() {
    // 套用字體大小到 root element
    document.documentElement.style.setProperty('--base-font-size', `${this.currentSettings.fontSize}px`);

    // 同時直接套用到 body（確保立即生效）
    document.body.style.fontSize = `${this.currentSettings.fontSize}px`;

    console.log(`✅ 字體大小已設定為: ${this.currentSettings.fontSize}px`);

    // 套用主題
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${this.currentSettings.theme}`);

    console.log(`✅ 主題已設定為: ${this.currentSettings.theme}`);

    // 套用語言
    if (window.i18n) {
      window.i18n.setLanguage(this.currentSettings.language);
    }

    // 更新按鈕選中狀態
    this.updateSelectedOptions();
  }

  /**
   * 儲存設定
   */
  async saveSettings() {
    try {
      // 儲存 Gemini API Key
      const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
      if (geminiApiKeyInput && geminiApiKeyInput.value) {
        localStorage.setItem('geminiApiKey', geminiApiKeyInput.value.trim());
      }

      // 儲存到 localStorage
      localStorage.setItem('language', this.currentSettings.language);
      localStorage.setItem('fontSize', this.currentSettings.fontSize);
      localStorage.setItem('theme', this.currentSettings.theme);
      localStorage.setItem('llmProvider', this.currentSettings.llmProvider);

      // 套用設定
      this.applySettings();

      // 如果使用者已登入，同步到後端
      const userId = localStorage.getItem('userId');
      if (userId) {
        await this.syncToBackend(userId);
      }

      // 顯示成功訊息
      this.showToast(window.i18n.t('message.success'));

      // 關閉模態框
      this.hide();
    } catch (error) {
      console.error('❌ 儲存設定失敗:', error);
      this.showToast(window.i18n.t('message.error'), 'error');
    }
  }

  /**
   * 同步設定到後端
   */
  async syncToBackend(userId) {
    try {
      const response = await fetch('http://localhost:3000/api/users/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          preferences: {
            language: this.currentSettings.language,
            fontSize: this.currentSettings.fontSize,
            theme: this.currentSettings.theme,
            llmProvider: this.currentSettings.llmProvider
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to sync settings');
      }

      console.log('✅ 設定已同步到後端');
    } catch (error) {
      console.error('❌ 同步設定到後端失敗:', error);
      // 不拋出錯誤，因為本地設定已儲存
    }
  }

  /**
   * 顯示設定模態框
   */
  show() {
    this.modal.style.display = 'flex';

    // 載入已保存的 Gemini API Key
    const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
    const savedGeminiApiKey = localStorage.getItem('geminiApiKey');
    if (geminiApiKeyInput && savedGeminiApiKey) {
      geminiApiKeyInput.value = savedGeminiApiKey;
    }

    // 更新翻譯
    if (window.i18n) {
      window.i18n.updatePageContent();
    }
  }

  /**
   * 隱藏設定模態框
   */
  hide() {
    this.modal.style.display = 'none';
  }

  /**
   * 顯示提示訊息
   */
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 3 秒後移除
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * 從後端載入設定
   */
  async loadFromBackend(userId) {
    try {
      const response = await fetch(`http://localhost:3000/api/users/profile?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to load user profile');
      }

      const profile = await response.json();

      // 更新設定
      if (profile.language) {
        this.currentSettings.language = profile.language;
      }
      if (profile.font_size) {
        this.currentSettings.fontSize = profile.font_size;
      }
      if (profile.theme) {
        this.currentSettings.theme = profile.theme;
      }
      if (profile.llm_provider) {
        this.currentSettings.llmProvider = profile.llm_provider;
      }

      // 套用設定
      this.applySettings();
      this.updateSelectedOptions();
      this.loadLLMProviderOptions();

      console.log('✅ 從後端載入設定成功');
    } catch (error) {
      console.error('❌ 從後端載入設定失敗:', error);
    }
  }
}

// 初始化設定管理器
let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
  settingsManager = new SettingsManager();

  // 如果使用者已登入，載入後端設定
  const userId = localStorage.getItem('userId');
  if (userId) {
    settingsManager.loadFromBackend(userId);
  }
});

// 導出
window.settingsManager = settingsManager;
