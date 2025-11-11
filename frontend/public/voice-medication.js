/**
 * 語音用藥設定 - 使用 Web Speech API
 */

// API 基礎 URL
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://eldercare-backend-8o4k.onrender.com';

// Supabase 設定
const SUPABASE_URL = 'https://oatdjdelzybcacwqafkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGRqZGVsenliY2Fjd3FhZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM5ODUsImV4cCI6MjA3Njc3OTk4NX0.Flk-9yHREG7gWr1etG-TEc2ufPjP-zvW2Ejd2gCqG4w';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 全域變數
let currentUser = null;
let currentElderId = null;
let recognition = null;
let speechSynthesis = window.speechSynthesis;
let currentStep = 'medication_name';  // 直接開始藥物名稱步驟
let isFirstInteraction = true;  // 標記是否為首次互動
let medicationData = {
    medicationName: '',
    dosesPerDay: 0,
    timingPlan: '',
    customTimes: [],
    durationType: '',
    treatmentDays: 0,
    stockQuantity: 30  // 預設庫存
};

// DOM 元素（在 DOMContentLoaded 後才初始化）
let conversationBox;
let micBtn;
let stopBtn;
let listeningIndicator;
let statusText;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化 DOM 元素
    conversationBox = document.getElementById('conversationBox');
    micBtn = document.getElementById('micBtn');
    stopBtn = document.getElementById('stopBtn');
    listeningIndicator = document.getElementById('listeningIndicator');
    statusText = document.getElementById('statusText');

    console.log('🎤 DOM 元素已載入:', { conversationBox, micBtn, stopBtn, listeningIndicator, statusText });

    await checkAuth();
    await loadCurrentUser();
    initSpeechRecognition();
    setupEventListeners();

    // 載入語音列表（確保中文語音可用）
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', () => {
            const voices = speechSynthesis.getVoices();
            console.log('🔊 語音列表已載入:', voices.length, '個語音');
        });
    }
});

// 檢查登入狀態
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;
}

// 載入當前使用者
async function loadCurrentUser() {
    try {
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', currentUser.id)
            .single();

        if (profile && (profile.role === 'elder' || profile.role === 'both')) {
            const { data: elder } = await supabaseClient
                .from('elders')
                .select('*')
                .eq('user_profile_id', profile.id)
                .single();

            currentElderId = elder?.id;
            console.log('✅ 當前長輩 ID:', currentElderId);
        }
    } catch (error) {
        console.error('載入使用者失敗:', error);
    }
}

// 初始化語音辨識
function initSpeechRecognition() {
    console.log('🎙️ 初始化語音辨識...');

    // 檢查瀏覽器支援
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('❌ 瀏覽器不支援語音辨識');
        addMessage('assistant', '抱歉，您的瀏覽器不支援語音辨識功能。<br>建議使用 <strong>Chrome</strong> 或 <strong>Edge</strong> 瀏覽器。');
        if (micBtn) {
            micBtn.disabled = true;
            micBtn.style.opacity = '0.5';
            micBtn.style.cursor = 'not-allowed';
        }
        return;
    }

    console.log('✅ 瀏覽器支援語音辨識');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    console.log('✅ 語音辨識物件已建立');

    recognition.lang = 'zh-TW';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        console.log('🎤 語音辨識開始');
        micBtn.classList.add('active');
        listeningIndicator.classList.add('active');
        statusText.textContent = '正在聆聽，請說話...';
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('聽到:', transcript);

        addMessage('user', transcript);
        processUserInput(transcript);
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

        addMessage('assistant', errorMessage);
        resetRecognition();
    };

    recognition.onend = () => {
        console.log('🎤 語音辨識結束');
        resetRecognition();
    };
}

// 重置辨識狀態
function resetRecognition() {
    micBtn.classList.remove('active');
    listeningIndicator.classList.remove('active');
    statusText.textContent = '點擊麥克風繼續';
}

// 設定事件監聽
function setupEventListeners() {
    console.log('🎯 設定事件監聽器...');

    if (!micBtn) {
        console.error('❌ 找不到麥克風按鈕元素！');
        return;
    }

    micBtn.addEventListener('click', () => {
        console.log('🎤 麥克風按鈕被點擊');

        // 立即停止正在播放的語音
        if (speechSynthesis.speaking) {
            console.log('🔇 停止語音播報');
            speechSynthesis.cancel();
        }

        if (!recognition) {
            console.error('❌ 語音辨識未初始化');
            addMessage('assistant', '抱歉，語音辨識功能無法使用。請確認您使用的是 Chrome 或 Edge 瀏覽器。');
            return;
        }

        // 首次互動時先詢問藥物名稱，再啟動錄音
        if (isFirstInteraction && currentStep === 'medication_name') {
            isFirstInteraction = false;
            askMedicationName();

            // 等待語音播報完成後才啟動錄音
            const utteranceEndHandler = () => {
                try {
                    console.log('▶️ 語音播報完成，啟動語音辨識...');
                    recognition.start();
                } catch (error) {
                    console.log('⚠️ 語音辨識已在運行中或發生錯誤:', error.message);
                }
            };

            // 監聽語音播報結束
            if (speechSynthesis.speaking) {
                const checkSpeaking = setInterval(() => {
                    if (!speechSynthesis.speaking) {
                        clearInterval(checkSpeaking);
                        utteranceEndHandler();
                    }
                }, 100);
            } else {
                // 如果沒有播報，直接啟動
                setTimeout(utteranceEndHandler, 500);
            }
        } else {
            // 非首次互動，直接啟動錄音
            try {
                console.log('▶️ 嘗試啟動語音辨識...');
                recognition.start();
            } catch (error) {
                console.log('⚠️ 語音辨識已在運行中或發生錯誤:', error.message);
            }
        }
    });

    stopBtn.addEventListener('click', () => {
        console.log('🛑 停止按鈕被點擊');
        if (recognition) {
            recognition.stop();
        }
    });

    // 字體大小控制
    const fontSizes = [18, 20, 22, 24, 26, 28];  // 可用的字體大小（px）
    let currentFontIndex = parseInt(localStorage.getItem('fontSizeIndex')) || 2;  // 預設 22px（索引2）

    const fontIncreaseBtn = document.getElementById('fontIncrease');
    const fontDecreaseBtn = document.getElementById('fontDecrease');

    if (fontIncreaseBtn && fontDecreaseBtn) {
        // 初始化：套用已儲存的字體大小
        applyFontSize();

        // 放大字體
        fontIncreaseBtn.addEventListener('click', () => {
            if (currentFontIndex < fontSizes.length - 1) {
                currentFontIndex++;
                applyFontSize();
                console.log('🔠 放大字體至:', fontSizes[currentFontIndex]);
            } else {
                console.log('⚠️ 已達最大字體');
            }
        });

        // 縮小字體
        fontDecreaseBtn.addEventListener('click', () => {
            if (currentFontIndex > 0) {
                currentFontIndex--;
                applyFontSize();
                console.log('🔠 縮小字體至:', fontSizes[currentFontIndex]);
            } else {
                console.log('⚠️ 已達最小字體');
            }
        });

        // 套用字體大小
        function applyFontSize() {
            const messageSize = fontSizes[currentFontIndex];
            const buttonSize = Math.max(16, messageSize - 2);  // 按鈕稍小 2px，最小 16px

            document.documentElement.style.setProperty('--message-font-size', `${messageSize}px`);
            document.documentElement.style.setProperty('--button-font-size', `${buttonSize}px`);

            // 儲存偏好到 localStorage
            localStorage.setItem('fontSizeIndex', currentFontIndex);

            console.log(`✅ 字體大小已套用: 訊息=${messageSize}px, 按鈕=${buttonSize}px`);
        }
    }

    console.log('✅ 事件監聽器設定完成');
}

// 添加訊息到對話框
function addMessage(type, text, suggestions = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = text;

    conversationBox.appendChild(messageDiv);

    // 如果有建議選項
    if (suggestions.length > 0) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggestions';

        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = suggestion.text;
            btn.onclick = () => {
                addMessage('user', suggestion.text);
                processUserInput(suggestion.value || suggestion.text);
            };
            suggestionsDiv.appendChild(btn);
        });

        conversationBox.appendChild(suggestionsDiv);
    }

    // 自動捲動到底部
    conversationBox.scrollTop = conversationBox.scrollHeight;

    // 語音播報（助理的訊息）
    if (type === 'assistant') {
        speak(text.replace(/<[^>]*>/g, '')); // 移除 HTML 標籤
    }
}

// 語音播報
function speak(text) {
    // 取消之前的播報
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.9; // 稍微慢一點，讓長輩更容易聽清楚
    utterance.pitch = 1;
    utterance.volume = 1;

    // 嘗試選擇中文語音
    const voices = speechSynthesis.getVoices();
    console.log('🔊 可用語音:', voices.map(v => `${v.name} (${v.lang})`));

    // 優先順序：zh-TW > zh-CN > zh > 包含 Chinese 的語音
    const chineseVoice = voices.find(voice =>
        voice.lang === 'zh-TW' ||
        voice.lang === 'zh-HK' ||
        voice.lang === 'zh-CN' ||
        voice.lang.startsWith('zh') ||
        voice.name.includes('Chinese') ||
        voice.name.includes('中文') ||
        voice.name.includes('普通话') ||
        voice.name.includes('國語')
    );

    if (chineseVoice) {
        utterance.voice = chineseVoice;
        console.log('✅ 使用中文語音:', chineseVoice.name, chineseVoice.lang);
    } else {
        console.log('⚠️ 未找到中文語音，使用預設語音');
    }

    speechSynthesis.speak(utterance);
}

// 處理使用者輸入
function processUserInput(input) {
    const lowerInput = input.toLowerCase().trim();

    switch(currentStep) {
        case 'welcome':
            askMedicationName();
            break;

        case 'medication_name':
            medicationData.medicationName = input;
            askDosesPerDay();
            break;

        case 'doses_per_day':
            const doses = extractNumber(input);
            if (doses >= 1 && doses <= 4) {
                medicationData.dosesPerDay = doses;
                askTimingPlan(doses);
            } else {
                addMessage('assistant', '抱歉，我沒聽清楚。請告訴我一天要吃幾次？例如「一天兩次」或「一天三次」。');
            }
            break;

        case 'timing_plan':
            handleTimingPlanResponse(lowerInput);
            break;

        case 'custom_times':
            handleCustomTimes(input);
            break;

        case 'duration_type':
            handleDurationType(lowerInput);
            break;

        case 'treatment_days':
            const days = extractNumber(input);
            if (days > 0 && days <= 30) {
                medicationData.treatmentDays = days;
                askStockQuantity();
            } else {
                addMessage('assistant', '請告訴我療程天數，例如「3天」或「7天」。');
            }
            break;

        case 'stock_quantity':
            const quantity = extractNumber(input);
            if (quantity > 0 && quantity <= 999) {
                medicationData.stockQuantity = quantity;
                showSummaryAndConfirm();
            } else {
                addMessage('assistant', '請告訴我藥品數量，例如「30顆」或「60顆」。');
            }
            break;

        case 'confirmation':
            handleConfirmation(lowerInput);
            break;

        case 'completed':
            handleCompletedActions(lowerInput);
            break;
    }
}

// 詢問藥物名稱
function askMedicationName() {
    currentStep = 'medication_name';
    addMessage('assistant', '請告訴我，您要新增什麼藥物呢？<br>例如：「降血壓藥」、「止痛藥」、「阿斯匹靈」');
}

// 詢問每日次數
function askDosesPerDay() {
    currentStep = 'doses_per_day';
    addMessage('assistant',
        `好的，<strong>${medicationData.medicationName}</strong>。<br>請問這個藥一天要吃幾次呢？ <br> 請按下方按鈕，或是點選 麥克風 開始語音回覆。`,
        [
            { text: '一天一次', value: '1' },
            { text: '一天兩次', value: '2' },
            { text: '一天三次', value: '3' },
            { text: '一天四次', value: '4' }
        ]
    );
}

// 詢問時段方案
function askTimingPlan(doses) {
    currentStep = 'timing_plan';

    let suggestions = [];
    let message = `了解，一天${doses}次。<br>我有建議的時段方案：<br><br>`;

    if (doses === 1) {
        message += '<strong>方案一：</strong>早上8點<br>';
        message += '<strong>方案二：</strong>早上9點<br>';
        suggestions = [
            { text: '方案一', value: 'plan1' },
            { text: '方案二', value: 'plan2' },
            { text: '自訂時間', value: 'custom' }
        ];
    } else if (doses === 2) {
        message += '<strong>方案一：</strong>早上8點、晚上6點<br>';
        message += '<strong>方案二：</strong>早上9點、晚上7點<br>';
        suggestions = [
            { text: '方案一', value: 'plan1' },
            { text: '方案二', value: 'plan2' },
            { text: '自訂時間', value: 'custom' }
        ];
    } else if (doses === 3) {
        message += '<strong>方案一：</strong>早上8點、中午12點、下午5點<br>';
        message += '<strong>方案二：</strong>早上9點、下午1點、下午6點<br>';
        suggestions = [
            { text: '方案一', value: 'plan1' },
            { text: '方案二', value: 'plan2' },
            { text: '自訂時間', value: 'custom' }
        ];
    } else if (doses === 4) {
        message += '<strong>方案一：</strong>早上8點、中午12點、下午5點、晚上9點<br>';
        message += '<strong>方案二：</strong>早上9點、下午1點、下午6點、晚上10點<br>';
        suggestions = [
            { text: '方案一', value: 'plan1' },
            { text: '方案二', value: 'plan2' },
            { text: '自訂時間', value: 'custom' }
        ];
    }

    message += '<br>您想選擇哪個方案呢？ <br> 請按下方按鈕，或是 點選 麥克風 開始語音回覆';
    addMessage('assistant', message, suggestions);
}

// 處理時段方案回應
function handleTimingPlanResponse(input) {
    console.log('⏰ 處理時段方案回應:', input);

    // 檢查是否包含「自訂」或相關詞彙（放在最前面優先檢查）
    if (input.includes('自訂') || input.includes('自定') || input.includes('自己設') ||
        input.includes('custom') || input.includes('自己') || input.includes('客製') ||
        input.includes('時間')) {
        console.log('✅ 識別為：自訂時間');
        askCustomTimes();
        return;
    }

    // 方案一
    if (input.includes('方案一') || input.includes('plan1') || input.includes('第一') ||
        input === '1' || input.includes('1')) {
        console.log('✅ 識別為：方案一');
        medicationData.timingPlan = 'plan1';
        askDurationType();
        return;
    }

    // 方案二
    if (input.includes('方案二') || input.includes('plan2') || input.includes('第二') ||
        input === '2' || input.includes('2')) {
        console.log('✅ 識別為：方案二');
        medicationData.timingPlan = 'plan2';
        askDurationType();
        return;
    }

    console.log('❌ 無法識別，請重新選擇');
    addMessage('assistant', '請選擇「方案一」、「方案二」或「自訂時間」。');
}

// 詢問自訂時間
function askCustomTimes() {
    currentStep = 'custom_times';
    addMessage('assistant',
        `請告訴我您想要的服藥時間，例如：<br>
        「早上7點和晚上9點」<br>
        「早上8點、中午12點、晚上6點」
         --- 請點選 麥克風 語音回覆`
    );
}

// 處理自訂時間
function handleCustomTimes(input) {
    // 嘗試提取時間
    const times = extractTimes(input);

    if (times.length === medicationData.dosesPerDay) {
        medicationData.timingPlan = 'custom';
        medicationData.customTimes = times;

        const timesText = times.join('、');
        addMessage('assistant', `好的，服藥時間是：${timesText}`);

        askDurationType();
    } else {
        addMessage('assistant',
            `抱歉，我聽到了 ${times.length} 個時間，但您說要吃 ${medicationData.dosesPerDay} 次。<br>
            請再說一次，需要 ${medicationData.dosesPerDay} 個時間點。`
        );
    }
}

// 詢問用藥類型
function askDurationType() {
    currentStep = 'duration_type';
    addMessage('assistant',
        '請問這是短期用藥還是長期用藥呢？<br><br>' +
        '<strong>短期用藥：</strong>像是抗生素或感冒藥，吃3到7天<br>' +
        '<strong>長期用藥：</strong>像是慢性病藥物，需要長期服用<br>' +
        '  -- 請按下方按鍵，或是 麥克風 開始語音回覆',
        [
            { text: '短期用藥', value: 'shortterm' },
            { text: '長期用藥', value: 'chronic' }
        ]
    );
}

// 處理用藥類型
function handleDurationType(input) {
    if (input.includes('短期') || input.includes('shortterm') || input.includes('短')) {
        medicationData.durationType = 'shortterm';
        askTreatmentDays();
    } else if (input.includes('長期') || input.includes('chronic') || input.includes('長')) {
        medicationData.durationType = 'chronic';
        askStockQuantity();
    } else {
        addMessage('assistant', '請告訴我「短期用藥」或「長期用藥」。');
    }
}

// 詢問庫存數量
function askStockQuantity() {
    currentStep = 'stock_quantity';
    addMessage('assistant',
        '最後一個問題，請問您目前有多少顆（或多少包）藥呢？<br>' +
        '這樣我可以在藥快吃完時提醒您。<br> 請按下方按鈕，或是 點選 麥克風 開始語音回覆',
        [
            { text: '30顆', value: '30' },
            { text: '60顆', value: '60' },
            { text: '90顆', value: '90' }
        ]
    );
}

// 詢問療程天數
function askTreatmentDays() {
    currentStep = 'treatment_days';
    addMessage('assistant',
        '請問要吃幾天呢？',
        [
            { text: '3天', value: '3' },
            { text: '5天', value: '5' },
            { text: '7天', value: '7' }
        ]
    );
}

// 顯示摘要並確認
function showSummaryAndConfirm() {
    currentStep = 'confirmation';

    // 建立摘要HTML
    let timingText = '';
    if (medicationData.timingPlan === 'plan1') {
        timingText = '方案一';
    } else if (medicationData.timingPlan === 'plan2') {
        timingText = '方案二';
    } else {
        timingText = medicationData.customTimes.join('、');
    }

    const durationText = medicationData.durationType === 'chronic'
        ? '長期用藥'
        : `短期用藥（${medicationData.treatmentDays}天）`;

    const summaryHTML = `
        <div class="summary-card">
            <h3>📋 請確認您的用藥設定</h3>
            <div class="summary-item">
                <span class="summary-label">💊 藥物名稱：</span>
                <span class="summary-value">${medicationData.medicationName}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">🔢 服用次數：</span>
                <span class="summary-value">一天${medicationData.dosesPerDay}次</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">⏰ 服用時間：</span>
                <span class="summary-value">${timingText}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">📅 用藥類型：</span>
                <span class="summary-value">${durationText}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">📦 目前庫存：</span>
                <span class="summary-value">${medicationData.stockQuantity} 顆</span>
            </div>
        </div>
        確認無誤後，請說「確認」或「是的」，我就幫您設定提醒。<br>
        如果需要修改，請說「重新開始」。
    `;

    addMessage('assistant', summaryHTML, [
        { text: '✅ 確認', value: '確認' },
        { text: '🔄 重新開始', value: '重新開始' }
    ]);
}

// 處理確認
function handleConfirmation(input) {
    if (input.includes('確認') || input.includes('是') || input.includes('對') || input.includes('好')) {
        saveMedication();
    } else if (input.includes('重新') || input.includes('取消') || input.includes('不')) {
        resetConversation();
    } else {
        addMessage('assistant', '請說「確認」來儲存設定，或說「重新開始」來重新設定。');
    }
}

// 處理完成後的動作
function handleCompletedActions(input) {
    console.log('✅ 處理完成後動作:', input);

    if (input.includes('查看') || input.includes('view') || input.includes('看看')) {
        // 跳轉到用藥管理頁面
        window.location.href = 'medications.html';
    } else if (input.includes('新增') || input.includes('add') || input.includes('再來')) {
        // 重新開始
        resetConversation();
    } else {
        addMessage('assistant', '您可以說「查看我的用藥」或「再新增一個」。');
    }
}

// 儲存用藥設定
async function saveMedication() {
    addMessage('assistant', '好的，正在為您設定提醒... ⏳');

    try {
        // 1. 建立藥物
        const medicationResponse = await fetch(`${API_BASE_URL}/api/medications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                elderId: currentElderId,
                medicationName: medicationData.medicationName,
                dosage: '依醫囑',
                medicationType: medicationData.durationType === 'chronic' ? 'chronic' : 'shortterm',
                stockQuantity: medicationData.stockQuantity || 30,
                status: 'active'
            })
        });

        const medicationResult = await medicationResponse.json();

        if (!medicationResponse.ok) {
            throw new Error(medicationResult.message || '建立藥物失敗');
        }

        const medicationId = medicationResult.data.id;

        // 2. 建立提醒
        const reminderData = {
            medicationId: medicationId,
            elderId: currentElderId,
            isEnabled: true,
            autoMarkMissedAfterMinutes: 30,
            notifyFamilyIfMissed: true
        };

        if (medicationData.durationType === 'chronic') {
            // 長期用藥
            reminderData.useSmartSchedule = false;
            reminderData.cronSchedule = generateCronSchedule();
            reminderData.reminderTimes = { times: getReminderTimes() };
        } else {
            // 短期用藥
            reminderData.useSmartSchedule = true;
            reminderData.durationType = 'shortterm';
            reminderData.dosesPerDay = medicationData.dosesPerDay;
            reminderData.timingPlan = medicationData.timingPlan;
            reminderData.customTimes = medicationData.customTimes.length > 0 ? medicationData.customTimes : null;
            reminderData.treatmentDays = medicationData.treatmentDays;
            reminderData.startDate = new Date().toISOString().split('T')[0];
        }

        const reminderResponse = await fetch(`${API_BASE_URL}/api/medication-reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reminderData)
        });

        if (!reminderResponse.ok) {
            throw new Error('建立提醒失敗');
        }

        addMessage('assistant',
            '✅ 太好了！提醒已經設定完成！<br><br>' +
            '從現在開始，我會在設定的時間提醒您服藥。<br>' +
            '您可以在「用藥管理」頁面查看所有提醒。',
            [
                { text: '查看我的用藥', value: 'view' },
                { text: '再新增一個', value: 'add_more' }
            ]
        );

        currentStep = 'completed';

    } catch (error) {
        console.error('儲存失敗:', error);
        addMessage('assistant',
            '❌ 抱歉，設定時發生錯誤。<br>' +
            error.message + '<br><br>' +
            '請重新開始或稍後再試。',
            [
                { text: '重新開始', value: '重新開始' }
            ]
        );
    }
}

// 生成 Cron 排程
function generateCronSchedule() {
    const times = getReminderTimes();
    const hours = times.map(t => parseInt(t.split(':')[0])).join(',');
    const minutes = times.map(t => parseInt(t.split(':')[1])).join(',');
    return `${minutes} ${hours} * * *`;
}

// 取得提醒時間陣列
function getReminderTimes() {
    if (medicationData.customTimes.length > 0) {
        return medicationData.customTimes;
    }

    const presets = {
        1: { plan1: ['08:00'], plan2: ['09:00'] },
        2: { plan1: ['08:00', '18:00'], plan2: ['09:00', '19:00'] },
        3: { plan1: ['08:00', '12:00', '17:00'], plan2: ['09:00', '13:00', '18:00'] },
        4: { plan1: ['08:00', '12:00', '17:00', '21:00'], plan2: ['09:00', '13:00', '18:00', '22:00'] }
    };

    return presets[medicationData.dosesPerDay][medicationData.timingPlan] || [];
}

// 重置對話
function resetConversation() {
    medicationData = {
        medicationName: '',
        dosesPerDay: 0,
        timingPlan: '',
        customTimes: [],
        durationType: '',
        treatmentDays: 0,
        stockQuantity: 30
    };
    currentStep = 'welcome';
    conversationBox.innerHTML = '';
    addMessage('assistant', '好的，讓我們重新開始。<br>請告訴我，您要新增什麼藥物呢？');
    currentStep = 'medication_name';
}

// 輔助函數：提取數字
function extractNumber(text) {
    console.log('🔢 提取數字，輸入:', text);

    // 先嘗試匹配阿拉伯數字
    const arabicMatch = text.match(/\d+/);
    if (arabicMatch) {
        const num = parseInt(arabicMatch[0]);
        console.log('✅ 找到阿拉伯數字:', num);
        return num;
    }

    // 中文數字對應（注意順序：先匹配長的，避免「兩次」被「兩」誤判）
    const numberPatterns = [
        { pattern: /(兩|二)次/, value: 2 },
        { pattern: /三次/, value: 3 },
        { pattern: /四次/, value: 4 },
        { pattern: /一次/, value: 1 },
        { pattern: /五次/, value: 5 },
        { pattern: /六次/, value: 6 },
        { pattern: /七次/, value: 7 },
        { pattern: /八次/, value: 8 },
    ];

    for (const { pattern, value } of numberPatterns) {
        if (pattern.test(text)) {
            console.log(`✅ 匹配到: "${pattern}" = ${value}`);
            return value;
        }
    }

    // 單純的中文數字
    const numberMap = {
        '四': 4, '三': 3, '兩': 2, '二': 2, '一': 1,
        '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
    };

    for (const [chinese, number] of Object.entries(numberMap)) {
        if (text.includes(chinese)) {
            console.log(`✅ 找到中文數字: "${chinese}" = ${number}`);
            return number;
        }
    }

    console.log('❌ 未找到數字，返回 0');
    return 0;
}

// 輔助函數：提取時間
function extractTimes(text) {
    console.log('🕐 提取時間，輸入:', text);
    const times = [];

    // 方法1: 匹配「時段+數字」格式（早上9點、晚上9點）
    const periodRegex = /(早上|上午|中午|下午|晚上|深夜|凌晨)\s*(\d{1,2})\s*[點点]?/g;
    let match;

    while ((match = periodRegex.exec(text)) !== null) {
        const period = match[1];
        let hour = parseInt(match[2]);

        console.log(`  找到: ${period}${hour}點`);

        // 根據時段調整小時（24小時制）
        if (period === '下午') {
            if (hour >= 1 && hour <= 11) hour += 12;
        } else if (period === '晚上' || period === '深夜') {
            if (hour >= 1 && hour <= 11) hour += 12;
            else if (hour === 12) hour = 0; // 晚上12點 = 凌晨0點
        } else if (period === '凌晨') {
            if (hour === 12) hour = 0;
        } else if (period === '中午') {
            if (hour === 12) hour = 12;
            else hour = 12; // 中午預設12點
        }
        // 早上、上午不需要調整

        if (hour >= 0 && hour < 24) {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            times.push(timeStr);
            console.log(`  → 轉換為: ${timeStr}`);
        }
    }

    // 方法2: 如果方法1沒找到，嘗試匹配純數字格式（8點、9:30）
    if (times.length === 0) {
        const numRegex = /(\d{1,2})\s*[點点:：]\s*(\d{0,2})/g;
        while ((match = numRegex.exec(text)) !== null) {
            let hour = parseInt(match[1]);
            let minute = match[2] ? parseInt(match[2]) : 0;

            if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
                const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                times.push(timeStr);
                console.log(`  找到純數字: ${timeStr}`);
            }
        }
    }

    // 去重並排序
    const uniqueTimes = [...new Set(times)].sort();
    console.log(`✅ 共提取 ${uniqueTimes.length} 個時間:`, uniqueTimes);

    return uniqueTimes;
}
