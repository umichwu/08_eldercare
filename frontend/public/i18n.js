/**
 * 多語言支援模組
 * 支援：繁體中文、簡體中文、英文、日文、韓文
 */

// 語言資源
const translations = {
  'zh-TW': {
    // 頭部
    'app.title': '🏥 長輩陪伴助手',
    'header.voiceToggle': '語音開關',
    'header.settings': '設定',
    'header.logout': '登出',

    // 側邊欄
    'sidebar.title': '對話記錄',
    'sidebar.newChat': '➕ 新對話',

    // 歡迎畫面
    'welcome.title': '您好！我是您的陪伴助手 😊',
    'welcome.subtitle': '有什麼我可以幫您的嗎？',
    'quickAction.weather': '☀️ 天氣查詢',
    'quickAction.medication': '💊 用藥提醒',
    'quickAction.joke': '😄 聽笑話',
    'quickAction.health': '🏥 健康諮詢',

    // 輸入區域
    'input.placeholder': '輸入訊息...',
    'input.send': '傳送',
    'input.sos': '🆘 緊急求助',

    // 設定頁面
    'settings.title': '設定',
    'settings.language': '語言 / Language',
    'settings.fontSize': '字體大小',
    'settings.theme': '主題',
    'settings.close': '關閉',
    'settings.save': '儲存',

    // 字體大小選項
    'fontSize.small': '小',
    'fontSize.medium': '中',
    'fontSize.large': '大',
    'fontSize.extraLarge': '特大',

    // 主題選項
    'theme.light': '淺色',
    'theme.dark': '深色',

    // 訊息
    'message.loading': '載入中...',
    'message.error': '發生錯誤',
    'message.success': '成功',
    'message.languageChanged': '語言已變更',
    'message.summaryGenerated': '對話摘要已產生',

    // 右側面板
    'panel.summary': '💡 對話摘要',
    'panel.statistics': '📊 統計資訊',
    'panel.emptySummary': '尚無對話摘要',
    'panel.totalMessages': '訊息數',
    'panel.userMessages': '使用者訊息',
    'panel.aiMessages': 'AI 回應',
    'panel.generateSummary': '產生摘要',
    'panel.untilSummary': '距離總結',

    // 輸入區域
    'input.voiceInput': '🎤 語音輸入',

    // 時間格式
    'time.justNow': '剛剛',
    'time.minutesAgo': '分鐘前',
    'time.hoursAgo': '小時前',
    'time.daysAgo': '天前',

    // 快速訊息
    'quickMessage.weather': '今天天氣如何？',
    'quickMessage.medication': '提醒我吃藥',
    'quickMessage.joke': '講個笑話給我聽',
    'quickMessage.health': '我覺得有點不舒服'
  },

  'zh-CN': {
    'app.title': '🏥 长辈陪伴助手',
    'header.voiceToggle': '语音开关',
    'header.settings': '设置',
    'header.logout': '登出',

    'sidebar.title': '对话记录',
    'sidebar.newChat': '➕ 新对话',

    'welcome.title': '您好！我是您的陪伴助手 😊',
    'welcome.subtitle': '有什么我可以帮您的吗？',
    'quickAction.weather': '☀️ 天气查询',
    'quickAction.medication': '💊 用药提醒',
    'quickAction.joke': '😄 听笑话',
    'quickAction.health': '🏥 健康咨询',

    'input.placeholder': '输入消息...',
    'input.send': '发送',
    'input.sos': '🆘 紧急求助',

    'settings.title': '设置',
    'settings.language': '语言 / Language',
    'settings.fontSize': '字体大小',
    'settings.theme': '主题',
    'settings.close': '关闭',
    'settings.save': '保存',

    'fontSize.small': '小',
    'fontSize.medium': '中',
    'fontSize.large': '大',
    'fontSize.extraLarge': '特大',

    'theme.light': '浅色',
    'theme.dark': '深色',

    'message.loading': '载入中...',
    'message.error': '发生错误',
    'message.success': '成功',
    'message.languageChanged': '语言已变更',
    'message.summaryGenerated': '对话摘要已生成',

    'panel.summary': '💡 对话摘要',
    'panel.statistics': '📊 统计信息',
    'panel.emptySummary': '尚无对话摘要',
    'panel.totalMessages': '消息数',
    'panel.userMessages': '用户消息',
    'panel.aiMessages': 'AI 回应',
    'panel.generateSummary': '生成摘要',
    'panel.untilSummary': '距离总结',
    'input.voiceInput': '🎤 语音输入',

    'time.justNow': '刚刚',
    'time.minutesAgo': '分钟前',
    'time.hoursAgo': '小时前',
    'time.daysAgo': '天前',

    'quickMessage.weather': '今天天气如何？',
    'quickMessage.medication': '提醒我吃药',
    'quickMessage.joke': '讲个笑话给我听',
    'quickMessage.health': '我觉得有点不舒服'
  },

  'en-US': {
    'app.title': '🏥 ElderCare Companion',
    'header.voiceToggle': 'Voice Toggle',
    'header.settings': 'Settings',
    'header.logout': 'Logout',

    'sidebar.title': 'Conversations',
    'sidebar.newChat': '➕ New Chat',

    'welcome.title': 'Hello! I\'m your companion assistant 😊',
    'welcome.subtitle': 'How can I help you today?',
    'quickAction.weather': '☀️ Weather',
    'quickAction.medication': '💊 Medication',
    'quickAction.joke': '😄 Tell a Joke',
    'quickAction.health': '🏥 Health',

    'input.placeholder': 'Type a message...',
    'input.send': 'Send',
    'input.sos': '🆘 Emergency',

    'settings.title': 'Settings',
    'settings.language': 'Language / 語言',
    'settings.fontSize': 'Font Size',
    'settings.theme': 'Theme',
    'settings.close': 'Close',
    'settings.save': 'Save',

    'fontSize.small': 'Small',
    'fontSize.medium': 'Medium',
    'fontSize.large': 'Large',
    'fontSize.extraLarge': 'Extra Large',

    'theme.light': 'Light',
    'theme.dark': 'Dark',

    'message.loading': 'Loading...',
    'message.error': 'Error occurred',
    'message.success': 'Success',
    'message.languageChanged': 'Language changed',
    'message.summaryGenerated': 'Summary generated',

    'panel.summary': '💡 Conversation Summary',
    'panel.statistics': '📊 Statistics',
    'panel.emptySummary': 'No summary available',
    'panel.totalMessages': 'Total Messages',
    'panel.userMessages': 'User Messages',
    'panel.aiMessages': 'AI Responses',
    'panel.generateSummary': 'Generate Summary',
    'panel.untilSummary': 'Until Summary',
    'input.voiceInput': '🎤 Voice Input',

    'time.justNow': 'Just now',
    'time.minutesAgo': 'minutes ago',
    'time.hoursAgo': 'hours ago',
    'time.daysAgo': 'days ago',

    'quickMessage.weather': 'How\'s the weather today?',
    'quickMessage.medication': 'Remind me to take medicine',
    'quickMessage.joke': 'Tell me a joke',
    'quickMessage.health': 'I\'m not feeling well'
  },

  'ja-JP': {
    'app.title': '🏥 高齢者介護アシスタント',
    'header.voiceToggle': '音声切替',
    'header.settings': '設定',
    'header.logout': 'ログアウト',

    'sidebar.title': '会話履歴',
    'sidebar.newChat': '➕ 新しい会話',

    'welcome.title': 'こんにちは！あなたの介護アシスタントです 😊',
    'welcome.subtitle': '何かお手伝いできることはありますか？',
    'quickAction.weather': '☀️ 天気',
    'quickAction.medication': '💊 服薬',
    'quickAction.joke': '😄 ジョーク',
    'quickAction.health': '🏥 健康相談',

    'input.placeholder': 'メッセージを入力...',
    'input.send': '送信',
    'input.sos': '🆘 緊急',

    'settings.title': '設定',
    'settings.language': '言語 / Language',
    'settings.fontSize': '文字サイズ',
    'settings.theme': 'テーマ',
    'settings.close': '閉じる',
    'settings.save': '保存',

    'fontSize.small': '小',
    'fontSize.medium': '中',
    'fontSize.large': '大',
    'fontSize.extraLarge': '特大',

    'theme.light': 'ライト',
    'theme.dark': 'ダーク',

    'message.loading': '読み込み中...',
    'message.error': 'エラーが発生しました',
    'message.success': '成功',
    'message.languageChanged': '言語が変更されました',
    'message.summaryGenerated': '会話の要約が生成されました',

    'panel.summary': '💡 会話の要約',
    'panel.statistics': '📊 統計情報',
    'panel.emptySummary': '要約はまだありません',
    'panel.totalMessages': 'メッセージ数',
    'panel.userMessages': 'ユーザーメッセージ',
    'panel.aiMessages': 'AI応答',
    'panel.generateSummary': '要約を生成',
    'panel.untilSummary': '要約まで',
    'input.voiceInput': '🎤 音声入力',

    'time.justNow': 'たった今',
    'time.minutesAgo': '分前',
    'time.hoursAgo': '時間前',
    'time.daysAgo': '日前',

    'quickMessage.weather': '今日の天気は？',
    'quickMessage.medication': '薬を飲むリマインダー',
    'quickMessage.joke': 'ジョークを教えて',
    'quickMessage.health': '体調が悪いです'
  },

  'ko-KR': {
    'app.title': '🏥 노인 돌봄 도우미',
    'header.voiceToggle': '음성 전환',
    'header.settings': '설정',
    'header.logout': '로그아웃',

    'sidebar.title': '대화 기록',
    'sidebar.newChat': '➕ 새 대화',

    'welcome.title': '안녕하세요! 저는 당신의 돌봄 도우미입니다 😊',
    'welcome.subtitle': '무엇을 도와드릴까요?',
    'quickAction.weather': '☀️ 날씨',
    'quickAction.medication': '💊 복약',
    'quickAction.joke': '😄  농담',
    'quickAction.health': '🏥 건강 상담',

    'input.placeholder': '메시지를 입력하세요...',
    'input.send': '전송',
    'input.sos': '🆘 긴급',

    'settings.title': '설정',
    'settings.language': '언어 / Language',
    'settings.fontSize': '글꼴 크기',
    'settings.theme': '테마',
    'settings.close': '닫기',
    'settings.save': '저장',

    'fontSize.small': '소',
    'fontSize.medium': '중',
    'fontSize.large': '대',
    'fontSize.extraLarge': '특대',

    'theme.light': '라이트',
    'theme.dark': '다크',

    'message.loading': '로딩 중...',
    'message.error': '오류가 발생했습니다',
    'message.success': '성공',
    'message.languageChanged': '언어가 변경되었습니다',
    'message.summaryGenerated': '대화 요약이 생성되었습니다',

    'panel.summary': '💡 대화 요약',
    'panel.statistics': '📊 통계 정보',
    'panel.emptySummary': '요약이 아직 없습니다',
    'panel.totalMessages': '메시지 수',
    'panel.userMessages': '사용자 메시지',
    'panel.aiMessages': 'AI 응답',
    'panel.generateSummary': '요약 생성',
    'panel.untilSummary': '요약까지',
    'input.voiceInput': '🎤 음성 입력',

    'time.justNow': '방금',
    'time.minutesAgo': '분 전',
    'time.hoursAgo': '시간 전',
    'time.daysAgo': '일 전',

    'quickMessage.weather': '오늘 날씨는 어때요?',
    'quickMessage.medication': '약 복용 알림',
    'quickMessage.joke': '농담 들려주세요',
    'quickMessage.health': '몸이 좀 안 좋아요'
  }
};

// 語言資訊
const languages = [
  { code: 'zh-TW', name: '繁體中文', nativeName: '繁體中文' },
  { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
  { code: 'ja-JP', name: '日本語', nativeName: '日本語' },
  { code: 'ko-KR', name: '한국어', nativeName: '한국어' }
];

// 當前語言
let currentLanguage = localStorage.getItem('language') || 'zh-TW';

/**
 * 取得翻譯文字
 */
function t(key, defaultValue = key) {
  return translations[currentLanguage]?.[key] || defaultValue;
}

/**
 * 設定語言
 */
function setLanguage(langCode) {
  if (translations[langCode]) {
    currentLanguage = langCode;
    localStorage.setItem('language', langCode);
    document.documentElement.lang = langCode;
    updatePageContent();
    return true;
  }
  return false;
}

/**
 * 取得當前語言
 */
function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * 取得支援的語言列表
 */
function getSupportedLanguages() {
  return languages;
}

/**
 * 更新頁面內容
 */
function updatePageContent() {
  // 更新所有帶有 data-i18n 屬性的元素
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });

  // 更新所有帶有 data-i18n-placeholder 屬性的輸入框
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    element.placeholder = t(key);
  });

  // 更新所有帶有 data-i18n-title 屬性的元素
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    element.title = t(key);
  });

  // 更新快速訊息按鈕
  document.querySelectorAll('.quick-btn').forEach((btn, index) => {
    const messageKeys = [
      'quickMessage.weather',
      'quickMessage.medication',
      'quickMessage.joke',
      'quickMessage.health'
    ];
    if (messageKeys[index]) {
      btn.setAttribute('data-message', t(messageKeys[index]));
    }
  });

  // 觸發語言變更事件
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: currentLanguage } }));

  // 重新渲染時間相關的內容
  if (window.renderConversations) {
    window.renderConversations();
  }
  if (window.renderMessages) {
    window.renderMessages();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  updatePageContent();
});

// 導出功能
window.i18n = {
  t,
  setLanguage,
  getCurrentLanguage,
  getSupportedLanguages,
  updatePageContent
};
