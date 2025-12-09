/**
 * 語音建立生活提醒 - 對話式設定流程
 * 使用 Web Speech API
 */

// 全域變數
let createRecognition = null;
let createSpeechSynthesis = window.speechSynthesis;
let createIsListening = false;
let createCurrentStep = 'category';  // 對話步驟
let createReminderData = {
    category: '',
    title: '',
    time: '',
    repeat: 'daily',
    description: ''
};

// DOM 元素
let createConversationBox = null;
let createMicBtn = null;
let createStopBtn = null;
let createListeningIndicator = null;
let createStatusText = null;

// 初始化語音建立提醒功能
function initVoiceCreateReminder() {
    console.log('🎤 初始化語音建立提醒功能...');

    // 初始化 DOM 元素
    createConversationBox = document.getElementById('createConversationBox');
    createMicBtn = document.getElementById('createMicBtn');
    createStopBtn = document.getElementById('createStopBtn');
    createListeningIndicator = document.getElementById('createListeningIndicator');
    createStatusText = document.getElementById('createStatusText');

    // 初始化語音辨識
    initCreateSpeechRecognition();

    // 設定事件監聽器
    setupCreateEventListeners();

    console.log('✅ 語音建立提醒功能初始化完成');
}

// 初始化語音辨識
function initCreateSpeechRecognition() {
    console.log('🎙️ 初始化語音辨識...');

    // 檢查瀏覽器支援
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('❌ 瀏覽器不支援語音辨識');
        addCreateMessage('assistant', '抱歉，您的瀏覽器不支援語音辨識功能。<br>建議使用 <strong>Chrome</strong> 或 <strong>Edge</strong> 瀏覽器。');
        if (createMicBtn) {
            createMicBtn.disabled = true;
            createMicBtn.style.opacity = '0.5';
        }
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    createRecognition = new SpeechRecognition();

    createRecognition.lang = 'zh-TW';
    createRecognition.continuous = false;
    createRecognition.interimResults = false;
    createRecognition.maxAlternatives = 1;

    createRecognition.onstart = () => {
        console.log('🎤 語音辨識開始');
        createIsListening = true;
        createMicBtn.classList.add('active');
        createListeningIndicator.classList.add('active');
        createStatusText.textContent = '正在聆聽，請說話...';
    };

    createRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('聽到:', transcript);

        addCreateMessage('user', transcript);
        processCreateUserInput(transcript);
    };

    createRecognition.onerror = (event) => {
        console.error('語音辨識錯誤:', event.error);

        let errorMessage = '發生錯誤，請再試一次';
        if (event.error === 'no-speech') {
            errorMessage = '沒有聽到您的聲音，請再說一次';
        } else if (event.error === 'audio-capture') {
            errorMessage = '無法使用麥克風，請檢查權限設定';
        } else if (event.error === 'not-allowed') {
            errorMessage = '麥克風權限被拒絕，請在瀏覽器設定中允許麥克風';
        }

        addCreateMessage('assistant', errorMessage);
        resetCreateRecognition();
    };

    createRecognition.onend = () => {
        console.log('🎤 語音辨識結束');
        resetCreateRecognition();
    };
}

// 重置辨識狀態
function resetCreateRecognition() {
    createIsListening = false;
    createMicBtn.classList.remove('active');
    createListeningIndicator.classList.remove('active');
    createStatusText.textContent = '點擊麥克風繼續';
}

// 設定事件監聽器
function setupCreateEventListeners() {
    if (!createMicBtn) {
        console.error('❌ 找不到麥克風按鈕');
        return;
    }

    createMicBtn.addEventListener('click', () => {
        console.log('🎤 麥克風按鈕被點擊');

        // 停止正在播放的語音
        if (createSpeechSynthesis.speaking) {
            createSpeechSynthesis.cancel();
        }

        if (!createRecognition) {
            console.error('❌ 語音辨識未初始化');
            return;
        }

        try {
            createRecognition.start();
        } catch (error) {
            console.log('⚠️ 語音辨識已在運行中:', error.message);
        }
    });

    if (createStopBtn) {
        createStopBtn.addEventListener('click', () => {
            console.log('🛑 停止按鈕被點擊');
            if (createRecognition && createIsListening) {
                createRecognition.stop();
            }
            if (createSpeechSynthesis.speaking) {
                createSpeechSynthesis.cancel();
            }
        });
    }
}

// 添加訊息到對話框
function addCreateMessage(role, message, suggestions = []) {
    if (!createConversationBox) return;

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
    createConversationBox.appendChild(messageDiv);

    // 如果有建議選項
    if (suggestions.length > 0) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'voice-suggestions';

        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'voice-suggestion-btn';
            btn.textContent = suggestion.text;
            btn.onclick = () => {
                addCreateMessage('user', suggestion.text);
                processCreateUserInput(suggestion.value || suggestion.text);
            };
            suggestionsDiv.appendChild(btn);
        });

        createConversationBox.appendChild(suggestionsDiv);
    }

    // 滾動到底部
    createConversationBox.scrollTop = createConversationBox.scrollHeight;

    // 語音播報（助理的訊息）
    if (role === 'assistant') {
        speakCreate(message.replace(/<[^>]*>/g, '')); // 移除 HTML 標籤
    }
}

// 語音播報
function speakCreate(text, callback) {
    // 取消之前的播報
    createSpeechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // 選擇中文語音
    const voices = createSpeechSynthesis.getVoices();
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

    createSpeechSynthesis.speak(utterance);
}

// 處理用戶輸入
function processCreateUserInput(input) {
    const lowerInput = input.toLowerCase().trim();

    console.log('📝 當前步驟:', createCurrentStep, '用戶輸入:', input);

    switch(createCurrentStep) {
        case 'category':
            handleCategoryInput(input, lowerInput);
            break;

        case 'title':
            handleTitleInput(input);
            break;

        case 'time':
            handleTimeInput(input);
            break;

        case 'repeat':
            handleRepeatInput(lowerInput);
            break;

        case 'description':
            handleDescriptionInput(input);
            break;

        case 'confirmation':
            handleCreateConfirmation(lowerInput);
            break;

        case 'completed':
            // 已完成，可以關閉或新增另一個
            break;
    }
}

// 處理類別輸入
function handleCategoryInput(input, lowerInput) {
    const categories = {
        '喝水': 'water',
        '水': 'water',
        '飲水': 'water',
        '飲食': 'meal',
        '吃飯': 'meal',
        '用餐': 'meal',
        '運動': 'exercise',
        '鍛鍊': 'exercise',
        '健身': 'exercise',
        '用藥': 'medication',
        '吃藥': 'medication',
        '藥物': 'medication',
        '睡眠': 'sleep',
        '睡覺': 'sleep',
        '休息': 'sleep',
        '社交': 'social',
        '聚會': 'social',
        '會友': 'social',
        '健康': 'health',
        '檢查': 'health',
        '看醫生': 'health',
        '其他': 'other'
    };

    let foundCategory = null;
    for (const [key, value] of Object.entries(categories)) {
        if (lowerInput.includes(key.toLowerCase())) {
            foundCategory = value;
            createReminderData.category = value;
            break;
        }
    }

    if (foundCategory) {
        askTitle();
    } else {
        addCreateMessage('assistant', '抱歉，我不太理解。請說一種提醒類別，例如：喝水、用藥、運動、飲食等。');
    }
}

// 處理標題輸入
function handleTitleInput(input) {
    createReminderData.title = input;
    askTime();
}

// 處理時間輸入
function handleTimeInput(input) {
    const timeMatch = extractTime(input);

    if (timeMatch) {
        createReminderData.time = timeMatch;
        askRepeat();
    } else {
        addCreateMessage('assistant', '請說一個時間，例如：早上8點、下午2點、晚上7點。');
    }
}

// 處理重複模式輸入
function handleRepeatInput(lowerInput) {
    if (lowerInput.includes('每天') || lowerInput.includes('天天') || lowerInput.includes('daily')) {
        createReminderData.repeat = 'daily';
        askDescription();
    } else if (lowerInput.includes('每週') || lowerInput.includes('weekly')) {
        createReminderData.repeat = 'weekly';
        askDescription();
    } else if (lowerInput.includes('不重複') || lowerInput.includes('一次') || lowerInput.includes('once')) {
        createReminderData.repeat = 'once';
        askDescription();
    } else {
        addCreateMessage('assistant', '請選擇：每天、每週，或是不重複。');
    }
}

// 處理備註輸入
function handleDescriptionInput(input) {
    if (input.toLowerCase().includes('不用') || input.toLowerCase().includes('沒有') ||
        input.toLowerCase().includes('不需要') || input.toLowerCase().includes('跳過')) {
        createReminderData.description = '';
    } else {
        createReminderData.description = input;
    }
    showCreateSummary();
}

// 處理確認
function handleCreateConfirmation(lowerInput) {
    if (lowerInput.includes('確認') || lowerInput.includes('是') || lowerInput.includes('對') ||
        lowerInput.includes('好') || lowerInput.includes('yes')) {
        submitReminder();
    } else if (lowerInput.includes('取消') || lowerInput.includes('不') || lowerInput.includes('重新') ||
               lowerInput.includes('no')) {
        addCreateMessage('assistant', '好的，已取消。您可以關閉對話框，或是重新開始。');
        createCurrentStep = 'category';
        resetReminderData();
    } else {
        addCreateMessage('assistant', '請說「確認」來建立提醒，或說「取消」來取消。');
    }
}

// ==================== 對話步驟函數 ====================

// 詢問類別
function askCategory() {
    createCurrentStep = 'category';
    addCreateMessage('assistant', '您好！我會幫您建立生活提醒。<br><br>請問要建立什麼類型的提醒呢？<br>例如：喝水、用藥、運動、飲食、睡眠等。',
        [
            { text: '💧 喝水', value: '喝水' },
            { text: '💊 用藥', value: '用藥' },
            { text: '🏃 運動', value: '運動' },
            { text: '🍽️ 飲食', value: '飲食' },
            { text: '😴 睡眠', value: '睡眠' },
            { text: '📝 其他', value: '其他' }
        ]
    );
}

// 詢問標題
function askTitle() {
    createCurrentStep = 'title';
    const categoryName = getCategoryDisplayName(createReminderData.category);
    addCreateMessage('assistant', `好的，${categoryName}提醒。<br><br>請說提醒的標題或內容。<br>例如：喝300ml溫水、吃降血壓藥、散步30分鐘。`);
}

// 詢問時間
function askTime() {
    createCurrentStep = 'time';
    addCreateMessage('assistant', `了解，「${createReminderData.title}」。<br><br>請問要在什麼時間提醒您呢？<br>例如：早上8點、下午2點、晚上7點。`,
        [
            { text: '早上8點', value: '08:00' },
            { text: '中午12點', value: '12:00' },
            { text: '下午2點', value: '14:00' },
            { text: '晚上7點', value: '19:00' }
        ]
    );
}

// 詢問重複模式
function askRepeat() {
    createCurrentStep = 'repeat';
    addCreateMessage('assistant', `好的，${createReminderData.time}。<br><br>請問要如何重複呢？`,
        [
            { text: '每天', value: '每天' },
            { text: '每週', value: '每週' },
            { text: '不重複（僅一次）', value: '不重複' }
        ]
    );
}

// 詢問備註
function askDescription() {
    createCurrentStep = 'description';
    const repeatName = createReminderData.repeat === 'daily' ? '每天' :
                       createReminderData.repeat === 'weekly' ? '每週' : '一次';
    addCreateMessage('assistant', `${repeatName}。<br><br>是否需要補充備註說明？<br>例如：飯前服用、空腹喝。<br>如果不需要，請說「不用」。`);
}

// 顯示摘要並確認
function showCreateSummary() {
    createCurrentStep = 'confirmation';

    const categoryName = getCategoryDisplayName(createReminderData.category);
    const repeatName = createReminderData.repeat === 'daily' ? '每天' :
                       createReminderData.repeat === 'weekly' ? '每週' : '僅一次';

    let summary = `<strong>📋 請確認提醒內容：</strong><br><br>`;
    summary += `🏷️ 類別：${categoryName}<br>`;
    summary += `📝 標題：${createReminderData.title}<br>`;
    summary += `⏰ 時間：${createReminderData.time}<br>`;
    summary += `🔄 重複：${repeatName}<br>`;
    if (createReminderData.description) {
        summary += `💬 備註：${createReminderData.description}<br>`;
    }
    summary += `<br>確認無誤嗎？`;

    addCreateMessage('assistant', summary,
        [
            { text: '✅ 確認', value: '確認' },
            { text: '❌ 取消', value: '取消' }
        ]
    );
}

// 提交提醒
async function submitReminder() {
    try {
        addCreateMessage('assistant', '正在建立提醒...');

        // 準備提交資料
        const data = {
            elder_id: currentElderId,
            category: createReminderData.category,
            title: createReminderData.title,
            description: createReminderData.description,
            reminder_time: createReminderData.time,
            repeat_pattern: createReminderData.repeat,
            is_active: true
        };

        console.log('📤 提交提醒資料:', data);

        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const response = await fetch(`${API_BASE_URL}/api/daily-reminders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('建立提醒失敗');
        }

        const result = await response.json();
        console.log('✅ 提醒建立成功:', result);

        addCreateMessage('assistant', '✅ 提醒已成功建立！<br><br>您可以關閉對話框，或繼續建立另一個提醒。');

        createCurrentStep = 'completed';

        // 重新載入提醒列表
        if (typeof loadTodayReminders === 'function') {
            loadTodayReminders();
        }

        // 重置資料
        setTimeout(() => {
            resetReminderData();
        }, 2000);

    } catch (error) {
        console.error('❌ 建立提醒失敗:', error);
        addCreateMessage('assistant', '❌ 抱歉，建立提醒時發生錯誤。請稍後再試。');
    }
}

// ==================== 輔助函數 ====================

// 重置提醒資料
function resetReminderData() {
    createReminderData = {
        category: '',
        title: '',
        time: '',
        repeat: 'daily',
        description: ''
    };
}

// 取得類別顯示名稱
function getCategoryDisplayName(category) {
    const names = {
        'water': '💧 喝水',
        'meal': '🍽️ 飲食',
        'exercise': '🏃 運動',
        'medication': '💊 用藥',
        'sleep': '😴 睡眠',
        'social': '👥 社交',
        'health': '🏥 健康',
        'other': '📝 其他'
    };
    return names[category] || category;
}

// 提取時間
function extractTime(input) {
    const lowerInput = input.toLowerCase().trim();

    // 直接匹配 HH:MM 格式
    const timePattern = /(\d{1,2}):(\d{2})/;
    const match = lowerInput.match(timePattern);
    if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
    }

    // 中文時間描述
    let hours = 0;
    let minutes = 0;

    // 提取數字
    const numberMatch = lowerInput.match(/(\d+)/);
    if (numberMatch) {
        hours = parseInt(numberMatch[1]);
    }

    // 判斷時段
    if (lowerInput.includes('早上') || lowerInput.includes('早晨') || lowerInput.includes('上午')) {
        if (hours === 0) hours = 8;
    } else if (lowerInput.includes('中午') || lowerInput.includes('正午')) {
        hours = 12;
    } else if (lowerInput.includes('下午')) {
        if (hours < 12) hours += 12;
    } else if (lowerInput.includes('晚上') || lowerInput.includes('傍晚')) {
        if (hours < 12) hours += 12;
        if (hours === 12) hours = 19;
    }

    // 提取分鐘（如果有）
    if (lowerInput.includes('半')) {
        minutes = 30;
    }

    if (hours >= 0 && hours < 24) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    return null;
}

// 開啟語音建立提醒對話框
function openCreateReminderDialog() {
    const modal = document.getElementById('createReminderModal');
    if (modal) {
        modal.classList.add('show');

        // 清空對話記錄
        if (createConversationBox) {
            createConversationBox.innerHTML = '';
        }

        // 重置資料
        resetReminderData();

        // 開始對話
        createCurrentStep = 'category';
        askCategory();
    }
}

// 關閉語音建立提醒對話框
function closeCreateReminderDialog() {
    const modal = document.getElementById('createReminderModal');
    if (modal) {
        modal.classList.remove('show');
    }

    // 停止語音
    if (createRecognition && createIsListening) {
        createRecognition.stop();
    }
    if (createSpeechSynthesis.speaking) {
        createSpeechSynthesis.cancel();
    }

    // 重置資料
    resetReminderData();
}
