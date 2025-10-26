// ===================================
// ElderCare Frontend Application
// ===================================

// API URL - 自動根據環境選擇
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : 'https://eldercare-backend-8o4k.onrender.com/api'; // Vercel 上後端在同一個域名下

console.log('🔗 API Base URL:', API_BASE_URL);

// 全域狀態 - 使用者資訊
let currentUserId = null; // 將由 initElderCareApp 初始化
let currentUserProfile = null; // 將由 initElderCareApp 初始化

// 全域狀態 - 對話相關
let currentConversation = null;
let conversations = [];
let messages = [];
let isVoiceEnabled = true;
let isSpeaking = false;

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
    return;
  }

  console.log('🚀 ElderCare 應用程式啟動');

  // 儲存使用者資訊
  if (user && user.id) {
    currentUserId = user.id;
    currentUserProfile = profile;
    console.log('✅ 使用者資訊已載入:', currentUserId);
  } else {
    console.error('❌ 未提供使用者資訊');
    alert('系統錯誤：無法取得使用者資訊');
    return;
  }

  await initializeApp();
  setupEventListeners();
  setupVoiceRecognition();

  appInitialized = true;
  console.log('✅ 應用程式初始化完成');
};

async function initializeApp() {
  showLoading();

  try {
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
// 事件監聽器
// ===================================

function setupEventListeners() {
  console.log('📎 設置事件監聽器...');

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
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

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
      document.getElementById('messageInput').value = message;
      sendMessage();
    });
  });

  // 快捷按鈕（輸入框上方 - 持續顯示）
  document.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const messageKey = btn.dataset.message;
      const message = window.i18n ? window.i18n.t(messageKey) : messageKey;
      document.getElementById('messageInput').value = message;
      sendMessage();
    });
  });

  // 產生總結按鈕
  document.getElementById('generateSummaryBtn').addEventListener('click', generateSummary);
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
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API 錯誤: ${response.statusText}`);
  }

  return await response.json();
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
    conversations = await apiCall(`/conversations?userId=${currentUserId}`);
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
    const conversation = await apiCall('/conversations', 'POST', {
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

async function selectConversation(conversationId) {
  try {
    currentConversation = conversations.find(c => c.id === conversationId);

    if (!currentConversation) {
      console.error('找不到對話');
      return;
    }

    // 載入訊息
    messages = await apiCall(`/conversations/${conversationId}/messages?userId=${currentUserId}`);

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

// ===================================
// 訊息處理
// ===================================

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content) return;

  if (!currentConversation) {
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

    // 發送到後端
    const response = await apiCall(
      `/conversations/${currentConversation.id}/messages`,
      'POST',
      {
        userId: currentUserId,
        content
      }
    );

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
  } catch (error) {
    console.error('傳送訊息失敗:', error);
    hideLoading();
    alert('傳送失敗，請重試');
  }
}

// ===================================
// 總結功能
// ===================================

async function loadLatestSummary() {
  if (!currentConversation) return;

  try {
    const summary = await apiCall(
      `/conversations/${currentConversation.id}/summaries/latest?userId=${currentUserId}`
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
      `/conversations/${currentConversation.id}/summaries`,
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
  if (!isVoiceEnabled || isSpeaking) return;

  // 停止之前的語音
  synthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-TW';
  utterance.rate = 0.9; // 稍慢的語速
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    isSpeaking = true;
  };

  utterance.onend = () => {
    isSpeaking = false;
  };

  synthesis.speak(utterance);
}

function toggleVoice() {
  isVoiceEnabled = !isVoiceEnabled;
  const btn = document.getElementById('voiceToggle');
  btn.textContent = isVoiceEnabled ? '🔊' : '🔇';

  if (!isVoiceEnabled) {
    synthesis.cancel();
  }

  speakText(isVoiceEnabled ? '語音已開啟' : '語音已關閉');
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
         onclick="selectConversation('${conv.id}')">
      <div class="conversation-title">${conv.title}</div>
      <div class="conversation-time">${formatTime(conv.updated_at || conv.created_at)}</div>
    </div>
  `
    )
    .join('');
}

function renderMessages() {
  const container = document.getElementById('chatMessages');

  if (messages.length === 0) {
    container.innerHTML = '<p class="empty-state">開始對話吧！</p>';
    return;
  }

  container.innerHTML = messages
    .map(
      msg => `
    <div class="message ${msg.role}">
      <div class="message-content">
        ${msg.content}
        <div class="message-time">${formatTime(msg.created_at)}</div>
      </div>
    </div>
  `
    )
    .join('');

  // 捲動到最新訊息（使用 setTimeout 確保 DOM 已更新）
  setTimeout(() => {
    scrollToBottom();
  }, 100);
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

// 全域函式（供 HTML onclick 使用）
window.selectConversation = selectConversation;

console.log('✅ ElderCare 應用程式已就緒');
