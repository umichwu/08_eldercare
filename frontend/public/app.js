// ===================================
// ElderCare Frontend Application
// ===================================

// API URL - 從全域配置讀取 (config.js)
// 注意：API_BASE_URL 已在 config.js 中定義為全域變數，這裡不需要重新宣告

console.log('🔗 API Base URL:', API_BASE_URL);

// 注意：LLM 配置已移至 config.js，請在該檔案中修改 DEFAULT_LLM_PROVIDER

// 全域狀態 - 使用者資訊
let currentUserId = null; // 將由 initElderCareApp 初始化
let currentUserProfile = null; // 將由 initElderCareApp 初始化

// 全域狀態 - 對話相關
let currentConversation = null;
let conversations = [];
let messages = [];
let isVoiceEnabled = true;
let isSpeaking = false;

// 全域狀態 - 地理位置
let userLocation = null; // { city, lat, lng, localTime }

// 防止無限循環的標記
let isLoadingConversations = false;
let loadConversationsTimeout = null;
let lastRenderTime = 0;
let appInitialized = false;

// Web Speech API
let recognition = null;
let synthesis = window.speechSynthesis;

// ===================================
// 初始化
// ===================================

// 注意：DOMContentLoaded 事件監聽器已在 index.html 中設置
// 這個函式會被 index.html 中的認證檢查完成後呼叫

window.initElderCareApp = async function(user, profile) {
  // 防止重複初始化
  if (appInitialized) {
    console.warn('⚠️ 應用程式已經初始化過，跳過重複初始化');
    updateDebugInfo();
    return;
  }

  console.log('🚀 ElderCare 應用程式啟動');

  // 儲存使用者資訊
  if (user && user.id) {
    currentUserId = user.id;
    currentUserProfile = profile;
    console.log('✅ 使用者資訊已載入:', currentUserId);
    updateDebugInfo();
  } else {
    console.error('❌ 未提供使用者資訊');
    alert('系統錯誤：無法取得使用者資訊');
    updateDebugInfo();
    return;
  }

  await initializeApp();
  setupEventListeners();
  setupVoiceRecognition();

  appInitialized = true;
  console.log('✅ 應用程式初始化完成');
  updateDebugInfo();
};

async function initializeApp() {
  showLoading();

  try {
    // 獲取地理位置
    await getUserLocation();

    // 載入對話列表
    await loadConversations();

    // 如果有對話，載入第一個
    if (conversations.length > 0) {
      await selectConversation(conversations[0].id);
    }

    hideLoading();
  } catch (error) {
    console.error('初始化失敗:', error);
    hideLoading();
    alert('載入失敗，請重新整理頁面');
  }
}

// ===================================
// 地理位置功能
// ===================================

async function getUserLocation() {
  console.log('📍 開始獲取地理位置...');

  // 檢查瀏覽器是否支援地理位置
  if (!navigator.geolocation) {
    console.warn('⚠️ 瀏覽器不支援地理位置');
    return;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log('✅ 已獲取經緯度:', latitude, longitude);

        try {
          // 使用反向地理編碼獲取城市名稱（使用 OpenStreetMap Nominatim）
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=zh-TW`
          );
          const data = await response.json();

          // 提取城市名稱
          const city = data.address.city ||
                      data.address.town ||
                      data.address.village ||
                      data.address.county ||
                      data.address.state ||
                      '未知地點';

          // 獲取當地時間
          const localTime = new Date().toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });

          userLocation = {
            city: city,
            lat: latitude.toFixed(4),
            lng: longitude.toFixed(4),
            localTime: localTime
          };

          console.log('✅ 地理位置資訊已設定:', userLocation);
        } catch (error) {
          console.error('❌ 反向地理編碼失敗:', error);
          // 即使無法獲取城市名稱，仍然保存經緯度
          userLocation = {
            city: '未知地點',
            lat: latitude.toFixed(4),
            lng: longitude.toFixed(4),
            localTime: new Date().toLocaleString('zh-TW')
          };
        }

        resolve();
      },
      (error) => {
        console.warn('⚠️ 無法獲取地理位置:', error.message);
        console.log('💡 將在需要時詢問使用者所在城市');
        resolve(); // 即使失敗也繼續初始化
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000 // 5分鐘內的快取位置可接受
      }
    );
  });
}

// ===================================
// 事件監聽器
// ===================================

function setupEventListeners() {
  console.log('📎 設置事件監聽器...');

  // 行動版漢堡選單按鈕
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleSidebar);
    console.log('✅ 行動版選單按鈕已綁定');
  }

  // 側邊欄遮罩點擊關閉
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
    console.log('✅ 側邊欄遮罩已綁定');
  }

  // 新對話按鈕
  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      console.log('🔵 新對話按鈕被點擊');
      createNewConversation();
    });
    console.log('✅ 新對話按鈕已綁定');
  } else {
    console.error('❌ 找不到新對話按鈕');
  }

  // 傳送訊息
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      console.log('🔵 傳送按鈕被點擊');

      // 視覺反饋
      sendBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        sendBtn.style.transform = 'scale(1)';
      }, 100);

      sendMessage();
    });
    console.log('✅ 傳送按鈕已綁定');

    // 標記按鈕已綁定（用於調試檢查）
    sendBtn.dataset.bound = 'true';
  } else {
    console.error('❌ 找不到傳送按鈕');
  }

  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log('⌨️ Enter 鍵被按下');
        e.preventDefault();
        sendMessage();
      }
    });
    console.log('✅ 訊息輸入框已綁定');
  } else {
    console.error('❌ 找不到訊息輸入框');
  }

  // 語音輸入按鈕
  document.getElementById('voiceInputBtn').addEventListener('click', startVoiceInput);

  // 語音開關
  document.getElementById('voiceToggle').addEventListener('click', toggleVoice);

  // SOS 按鈕
  document.getElementById('sosBtn').addEventListener('click', showSosModal);
  document.getElementById('sosConfirmBtn').addEventListener('click', sendSOS);
  document.getElementById('sosCancelBtn').addEventListener('click', hideSosModal);

  // 快捷操作按鈕（歡迎畫面）
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const message = btn.dataset.message;
      // ✅ 只有有 data-message 的按鈕才觸發 sendMessage
      // 沒有 data-message 的按鈕（如用藥管理）會使用 onclick 導航
      if (message) {
        document.getElementById('messageInput').value = message;
        sendMessage();
      }
    });
  });

  // 快捷按鈕（輸入框上方 - 持續顯示）
  document.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const messageKey = btn.dataset.message;
      // ✅ 只有有 data-message 的按鈕才觸發 sendMessage
      // 沒有 data-message 的按鈕（如用藥管理）會使用 onclick 導航
      if (messageKey) {
        const message = window.i18n ? window.i18n.t(messageKey) : messageKey;
        document.getElementById('messageInput').value = message;
        sendMessage();
      }
    });
  });

  // 產生總結按鈕
  document.getElementById('generateSummaryBtn').addEventListener('click', generateSummary);

  // 網路搜尋開關
  const webSearchToggle = document.getElementById('webSearchToggle');
  if (webSearchToggle) {
    // 初始化開關狀態
    initializeWebSearchToggle();

    // 監聽開關變化
    webSearchToggle.addEventListener('change', handleWebSearchToggle);
    console.log('✅ 網路搜尋開關已綁定');
  }

  // 快速功能按鈕（行動版）
  const quickFunctionsBtn = document.getElementById('quickFunctionsBtn');
  if (quickFunctionsBtn) {
    quickFunctionsBtn.addEventListener('click', showQuickFunctionsModal);
  }

  // 快速功能選單項目
  document.querySelectorAll('.quick-function-item').forEach(btn => {
    if (btn.id === 'sosQuickBtn') {
      btn.addEventListener('click', () => {
        hideQuickFunctionsModal();
        showSosModal();
      });
    } else {
      btn.addEventListener('click', () => {
        const message = btn.dataset.message;
        document.getElementById('messageInput').value = message;
        hideQuickFunctionsModal();
        sendMessage();
      });
    }
  });

  // 關閉快速功能選單
  document.getElementById('closeQuickFunctionsBtn').addEventListener('click', hideQuickFunctionsModal);
}

// ===================================
// 快速功能選單控制
// ===================================

function showQuickFunctionsModal() {
  const modal = document.getElementById('quickFunctionsModal');
  if (modal) {
    modal.style.display = 'flex';
    console.log('⚡ 快速功能選單已打開');
  }
}

function hideQuickFunctionsModal() {
  const modal = document.getElementById('quickFunctionsModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('⚡ 快速功能選單已關閉');
  }
}

// ===================================
// 網路搜尋開關控制
// ===================================

function initializeWebSearchToggle() {
  const webSearchToggle = document.getElementById('webSearchToggle');
  const webSearchStatus = document.getElementById('webSearchStatus');

  if (!webSearchToggle || !webSearchStatus) {
    console.warn('⚠️ 找不到網路搜尋開關元素');
    return;
  }

  // 從 localStorage 讀取設定，如果沒有則使用 config.js 的預設值
  const savedSetting = localStorage.getItem('webSearchEnabled');
  let isEnabled;

  if (savedSetting === null) {
    // 首次載入，使用 config.js 的預設值
    isEnabled = typeof DEFAULT_WEB_SEARCH_ENABLED !== 'undefined' ? DEFAULT_WEB_SEARCH_ENABLED : true;
    console.log(`🔍 首次載入網路搜尋設定，使用預設值: ${isEnabled ? '啟用' : '停用'}`);
  } else {
    // 使用儲存的設定
    isEnabled = savedSetting === 'true';
    console.log(`🔍 載入網路搜尋設定: ${isEnabled ? '啟用' : '停用'}`);
  }

  // 設定開關狀態
  webSearchToggle.checked = isEnabled;

  // 更新狀態文字
  updateWebSearchStatus(isEnabled);
}

function handleWebSearchToggle(event) {
  const isEnabled = event.target.checked;

  // 儲存到 localStorage
  localStorage.setItem('webSearchEnabled', isEnabled.toString());

  // 更新狀態文字
  updateWebSearchStatus(isEnabled);

  console.log(`🔍 網路搜尋設定已變更: ${isEnabled ? '啟用' : '停用'}`);
}

function updateWebSearchStatus(isEnabled) {
  const webSearchStatus = document.getElementById('webSearchStatus');

  if (webSearchStatus) {
    webSearchStatus.textContent = isEnabled ? '已啟用' : '已停用';
    webSearchStatus.style.color = isEnabled ? '#28a745' : '#dc3545';
  }
}

// ===================================
// 行動版側邊欄控制
// ===================================

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (sidebar && overlay) {
    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }
}

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (sidebar && overlay) {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    console.log('📂 側邊欄已打開');
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (sidebar && overlay) {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    console.log('📁 側邊欄已關閉');
  }
}

// ===================================
// API 呼叫
// ===================================

async function apiCall(endpoint, method = 'GET', data = null) {
  // 追蹤 API 呼叫來源
  const stack = new Error().stack;
  console.log('🌐 API 呼叫:', method, endpoint);
  console.log('📍 呼叫來源:', stack.split('\n')[2]); // 顯示呼叫者

  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
    console.log('📦 請求資料:', data);
  }

  try {
    const response = await fetch(url, options);

    // 讀取回應內容
    const contentType = response.headers.get('content-type');
    let responseData;

    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      // 從後端回應中提取錯誤訊息
      let errorMessage = `API 錯誤 (${response.status})`;

      if (typeof responseData === 'object' && responseData.error) {
        errorMessage = responseData.error;
        if (responseData.details) {
          errorMessage += `\n詳情: ${responseData.details}`;
        }
      } else if (typeof responseData === 'string') {
        errorMessage += `: ${responseData}`;
      } else {
        errorMessage += `: ${response.statusText}`;
      }

      console.error('❌ API 錯誤回應:', responseData);
      throw new Error(errorMessage);
    }

    console.log('✅ API 回應:', responseData);
    return responseData;
  } catch (error) {
    // 網路錯誤或其他異常
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('網路連線失敗，請檢查網路連線或後端服務是否正常');
    }
    throw error;
  }
}

// ===================================
// 對話管理
// ===================================

async function loadConversations() {
  // 防止重複呼叫
  if (isLoadingConversations) {
    console.warn('⚠️ loadConversations 已在執行中，跳過此次呼叫');
    return;
  }

  // 清除之前的 timeout
  if (loadConversationsTimeout) {
    clearTimeout(loadConversationsTimeout);
  }

  isLoadingConversations = true;
  console.log('📋 載入對話列表...');

  try {
    conversations = await apiCall(`/api/conversations?userId=${currentUserId}`);
    console.log(`✅ 載入了 ${conversations.length} 個對話`);
    renderConversationList();
  } catch (error) {
    console.error('❌ 載入對話失敗:', error);
  } finally {
    // 使用 setTimeout 確保在下次事件循環才重置標記
    loadConversationsTimeout = setTimeout(() => {
      isLoadingConversations = false;
    }, 500); // 500ms 防抖
  }
}

async function createNewConversation() {
  console.log('🆕 開始建立新對話...');
  console.log('當前使用者 ID:', currentUserId);

  if (!currentUserId) {
    console.error('❌ currentUserId 未設置');
    alert('系統錯誤：使用者資訊遺失');
    return;
  }

  try {
    showLoading();

    console.log('發送 POST 請求到 /api/conversations');
    const conversation = await apiCall('/api/conversations', 'POST', {
      userId: currentUserId,
      title: '新對話',
      channel: 'web'
    });

    console.log('✅ 對話已建立:', conversation);

    conversations.unshift(conversation);
    await selectConversation(conversation.id);

    hideLoading();
    speakText('已建立新對話');
  } catch (error) {
    console.error('❌ 建立對話失敗:', error);
    hideLoading();
    alert('建立對話失敗：' + error.message);
  }
}

// 處理對話點擊（包含行動版關閉側邊欄）
function handleConversationClick(conversationId) {
  selectConversation(conversationId);

  // 在行動版上，點擊對話後關閉側邊欄
  if (typeof DeviceDetector !== 'undefined' && DeviceDetector.isMobile()) {
    closeSidebar();
  }
}

async function selectConversation(conversationId) {
  console.log('📂 選擇對話:', conversationId);

  try {
    currentConversation = conversations.find(c => c.id === conversationId);

    if (!currentConversation) {
      console.error('找不到對話');
      return;
    }

    // 載入訊息
    messages = await apiCall(`/api/conversations/${conversationId}/messages?userId=${currentUserId}`);

    // 更新 UI
    renderConversationList();
    renderMessages();
    updateStats();

    // 隱藏歡迎畫面，顯示聊天區
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('chatMessages').style.display = 'block';

    // 載入最新總結
    await loadLatestSummary();
  } catch (error) {
    console.error('選擇對話失敗:', error);
  }
}

// 刪除對話（僅從 UI 移除，不刪除資料庫）
function deleteConversationFromUI(conversationId) {
  console.log('🗑️ 刪除對話（僅 UI）:', conversationId);

  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) {
    console.error('找不到對話');
    return;
  }

  // 確認對話框
  if (!confirm(`確定要刪除對話「${conversation.title}」嗎？\n\n注意：這只會從列表中移除，資料庫中的記錄仍會保留。`)) {
    console.log('使用者取消刪除');
    return;
  }

  try {
    // 從本地陣列中移除
    const index = conversations.findIndex(c => c.id === conversationId);
    if (index > -1) {
      conversations.splice(index, 1);
      console.log(`✅ 已從 UI 移除對話 (${conversations.length} 個剩餘)`);
    }

    // 如果刪除的是當前對話，清空訊息區
    if (currentConversation && currentConversation.id === conversationId) {
      currentConversation = null;
      messages = [];

      // 顯示歡迎畫面
      document.getElementById('welcomeScreen').style.display = 'flex';
      document.getElementById('chatMessages').style.display = 'none';
      document.getElementById('chatMessages').innerHTML = '';
    }

    // 重新渲染對話列表
    renderConversationList();

    // 在行動版上關閉側邊欄
    if (typeof DeviceDetector !== 'undefined' && DeviceDetector.isMobile()) {
      closeSidebar();
    }

    console.log('✅ 對話已從 UI 刪除');
  } catch (error) {
    console.error('❌ 刪除對話失敗:', error);
    alert('刪除對話時發生錯誤：' + error.message);
  }
}

// 編輯對話標題
async function editConversationTitle(conversationId) {
  console.log('✏️ 編輯對話標題:', conversationId);

  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) {
    console.error('找不到對話');
    return;
  }

  const currentTitle = conversation.title;
  const newTitle = prompt('請輸入新的對話標題：', currentTitle);

  // 使用者取消或輸入空白
  if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) {
    console.log('取消編輯或標題未變更');
    return;
  }

  try {
    showLoading();

    // 發送 API 請求更新標題
    const response = await apiCall(
      `/api/conversations/${conversationId}`,
      'PUT',
      {
        userId: currentUserId,
        title: newTitle.trim()
      }
    );

    console.log('✅ 對話標題更新成功:', response);

    // 更新本地資料
    conversation.title = newTitle.trim();

    // 重新渲染對話列表
    renderConversationList();

    hideLoading();
  } catch (error) {
    console.error('❌ 更新對話標題失敗:', error);
    alert('更新標題失敗：' + error.message);
    hideLoading();
  }
}

// ===================================
// 訊息處理
// ===================================

async function sendMessage() {
  console.log('📤 sendMessage() 被呼叫');

  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  console.log('📝 訊息內容:', content);
  console.log('👤 當前使用者 ID:', currentUserId);
  console.log('💬 當前對話:', currentConversation);

  if (!content) {
    console.warn('⚠️ 訊息內容為空，取消發送');
    return;
  }

  if (!currentConversation) {
    console.log('🆕 沒有對話，創建新對話...');
    await createNewConversation();
  }

  try {
    showLoading();

    // 清空輸入框
    input.value = '';

    // 立即顯示使用者訊息（樂觀更新）
    const userMessage = {
      role: 'user',
      content,
      created_at: new Date().toISOString()
    };
    messages.push(userMessage);
    renderMessages();

    // ✅ 讀取 LLM 提供商設定（優先使用 localStorage，否則使用檔案頂部定義的預設值）
    // 如果要永久修改預設值，請編輯檔案頂部的 DEFAULT_LLM_PROVIDER 常量
    const llmProvider = localStorage.getItem('llmProvider') || DEFAULT_LLM_PROVIDER;

    // ✅ 特殊標記：只有 'gemini-frontend' 才使用前端直接調用
    // 其他情況（包括 'gemini'）都使用後端 API
    if (llmProvider === 'gemini-frontend') {
      console.log('🌟 使用前端直接調用 Gemini API...');
      console.log('⚠️ 注意：前端直接調用可能會遇到 API 配額限制');

      // 從 localStorage 獲取 Gemini API Key
      const geminiApiKey = localStorage.getItem('geminiApiKey');

      if (!geminiApiKey) {
        console.error('❌ 未設定 Gemini API Key');
        throw new Error('請在設定中配置 Gemini API Key，或改用後端 API');
      }

      console.log('🔑 使用 Gemini API Key:', geminiApiKey.substring(0, 10) + '...');

      // 構建對話歷史
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // 將地理位置資訊插入到最新的使用者訊息中
      if (conversationHistory.length > 0) {
        const lastMessage = conversationHistory[conversationHistory.length - 1];

        if (lastMessage.role === 'user') {
          if (userLocation) {
            // 更新當地時間（確保時間是最新的）
            userLocation.localTime = new Date().toLocaleString('zh-TW', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });

            // 有地理位置資訊，插入到訊息前面
            const locationContext = `[位置資訊]
城市：${userLocation.city}
經緯度：${userLocation.lat}, ${userLocation.lng}
當地時間：${userLocation.localTime}
[位置資訊結束]

`;
            lastMessage.parts[0].text = locationContext + lastMessage.parts[0].text;
            console.log('📍 已將地理位置資訊加入訊息上下文');
          } else {
            // 沒有地理位置資訊
            const noLocationMarker = '[位置資訊不可用]\n\n';
            lastMessage.parts[0].text = noLocationMarker + lastMessage.parts[0].text;
            console.log('⚠️ 未獲取到地理位置資訊');
          }
        }
      }

      // 調用 Gemini API（啟用 Google Search）
      console.log('🤖 正在生成 Gemini 回應...');
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: conversationHistory,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
            },
            systemInstruction: {
              parts: [{
                text: `你是一個專為老年人設計的溫暖陪伴助手。請用簡單、親切、自然的語氣回應，像是在和家人聊天。

**核心原則：**
- 使用簡單易懂的語言
- 回答簡潔明確，避免冗長
- 只在第一次對話或久未對話時才簡短問候（如「早安」）
- 後續對話直接回答問題，不需要重複問候或天氣資訊
- 避免複雜術語
- 關心使用者的身體健康和情緒
- 如果使用者提到不舒服或緊急情況，要特別關注並建議尋求協助

**對話風格：**
- 第一次對話：可以簡短問候（1句話）+ 回答問題
- 後續對話：直接回答問題，不需要額外的問候、天氣、建議等
- 只在使用者「主動詢問天氣」時才提供天氣資訊
- 只在使用者「主動尋求建議」時才提供建議

**位置資訊處理：**
- 當訊息中包含「[位置資訊]」時，自然使用城市名稱
- 絕對不要提及經緯度數值
- 時間資訊為當地實際時間，用於判斷早上/中午/晚上

**天氣查詢（僅在使用者主動詢問時）：**
- 簡短說明天氣狀況（溫度 + 天氣描述）
- 如有特殊情況（極端溫度、下雨等）才給予1句簡短建議
- 不需要溫馨結語或對話引導

**Google Search 使用原則：**
- 只提供最核心的 2-3 個重點
- 將專業術語轉換成白話中文
- 不要提及「我使用了 Google 搜尋」
- 簡潔呈現資訊，避免冗長`
              }]
            },
            tools: [{
              googleSearch: {}
            }]
          })
        }
      );

      if (!geminiResponse.ok) {
        const errorData = await geminiResponse.text();
        console.error('❌ Gemini API 錯誤:', errorData);
        throw new Error('Gemini API 調用失敗，請檢查 API Key');
      }

      const geminiData = await geminiResponse.json();

      // 檢查是否使用了 Google Search
      if (geminiData.candidates[0].groundingMetadata) {
        console.log('🔍 使用了 Google Search 工具');
        console.log('📊 搜尋來源:', geminiData.candidates[0].groundingMetadata);
      }

      const aiContent = geminiData.candidates[0].content.parts[0].text;

      console.log('✅ Gemini 回應成功，內容長度:', aiContent.length);

      // 保存到後端數據庫
      const saveResponse = await apiCall(
        `/api/conversations/${currentConversation.id}/messages/save`,
        'POST',
        {
          userId: currentUserId,
          userMessage: content,
          assistantMessage: aiContent,
          provider: 'gemini',
          model: 'gemini-2.0-flash-exp'
        }
      );

      // 更新訊息列表
      messages[messages.length - 1] = saveResponse.userMessage;
      messages.push(saveResponse.assistantMessage);

      renderMessages();
      updateStats();
      hideLoading();

      // 語音播放回應
      speakText(aiContent);

      // 重新載入總結狀態
      await loadLatestSummary();

    } else {
      // ✅ 使用後端 API（Gemini、OpenAI 或 Deepseek）
      // 後端會使用配置在 Render 環境變數中的 API Key
      console.log('🌐 使用後端 API...');
      console.log('📍 URL:', `/conversations/${currentConversation.id}/messages`);
      console.log('🤖 LLM Provider:', llmProvider);

      // 準備訊息內容，加入地理位置和時間資訊
      let messageContent = content;

      if (userLocation) {
        // 更新當地時間（確保時間是最新的）
        const now = new Date();

        // 獲取完整的日期時間字串（包含年份和星期）
        const dateTimeStr = now.toLocaleString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Taipei'
        });

        // 獲取星期幾
        const weekday = now.toLocaleString('zh-TW', {
          weekday: 'long',
          timeZone: 'Asia/Taipei'
        });

        userLocation.localTime = dateTimeStr;
        userLocation.weekday = weekday;

        // 將地理位置資訊附加到訊息前面（包含完整的日期、星期、時間）
        const geoInfo = `[地理位置資訊]\n座標: ${userLocation.lat}, ${userLocation.lng}\n城市: ${userLocation.city}\n日期時間: ${userLocation.localTime} (${userLocation.weekday})\n[/地理位置資訊]\n\n`;
        messageContent = geoInfo + content;
        console.log('📍 已附加地理位置資訊:', userLocation);
      } else {
        console.warn('⚠️ 尚未獲取地理位置資訊');
      }

      // 讀取網路搜尋設定
      const webSearchEnabled = localStorage.getItem('webSearchEnabled') === 'false' ? false :
                               (localStorage.getItem('webSearchEnabled') === 'true' ? true : DEFAULT_WEB_SEARCH_ENABLED);

      console.log('📦 資料:', { userId: currentUserId, content: messageContent, webSearchEnabled });

      const response = await apiCall(
        `/api/conversations/${currentConversation.id}/messages`,
        'POST',
        {
          userId: currentUserId,
          content: messageContent,
          // ✅ 直接傳遞 llmProvider 給後端
          // 'gemini' → 使用後端 Gemini Key Pool（推薦）
          // 'openai' → 使用 OpenAI
          // 'deepseek' → 使用 DeepSeek
          llmProvider: llmProvider,
          // 🔍 傳遞網路搜尋設定
          webSearchEnabled: webSearchEnabled
        }
      );

      console.log('✅ API 回應成功:', response);

      // 更新訊息列表
      messages[messages.length - 1] = response.userMessage;
      messages.push(response.assistantMessage);

      renderMessages();
      updateStats();
      hideLoading();

      // 語音播放回應
      speakText(response.assistantMessage.content);

      // 重新載入總結狀態
      await loadLatestSummary();
    }
  } catch (error) {
    console.error('❌ 傳送訊息失敗:', error);
    console.error('錯誤詳情:', error.message);
    console.error('錯誤堆疊:', error.stack);
    hideLoading();
    alert('傳送失敗，請重試: ' + error.message);
  }
}

// ===================================
// 總結功能
// ===================================

async function loadLatestSummary() {
  if (!currentConversation) return;

  try {
    const summary = await apiCall(
      `/api/conversations/${currentConversation.id}/summaries/latest?userId=${currentUserId}`
    );

    const summaryContent = document.getElementById('summaryContent');

    if (summary && summary.summary) {
      summaryContent.innerHTML = `<p>${summary.summary.replace(/\n/g, '<br>')}</p>`;
      document.getElementById('generateSummaryBtn').style.display = 'block';
    } else {
      const emptyText = window.i18n ? window.i18n.t('panel.emptySummary') : '尚無對話摘要';
      summaryContent.innerHTML = `<p class="empty-state" data-i18n="panel.emptySummary">${emptyText}</p>`;
      document.getElementById('generateSummaryBtn').style.display = 'block';
    }
  } catch (error) {
    console.error('載入總結失敗:', error);
  }
}

async function generateSummary() {
  if (!currentConversation) return;

  try {
    showLoading();

    const summary = await apiCall(
      `/api/conversations/${currentConversation.id}/summaries`,
      'POST',
      { userId: currentUserId }
    );

    const summaryContent = document.getElementById('summaryContent');
    summaryContent.innerHTML = `<p>${summary.summary.replace(/\n/g, '<br>')}</p>`;

    hideLoading();
    const message = window.i18n ? window.i18n.t('message.summaryGenerated') : '對話摘要已產生';
    speakText(message);
  } catch (error) {
    console.error('產生總結失敗:', error);
    hideLoading();
    alert('產生總結失敗');
  }
}

// ===================================
// 語音功能
// ===================================

function setupVoiceRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn('此瀏覽器不支援語音辨識');
    document.getElementById('voiceInputBtn').disabled = true;
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();

  recognition.lang = 'zh-TW';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('messageInput').value = transcript;
    speakText('已辨識您的語音，請確認後傳送');
  };

  recognition.onerror = (event) => {
    console.error('語音辨識錯誤:', event.error);
    speakText('語音辨識失敗，請再試一次');
  };

  recognition.onend = () => {
    document.getElementById('voiceInputBtn').textContent = '🎤 語音輸入';
  };
}

function startVoiceInput() {
  if (!recognition) {
    alert('您的瀏覽器不支援語音輸入');
    return;
  }

  try {
    recognition.start();
    document.getElementById('voiceInputBtn').textContent = '🎤 聆聽中...';
    speakText('請說話');
  } catch (error) {
    console.error('啟動語音辨識失敗:', error);
  }
}

function speakText(text) {
  console.log(`🔊 speakText called: "${text}"`);
  console.log(`   isVoiceEnabled: ${isVoiceEnabled}, isSpeaking: ${isSpeaking}`);

  if (!isVoiceEnabled) {
    console.log('   ❌ 語音已關閉，不播放');
    return;
  }

  if (isSpeaking) {
    console.log('   ⏳ 正在播放中，等待前一個播放完成');
    return;
  }

  // 停止之前的語音
  synthesis.cancel();

  // 短暫延遲，確保 cancel 完成
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.9; // 稍慢的語速
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      isSpeaking = true;
      console.log('   ✅ 語音開始播放');
    };

    utterance.onend = () => {
      isSpeaking = false;
      console.log('   ✅ 語音播放結束');
    };

    utterance.onerror = (event) => {
      isSpeaking = false;
      console.error('   ❌ 語音播放錯誤:', event);
    };

    console.log('   🎤 開始播放語音...');
    synthesis.speak(utterance);
  }, 100); // 100ms 延遲
}

function toggleVoice() {
  const btn = document.getElementById('voiceToggle');

  if (isVoiceEnabled) {
    // 目前是開啟，準備關閉
    isVoiceEnabled = false;
    btn.textContent = '🔇';
    btn.title = '點擊開啟語音';
    synthesis.cancel(); // 停止當前播放
    console.log('🔇 語音已關閉');
  } else {
    // 目前是關閉，準備開啟
    isVoiceEnabled = true;
    btn.textContent = '🔊';
    btn.title = '點擊關閉語音';
    console.log('🔊 語音已開啟');
    // 播放確認訊息
    speakText('語音已開啟');
  }
}

// ===================================
// SOS 緊急功能
// ===================================

function showSosModal() {
  document.getElementById('sosModal').style.display = 'flex';
  speakText('確認要發送緊急通知嗎？');
}

function hideSosModal() {
  document.getElementById('sosModal').style.display = 'none';
}

async function sendSOS() {
  hideSosModal();
  showLoading();

  // 模擬 SOS 通知（實際應該呼叫後端 API）
  setTimeout(() => {
    hideLoading();
    alert('✅ 緊急通知已發送給家人！');
    speakText('緊急通知已發送，請保持冷靜，家人很快就會聯絡您');
  }, 1500);
}

// ===================================
// UI 渲染
// ===================================

function renderConversationList() {
  // 防抖：避免短時間內重複渲染
  const now = Date.now();
  if (now - lastRenderTime < 200) {
    console.warn('⚠️ renderConversationList 呼叫太頻繁，跳過');
    return;
  }
  lastRenderTime = now;

  console.log('🎨 渲染對話列表 (' + conversations.length + ' 個對話)');

  const container = document.getElementById('conversationList');
  if (!container) {
    console.error('❌ 找不到 conversationList 容器');
    return;
  }

  if (conversations.length === 0) {
    container.innerHTML = '<p class="empty-state">尚無對話記錄</p>';
    return;
  }

  container.innerHTML = conversations
    .map(
      conv => `
    <div class="conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}"
         onclick="handleConversationClick('${conv.id}')">
      <div class="conversation-header">
        <div class="conversation-title" id="conv-title-${conv.id}">${conv.title}</div>
        <div class="conversation-actions">
          <button class="edit-title-btn" onclick="event.stopPropagation(); editConversationTitle('${conv.id}')" title="編輯標題">
            ✏️
          </button>
          <button class="delete-conv-btn" onclick="event.stopPropagation(); deleteConversationFromUI('${conv.id}')" title="刪除對話">
            🗑️
          </button>
        </div>
      </div>
      <div class="conversation-time">${formatTime(conv.updated_at || conv.created_at)}</div>
    </div>
  `
    )
    .join('');
}

// ===================================
// Markdown 渲染輔助函數
// ===================================

/**
 * 渲染 Markdown 內容為 HTML
 * @param {string} content - 原始文字內容
 * @param {string} role - 消息角色 ('user' 或 'assistant')
 * @returns {string} 渲染後的 HTML
 */
function renderMarkdown(content, role) {
  // 只對 AI 回覆使用 Markdown 渲染
  if (role === 'assistant' && typeof marked !== 'undefined') {
    try {
      // 配置 marked 選項
      marked.setOptions({
        breaks: true,        // 支援單行換行（GitHub Flavored Markdown）
        gfm: true,          // 啟用 GitHub Flavored Markdown
        headerIds: false,   // 不生成標題 ID（避免重複）
        mangle: false,      // 不混淆郵件地址
        sanitize: false     // 不清除 HTML（由 DOMPurify 處理更安全，但這裡暫不使用）
      });

      // 渲染 Markdown
      return marked.parse(content);
    } catch (error) {
      console.error('Markdown 渲染失敗:', error);
      // 降級為純文字，但保留換行
      return content.replace(/\n/g, '<br>');
    }
  }

  // 使用者訊息：保留換行但不使用 Markdown
  return content.replace(/\n/g, '<br>');
}

function renderMessages() {
  const container = document.getElementById('chatMessages');

  if (messages.length === 0) {
    container.innerHTML = '<p class="empty-state">開始對話吧！</p>';
    return;
  }

  container.innerHTML = messages
    .map(
      msg => {
        // 获取 LLM 提供商信息
        const provider = msg.metadata?.provider || msg.metadata?.model || '';
        const llmBadge = msg.role === 'assistant' && provider ?
          `<span class="llm-badge llm-${provider.toLowerCase()}">${getLLMDisplayName(provider)}</span>` : '';

        // 渲染訊息內容（AI 回覆使用 Markdown）
        const renderedContent = renderMarkdown(msg.content, msg.role);

        return `
    <div class="message ${msg.role}">
      <div class="message-content ${msg.role === 'assistant' ? 'markdown-content' : ''}">
        ${renderedContent}
        <div class="message-footer">
          ${llmBadge}
          <div class="message-time">${formatTime(msg.created_at)}</div>
        </div>
      </div>
    </div>
  `;
      }
    )
    .join('');

  // 捲動到最新訊息（使用 setTimeout 確保 DOM 已更新）
  setTimeout(() => {
    scrollToBottom();
  }, 100);
}

// 获取 LLM 显示名称
function getLLMDisplayName(provider) {
  const names = {
    'gemini': '🌟 Gemini',
    'openai': '🤖 ChatGPT',
    'deepseek': '🧠 Deepseek',
    'gpt-4o-mini': '🤖 ChatGPT',
    'gemini-2.0-flash-exp': '🌟 Gemini',
    'deepseek-chat': '🧠 Deepseek'
  };
  return names[provider.toLowerCase()] || `🤖 ${provider}`;
}

// 平滑捲動到底部
function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  // 使用平滑捲動
  container.scrollTo({
    top: container.scrollHeight,
    behavior: 'smooth'
  });
}

function updateStats() {
  if (!currentConversation) return;

  document.getElementById('messageCount').textContent = messages.length;

  const threshold = 20;
  const progress = currentConversation.messages_since_last_summary || messages.length % threshold;
  document.getElementById('summaryProgress').textContent = `${progress}/${threshold}`;
}

// ===================================
// 工具函式
// ===================================

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // 取得當前語言
  const lang = window.i18n ? window.i18n.getCurrentLanguage() : 'zh-TW';
  const t = window.i18n ? window.i18n.t : (key) => key;

  // 小於 1 分鐘
  if (diff < 60000) {
    return t('time.justNow');
  }

  // 小於 1 小時
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} ${t('time.minutesAgo')}`;
  }

  // 小於 24 小時
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} ${t('time.hoursAgo')}`;
  }

  // 小於 7 天
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} ${t('time.daysAgo')}`;
  }

  // 超過 7 天，顯示日期（根據語言）
  return date.toLocaleDateString(lang);
}

function showLoading() {
  document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

// ===================================
// 調試工具
// ===================================

function updateDebugInfo() {
  // 更新使用者 ID
  const userIdEl = document.getElementById('debugUserId');
  if (userIdEl) {
    if (currentUserId) {
      userIdEl.textContent = currentUserId.substring(0, 8) + '...';
      userIdEl.style.color = '#27ae60';
    } else {
      userIdEl.textContent = '未初始化';
      userIdEl.style.color = '#d63031';
    }
  }

  // 更新對話狀態
  const convEl = document.getElementById('debugConversation');
  if (convEl) {
    if (currentConversation && currentConversation.id) {
      convEl.textContent = currentConversation.title || '新對話';
      convEl.style.color = '#27ae60';
    } else {
      convEl.textContent = '無';
      convEl.style.color = '#d63031';
    }
  }

  // 更新應用狀態
  const statusEl = document.getElementById('debugAppStatus');
  if (statusEl) {
    if (appInitialized) {
      statusEl.textContent = '✅ 已初始化';
      statusEl.style.color = '#27ae60';
    } else {
      statusEl.textContent = '⏳ 載入中...';
      statusEl.style.color = '#f39c12';
    }
  }

  // 更新按鈕狀態
  const btnEl = document.getElementById('debugButtonStatus');
  if (btnEl) {
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn && sendBtn.dataset.bound === 'true') {
      btnEl.textContent = '✅ 已綁定';
      btnEl.style.color = '#27ae60';
    } else if (sendBtn) {
      btnEl.textContent = '❌ 未綁定';
      btnEl.style.color = '#d63031';
    } else {
      btnEl.textContent = '❌ 找不到按鈕';
      btnEl.style.color = '#d63031';
    }
  }
}

// 測試傳送按鈕
window.testSendButton = function() {
  console.log('🧪 測試傳送按鈕被點擊');
  alert('🧪 測試訊息\n\n' +
    '使用者 ID: ' + (currentUserId || '未設定') + '\n' +
    '當前對話: ' + (currentConversation ? currentConversation.id : '無') + '\n' +
    '應用狀態: ' + (appInitialized ? '已初始化' : '未初始化') + '\n\n' +
    '如果看到這個訊息，表示 JavaScript 正常運作。\n' +
    '請查看瀏覽器 Console (F12) 以獲取更多資訊。'
  );

  // 嘗試觸發傳送
  const input = document.getElementById('messageInput');
  if (input) {
    input.value = '測試訊息 ' + new Date().toLocaleTimeString();
    console.log('📝 已填入測試訊息');
  }

  updateDebugInfo();
};

// 顯示如何查看 Console 的說明
window.showConsoleInstructions = function() {
  alert('📋 如何查看瀏覽器 Console\n\n' +
    '在 Windows Chrome:\n' +
    '1. 按下鍵盤 F12 鍵\n' +
    '2. 或按 Ctrl + Shift + J\n' +
    '3. 或右鍵點擊頁面 → 選擇「檢查」\n\n' +
    '開啟後，請切換到「Console」分頁，\n' +
    '然後嘗試點擊傳送按鈕，\n' +
    '您會看到詳細的執行記錄。\n\n' +
    '請將 Console 中的所有訊息\n' +
    '（包括紅色的錯誤）複製給我。'
  );
};

// 每 2 秒更新一次調試資訊
setInterval(updateDebugInfo, 2000);

// 全域函式（供 HTML onclick 使用）
window.selectConversation = selectConversation;

console.log('✅ ElderCare 應用程式已就緒');
