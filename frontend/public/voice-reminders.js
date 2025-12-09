/**
 * 生活提醒語音功能 - 使用 Web Speech API
 */

// 全域變數
let recognition = null;
let speechSynthesis = window.speechSynthesis;
let isListening = false;
let voiceConversationBox = null;
let voiceMicBtn = null;
let voiceStopBtn = null;
let voiceListeningIndicator = null;
let voiceStatusText = null;

// 初始化語音功能
function initVoiceReminders() {
    console.log('🎤 初始化生活提醒語音功能...');

    // 初始化 DOM 元素
    voiceConversationBox = document.getElementById('voiceConversationBox');
    voiceMicBtn = document.getElementById('voiceMicBtn');
    voiceStopBtn = document.getElementById('voiceStopBtn');
    voiceListeningIndicator = document.getElementById('voiceListeningIndicator');
    voiceStatusText = document.getElementById('voiceStatusText');

    // 初始化語音辨識
    initVoiceSpeechRecognition();

    // 設定事件監聽器
    setupVoiceEventListeners();

    // 載入語音列表
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', () => {
            const voices = speechSynthesis.getVoices();
            console.log('🔊 語音列表已載入:', voices.length, '個語音');
        });
    }

    console.log('✅ 生活提醒語音功能初始化完成');
}

// 初始化語音辨識
function initVoiceSpeechRecognition() {
    console.log('🎙️ 初始化語音辨識...');

    // 檢查瀏覽器支援
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('❌ 瀏覽器不支援語音辨識');
        addVoiceMessage('assistant', '抱歉，您的瀏覽器不支援語音辨識功能。<br>建議使用 <strong>Chrome</strong> 或 <strong>Edge</strong> 瀏覽器。');
        if (voiceMicBtn) {
            voiceMicBtn.disabled = true;
            voiceMicBtn.style.opacity = '0.5';
            voiceMicBtn.style.cursor = 'not-allowed';
        }
        return;
    }

    console.log('✅ 瀏覽器支援語音辨識');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    recognition.lang = 'zh-TW';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        console.log('🎤 語音辨識開始');
        isListening = true;
        voiceMicBtn.classList.add('active');
        voiceListeningIndicator.classList.add('active');
        voiceStatusText.textContent = '正在聆聽，請說話...';
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('聽到:', transcript);

        addVoiceMessage('user', transcript);
        processVoiceCommand(transcript);
    };

    recognition.onerror = (event) => {
        console.error('語音辨識錯誤:', event.error);

        let errorMessage = '發生錯誤，請再試一次';
        if (event.error === 'no-speech') {
            errorMessage = '沒有聽到您的聲音，請再說一次';
        } else if (event.error === 'audio-capture') {
            errorMessage = '無法使用麥克風，請檢查權限設定';
        } else if (event.error === 'not-allowed') {
            errorMessage = '麥克風權限被拒絕，請在瀏覽器設定中允許麥克風';
        }

        addVoiceMessage('assistant', errorMessage);
        speakVoice(errorMessage);
        resetVoiceRecognition();
    };

    recognition.onend = () => {
        console.log('🎤 語音辨識結束');
        resetVoiceRecognition();
    };
}

// 重置辨識狀態
function resetVoiceRecognition() {
    isListening = false;
    voiceMicBtn.classList.remove('active');
    voiceListeningIndicator.classList.remove('active');
    voiceStatusText.textContent = '點擊麥克風說話';
}

// 設定事件監聽器
function setupVoiceEventListeners() {
    if (!voiceMicBtn) {
        console.error('❌ 找不到語音麥克風按鈕');
        return;
    }

    voiceMicBtn.addEventListener('click', () => {
        console.log('🎤 語音麥克風按鈕被點擊');

        // 停止正在播放的語音
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }

        if (!recognition) {
            console.error('❌ 語音辨識未初始化');
            addVoiceMessage('assistant', '抱歉，語音辨識功能無法使用。');
            return;
        }

        try {
            recognition.start();
        } catch (error) {
            console.log('⚠️ 語音辨識已在運行中:', error.message);
        }
    });

    if (voiceStopBtn) {
        voiceStopBtn.addEventListener('click', () => {
            console.log('🛑 停止按鈕被點擊');
            if (recognition && isListening) {
                recognition.stop();
            }
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            }
        });
    }
}

// 添加訊息到對話框
function addVoiceMessage(role, message) {
    if (!voiceConversationBox) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `voice-message ${role}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'voice-avatar';
    avatarDiv.textContent = role === 'user' ? '👤' : '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'voice-content';
    contentDiv.innerHTML = message;

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    voiceConversationBox.appendChild(messageDiv);

    // 滾動到底部
    voiceConversationBox.scrollTop = voiceConversationBox.scrollHeight;
}

// 語音播報
function speakVoice(text, callback) {
    if (!speechSynthesis) {
        console.error('❌ 瀏覽器不支援語音合成');
        return;
    }

    // 取消正在播放的語音
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.9;  // 稍微放慢速度
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // 選擇中文語音
    const voices = speechSynthesis.getVoices();
    const chineseVoice = voices.find(voice =>
        voice.lang === 'zh-TW' || voice.lang === 'zh-CN' || voice.lang.startsWith('zh')
    );
    if (chineseVoice) {
        utterance.voice = chineseVoice;
    }

    utterance.onend = () => {
        console.log('✅ 語音播報完成');
        if (callback) callback();
    };

    utterance.onerror = (error) => {
        console.error('❌ 語音播報錯誤:', error);
    };

    speechSynthesis.speak(utterance);
}

// 處理語音指令
async function processVoiceCommand(command) {
    const lowerCommand = command.toLowerCase().trim();

    console.log('處理語音指令:', lowerCommand);

    // 查詢今日提醒
    if (lowerCommand.includes('今天') || lowerCommand.includes('今日') || lowerCommand.includes('查詢') || lowerCommand.includes('有什麼')) {
        await handleQueryTodayReminders();
    }
    // 新增提醒
    else if (lowerCommand.includes('新增') || lowerCommand.includes('增加') || lowerCommand.includes('建立') || lowerCommand.includes('設定')) {
        handleCreateReminder(command);
    }
    // 標記完成
    else if (lowerCommand.includes('完成') || lowerCommand.includes('做完') || lowerCommand.includes('已經')) {
        handleMarkComplete(command);
    }
    // 喝水提醒
    else if (lowerCommand.includes('喝水')) {
        handleQuickReminder('water', '喝水');
    }
    // 運動提醒
    else if (lowerCommand.includes('運動')) {
        handleQuickReminder('exercise', '運動');
    }
    // 用藥提醒
    else if (lowerCommand.includes('吃藥') || lowerCommand.includes('用藥')) {
        handleQuickReminder('medication', '用藥');
    }
    // 幫助
    else if (lowerCommand.includes('幫助') || lowerCommand.includes('怎麼') || lowerCommand.includes('可以')) {
        handleHelp();
    }
    // 其他
    else {
        const response = '抱歉，我不太理解您的指令。您可以說：\n• 今天有什麼提醒\n• 新增喝水提醒\n• 標記完成\n• 幫助';
        addVoiceMessage('assistant', response);
        speakVoice(response);
    }
}

// 查詢今日提醒
async function handleQueryTodayReminders() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/daily-reminders/today/${currentElderId}`,
            {
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                }
            }
        );

        if (!response.ok) throw new Error('查詢失敗');

        const result = await response.json();
        const reminders = result.data || [];

        if (reminders.length === 0) {
            const msg = '您今天沒有設定任何提醒。';
            addVoiceMessage('assistant', msg);
            speakVoice(msg);
            return;
        }

        // 統計
        const total = reminders.length;
        const completed = reminders.filter(r => r.status === 'completed').length;
        const pending = total - completed;

        let msg = `您今天共有 ${total} 個提醒。`;
        if (completed > 0) {
            msg += `已完成 ${completed} 個，`;
        }
        if (pending > 0) {
            msg += `還有 ${pending} 個待完成。`;
        }

        // 列出待完成的提醒
        if (pending > 0) {
            const pendingReminders = reminders.filter(r => r.status !== 'completed');
            msg += '\n\n待完成的提醒：\n';
            pendingReminders.forEach((r, index) => {
                const time = r.reminder_time ? r.reminder_time.substring(0, 5) : '';
                msg += `${index + 1}. ${time} ${getCategoryName(r.category)} - ${r.title}\n`;
            });
        }

        addVoiceMessage('assistant', msg.replace(/\n/g, '<br>'));
        speakVoice(msg.replace(/\n/g, '。'));
    } catch (error) {
        console.error('查詢今日提醒失敗:', error);
        const msg = '查詢今日提醒時發生錯誤';
        addVoiceMessage('assistant', msg);
        speakVoice(msg);
    }
}

// 快速建立提醒
function handleQuickReminder(category, categoryName) {
    const msg = `好的，我會為您設定${categoryName}提醒。請直接在頁面上點擊「新增提醒」按鈕來完成設定。`;
    addVoiceMessage('assistant', msg);
    speakVoice(msg, () => {
        // 語音播報完成後，自動開啟新增提醒對話框
        if (typeof openCreateReminderModal === 'function') {
            openCreateReminderModal(category);
        }
    });
}

// 建立提醒
function handleCreateReminder(command) {
    const msg = '好的，請直接在頁面上點擊「➕ 新增提醒」按鈕來建立新的提醒。';
    addVoiceMessage('assistant', msg);
    speakVoice(msg, () => {
        if (typeof showReminderModal === 'function') {
            showReminderModal();
        }
    });
}

// 標記完成
function handleMarkComplete(command) {
    const msg = '請直接點擊提醒項目來標記為完成。';
    addVoiceMessage('assistant', msg);
    speakVoice(msg);
}

// 幫助
function handleHelp() {
    const msg = `我可以幫您：
    1. 查詢今日提醒：說「今天有什麼提醒」
    2. 新增提醒：說「新增喝水提醒」或「新增運動提醒」
    3. 快速建立：直接說「喝水」、「運動」、「吃藥」等`;

    addVoiceMessage('assistant', msg.replace(/\n/g, '<br>'));
    speakVoice(msg.replace(/\n/g, '。'));
}

// 取得類別名稱
function getCategoryName(category) {
    const names = {
        'water': '💧 喝水',
        'meal': '🍽️ 飲食',
        'exercise': '🏃 運動',
        'medication': '💊 用藥',
        'sleep': '😴 睡眠',
        'social': '👥 社交',
        'health': '🏥 健康檢查',
        'other': '📝 其他'
    };
    return names[category] || category;
}

// 開啟語音對話框
function openVoiceDialog() {
    const modal = document.getElementById('voiceModal');
    if (modal) {
        modal.classList.add('show');

        // 清空對話記錄
        if (voiceConversationBox) {
            voiceConversationBox.innerHTML = '';
        }

        // 歡迎訊息
        const welcomeMsg = '您好！我是生活提醒語音助手。您可以說「今天有什麼提醒」或「新增提醒」。需要幫助請說「幫助」。';
        addVoiceMessage('assistant', welcomeMsg);
        speakVoice(welcomeMsg);
    }
}

// 關閉語音對話框
function closeVoiceDialog() {
    const modal = document.getElementById('voiceModal');
    if (modal) {
        modal.classList.remove('show');
    }

    // 停止語音
    if (recognition && isListening) {
        recognition.stop();
    }
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
}
