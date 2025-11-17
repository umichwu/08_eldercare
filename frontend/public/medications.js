/**
 * 用藥管理系統 - 前端邏輯
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
let currentElderId = localStorage.getItem('currentElderId') || null; // ✅ 從 localStorage 讀取
let medications = [];
let todayLogs = [];
let selectedDate = new Date(); // 當前選擇的日期，預設為今天

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 頁面開始初始化...');

    await checkAuth();
    await loadCurrentUser();
    await loadMedications();
    setTodayDate();

    // 初始化裝置偵測（確保在所有元素載入後執行）
    console.log('🔍 準備初始化裝置偵測...');
    setTimeout(() => {
        initDeviceBasedReminder();
    }, 1000);
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

// 載入當前使用者資料
async function loadCurrentUser() {
    try {
        // ✅ 如果 localStorage 已經有 elderId，先驗證是否有效
        if (currentElderId) {
            console.log('🔍 驗證已保存的 Elder ID:', currentElderId);
            const { data: existingElder, error: checkError } = await supabaseClient
                .from('elders')
                .select('*')
                .eq('id', currentElderId)
                .eq('auth_user_id', currentUser.id)
                .single();

            if (!checkError && existingElder) {
                console.log('✅ Elder ID 有效，直接使用');
                return; // Elder ID 有效，直接返回
            } else {
                console.log('⚠️ 已保存的 Elder ID 無效，重新查詢');
                currentElderId = null;
                localStorage.removeItem('currentElderId');
            }
        }

        const { data: profile, error: profileError } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', currentUser.id)
            .single();

        if (profileError) {
            console.error('載入 profile 失敗:', profileError);
            // 如果沒有 profile，自動建立一個預設的
            await createDefaultProfile();
            return;
        }

        // ✅ 修正：role 為 'elder' 或 'both' 都可以使用用藥管理功能
        if (profile && (profile.role === 'elder' || profile.role === 'both')) {
            const { data: elder, error: elderError } = await supabaseClient
                .from('elders')
                .select('*')
                .eq('user_profile_id', profile.id)
                .single();

            if (elderError || !elder) {
                console.log('沒有長輩資料，自動建立...');
                // 自動建立預設的長輩資料
                await createDefaultElder(profile.id);
                return;
            }

            currentElderId = elder?.id;
            // ✅ 保存到 localStorage
            if (currentElderId) {
                localStorage.setItem('currentElderId', currentElderId);
            }
            console.log('✅ 當前長輩 ID:', currentElderId);
        } else if (!profile.role) {
            // 如果沒有設定角色，預設為長輩並建立資料
            await updateProfileAndCreateElder(profile.id);
        } else {
            showToast('此功能僅供長輩使用', 'warning');
            // 隱藏所有載入狀態（非長輩用戶）
            hideAllLoadingStates();
        }
    } catch (error) {
        console.error('載入使用者失敗:', error);
        showToast('載入使用者資料失敗', 'error');
        // 隱藏所有載入狀態
        hideAllLoadingStates();
    }
}

// 隱藏所有標籤的載入狀態
function hideAllLoadingStates() {
    const loadingStates = [
        document.querySelector('#medications-tab .loading-state'),
        document.querySelector('#today-tab .loading-state'),
        document.querySelector('#stats-tab .loading-state')
    ];

    loadingStates.forEach(state => {
        if (state) {
            state.style.display = 'none';
        }
    });
}

// 建立預設的 user profile
async function createDefaultProfile() {
    try {
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .insert([{
                auth_user_id: currentUser.id,
                username: currentUser.email.split('@')[0],
                role: 'elder',
                contact_email: currentUser.email
            }])
            .select()
            .single();

        if (error) {
            console.error('建立 profile 失敗:', error);
            showToast('初始化使用者資料失敗', 'error');
            // 隱藏所有載入狀態
            hideAllLoadingStates();
            return;
        }

        console.log('✅ Profile 建立成功:', data);
        // 繼續建立長輩資料
        await createDefaultElder(data.id);
    } catch (error) {
        console.error('建立預設 profile 失敗:', error);
        showToast('初始化失敗', 'error');
        // 隱藏所有載入狀態
        hideAllLoadingStates();
    }
}

// 建立預設的長輩資料
async function createDefaultElder(profileId) {
    try {
        const { data, error } = await supabaseClient
            .from('elders')
            .insert([{
                auth_user_id: currentUser.id,
                user_profile_id: profileId,
                name: currentUser.email.split('@')[0],
                gender: 'prefer_not_to_say',
                health_status: 'good'
            }])
            .select()
            .single();

        if (error) {
            console.error('建立 elder 失敗:', error);
            showToast('初始化長輩資料失敗', 'error');
            // 隱藏所有載入狀態
            hideAllLoadingStates();
            return;
        }

        currentElderId = data.id;
        // ✅ 保存到 localStorage
        if (currentElderId) {
            localStorage.setItem('currentElderId', currentElderId);
        }
        console.log('✅ Elder 資料建立成功:', currentElderId);
        showToast('✅ 個人資料初始化完成', 'success');

        // 重新載入頁面資料
        await loadMedications();
    } catch (error) {
        console.error('建立預設 elder 失敗:', error);
        showToast('初始化失敗', 'error');
        // 隱藏所有載入狀態
        hideAllLoadingStates();
    }
}

// 更新 profile 並建立長輩資料
async function updateProfileAndCreateElder(profileId) {
    try {
        // 更新 role 為 elder
        const { error: updateError } = await supabaseClient
            .from('user_profiles')
            .update({ role: 'elder' })
            .eq('id', profileId);

        if (updateError) {
            console.error('更新 role 失敗:', updateError);
            return;
        }

        // 建立長輩資料
        await createDefaultElder(profileId);
    } catch (error) {
        console.error('更新 profile 失敗:', error);
    }
}

// ==================== 標籤切換 ====================

function switchTab(tabName) {
    // 更新標籤按鈕
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // 更新內容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // 載入對應資料
    if (tabName === 'today') {
        loadTodayMedications();
    } else if (tabName === 'stats') {
        loadStatistics(7);
    }
}

// ==================== 藥物列表 ====================

async function loadMedications() {
    if (!currentElderId) {
        // 隱藏載入狀態
        const loadingState = document.querySelector('#medications-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        showToast('請先完成個人資料設定', 'warning');
        // 顯示空狀態
        document.getElementById('emptyState').style.display = 'flex';
        // 清空藥物列表容器
        document.getElementById('medicationsList').innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/medications/elder/${currentElderId}`);
        const result = await response.json();

        // 隱藏載入狀態
        const loadingState = document.querySelector('#medications-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }

        if (result.data && result.data.length > 0) {
            medications = result.data;
            renderMedications(medications);
            document.getElementById('emptyState').style.display = 'none';
        } else {
            medications = [];
            // ✅ 修正：當沒有藥物時，清空列表並顯示空狀態
            document.getElementById('medicationsList').innerHTML = '';
            document.getElementById('emptyState').style.display = 'flex';
        }
    } catch (error) {
        console.error('載入藥物失敗:', error);
        // 隱藏載入狀態
        const loadingState = document.querySelector('#medications-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        showToast('載入藥物列表失敗', 'error');
    }
}

function renderMedications(meds) {
    const container = document.getElementById('medicationsList');

    if (meds.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>沒有找到符合的藥物</p></div>';
        return;
    }

    container.innerHTML = meds.map(med => `
        <div class="medication-card" data-id="${med.id}">
            <div class="med-header">
                <div class="med-info">
                    <h3 class="med-name">💊 ${med.medication_name}</h3>
                    <p class="med-dosage">${med.dosage || '未設定劑量'}</p>
                </div>
                <div class="med-status ${med.status}">
                    ${getStatusText(med.status)}
                </div>
            </div>

            ${med.purpose ? `<p class="med-purpose">🎯 ${med.purpose}</p>` : ''}

            ${med.instructions ? `
                <div class="med-instructions">
                    <strong>📝 服用說明：</strong>
                    <p>${med.instructions}</p>
                </div>
            ` : ''}

            ${med.side_effects ? `
                <div class="med-warnings">
                    <strong>⚠️ 副作用：</strong>
                    <p>${med.side_effects}</p>
                </div>
            ` : ''}

            <div class="med-stock ${med.stock_quantity <= med.stock_alert_threshold ? 'low' : ''}">
                📦 庫存：${med.stock_quantity} ${med.stock_quantity <= med.stock_alert_threshold ? '(庫存不足！)' : ''}
            </div>

            ${med.prescribing_doctor ? `
                <p class="med-doctor">👨‍⚕️ 處方醫師：${med.prescribing_doctor}</p>
            ` : ''}

            <div class="med-actions">
                <button class="btn-icon" onclick="showReminderSettings('${med.id}')" title="提醒設定">
                    ⏰
                </button>
                <button class="btn-icon" onclick="editMedication('${med.id}')" title="編輯">
                    ✏️
                </button>
                <button class="btn-icon danger" onclick="deleteMedication('${med.id}')" title="刪除">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

function getStatusText(status) {
    const statusMap = {
        'active': '使用中',
        'discontinued': '已停用',
        'expired': '已過期',
        'temporary': '暫時'
    };
    return statusMap[status] || status;
}

// 搜尋藥物
function searchMedications(query) {
    const filtered = medications.filter(med =>
        med.medication_name.toLowerCase().includes(query.toLowerCase()) ||
        (med.purpose && med.purpose.toLowerCase().includes(query.toLowerCase()))
    );
    renderMedications(filtered);
}

// ==================== 藥物模板 ====================

const medicationTemplates = {
    blood_pressure: {
        name: '降血壓藥',
        dosage: '1顆',
        mealTiming: 'after_meal',
        purpose: '控制血壓',
        times: ['08:00', '20:00'],
        icon: '❤️'
    },
    diabetes: {
        name: '糖尿病藥',
        dosage: '1顆',
        mealTiming: 'with_meal',
        purpose: '控制血糖',
        times: ['08:00', '12:00', '18:00'],
        icon: '🩸'
    },
    heart: {
        name: '心臟病藥',
        dosage: '1顆',
        mealTiming: 'after_meal',
        purpose: '保護心臟',
        times: ['08:00'],
        icon: '💓'
    },
    pain: {
        name: '止痛藥',
        dosage: '1顆',
        mealTiming: 'anytime',
        purpose: '緩解疼痛',
        times: ['08:00'],
        icon: '💊'
    },
    cold: {
        name: '感冒藥',
        dosage: '1顆',
        mealTiming: 'after_meal',
        purpose: '治療感冒',
        times: ['08:00', '14:00', '20:00'],
        icon: '🤧'
    },
    stomach: {
        name: '胃腸藥',
        dosage: '1顆',
        mealTiming: 'before_meal',
        purpose: '改善腸胃',
        times: ['07:30', '11:30', '17:30'],
        icon: '🫃'
    },
    sleep: {
        name: '助眠藥',
        dosage: '1顆',
        mealTiming: 'bedtime',
        purpose: '幫助睡眠',
        times: ['21:00'],
        icon: '😴'
    },
    custom: {
        name: '',
        dosage: '1顆',
        mealTiming: 'anytime',
        purpose: '',
        times: ['08:00'],
        icon: '✏️'
    }
};

// 使用模板
function useTemplate(templateKey) {
    const template = medicationTemplates[templateKey];
    if (!template) return;

    showAddMedicationForm();

    // 填入模板資料
    document.getElementById('medicationName').value = template.name;
    document.getElementById('dosage').value = template.dosage;
    document.getElementById('mealTiming').value = template.mealTiming;
    document.getElementById('purpose').value = template.purpose;

    // 自動設定下拉選單的值
    const nameSelect = document.getElementById('medicationNameSelect');
    if (nameSelect) {
        // 在下拉選單中找到對應的選項
        const selectOptions = Array.from(nameSelect.options);
        const matchingOption = selectOptions.find(option => option.value === template.name);

        if (matchingOption) {
            nameSelect.value = template.name;
        } else {
            nameSelect.value = 'custom';
        }

        // 觸發選擇事件，更新輸入框狀態
        selectMedicationName(nameSelect.value);

        // 如果是自訂，則設定輸入框的值
        if (nameSelect.value === 'custom') {
            document.getElementById('medicationName').value = template.name;
        }
    }

    // 設定劑量按鈕的選中狀態
    document.querySelectorAll('.dosage-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.textContent.trim().includes(template.dosage)) {
            btn.classList.add('selected');
        }
    });

    // 設定提醒時間
    const container = document.getElementById('reminderTimesContainer');
    container.innerHTML = template.times.map((time, index) => `
        <div class="time-input-group-large">
            <label class="time-label">提醒時間：</label>
            <input type="time" class="reminder-time large-time-input" value="${time}" required>
            <button type="button" class="btn-icon-large danger" onclick="removeReminderTime(this)"
                    style="display: ${template.times.length > 1 ? 'inline-block' : 'none'};">
                ❌ 刪除
            </button>
        </div>
    `).join('');

    // 顯示成功訊息
    showToast(`✅ 已套用「${template.name}」模板`, 'success');
}

// 藥物名稱選擇
function selectMedicationName(value) {
    const nameInput = document.getElementById('medicationName');
    const nameSelect = document.getElementById('medicationNameSelect');

    if (value === 'custom') {
        // 顯示輸入框
        nameInput.style.display = 'block';
        nameInput.required = true;
        nameInput.value = '';
        nameInput.focus();
    } else if (value) {
        // 使用選擇的藥物名稱
        nameInput.style.display = 'none';
        nameInput.required = false;
        nameInput.value = value;
    } else {
        // 未選擇
        nameInput.style.display = 'none';
        nameInput.required = false;
        nameInput.value = '';
    }
}

// 設定劑量
function setDosage(value) {
    document.getElementById('dosage').value = value;
    // 移除其他按鈕的選中狀態
    document.querySelectorAll('.dosage-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    // 添加選中狀態到當前按鈕
    event.target.classList.add('selected');
}

// 選擇用藥類型（長期/短期）
function selectMedicationType(type) {
    const chronicSettings = document.getElementById('chronicTimeSettings');
    const shorttermSettings = document.getElementById('shorttermTimeSettings');
    const typeInput = document.getElementById('medicationDurationType');

    // 更新按鈕狀態
    document.querySelectorAll('.type-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.type-option-btn').classList.add('active');

    // 更新顯示
    typeInput.value = type;
    if (type === 'chronic') {
        chronicSettings.style.display = 'block';
        shorttermSettings.style.display = 'none';
        // 長期用藥必填時間
        document.querySelectorAll('#chronicTimeSettings .reminder-time').forEach(input => {
            input.required = true;
        });
        // 短期用藥欄位改為非必填
        const firstDoseDate = document.getElementById('firstDoseDate');
        const firstDoseTime = document.getElementById('firstDoseTime');
        const doseInterval = document.getElementById('doseInterval');
        const treatmentDays = document.getElementById('treatmentDays');
        if (firstDoseDate) firstDoseDate.required = false;
        if (firstDoseTime) firstDoseTime.required = false;
        if (doseInterval) doseInterval.required = false;
        if (treatmentDays) treatmentDays.required = false;
    } else {
        chronicSettings.style.display = 'none';
        shorttermSettings.style.display = 'block';
        // 短期用藥欄位改為必填
        const firstDoseDate = document.getElementById('firstDoseDate');
        const firstDoseTime = document.getElementById('firstDoseTime');
        const doseInterval = document.getElementById('doseInterval');
        const treatmentDays = document.getElementById('treatmentDays');
        if (firstDoseDate) {
            firstDoseDate.required = true;
            // 設定預設值為今天
            firstDoseDate.value = new Date().toISOString().split('T')[0];
        }
        if (firstDoseTime) firstDoseTime.required = true;
        if (doseInterval) doseInterval.required = true;
        if (treatmentDays) treatmentDays.required = true;
        // 長期用藥時間改為非必填
        document.querySelectorAll('#chronicTimeSettings .reminder-time').forEach(input => {
            input.required = false;
        });
    }
}

// 設定服藥間隔
function setIntervalHours(hours, buttonElement) {
    document.getElementById('doseInterval').value = hours;
    // 移除其他按鈕的選中狀態
    document.querySelectorAll('.interval-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    // 添加選中狀態到當前按鈕
    if (buttonElement) {
        buttonElement.classList.add('selected');
    }
}

// 設定療程天數
function setDuration(days, buttonElement) {
    document.getElementById('treatmentDays').value = days;
    // 移除其他按鈕的選中狀態
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    // 添加選中狀態到當前按鈕
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
}

// 設定是否為抗生素
function setAntibiotic(value, buttonElement) {
    document.getElementById('isAntibiotic').value = value;
    const warning = document.getElementById('antibioticWarning');

    // 更新按鈕狀態
    document.querySelectorAll('.antibiotic-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    // 顯示/隱藏警告
    if (value === 'yes') {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }
}

// ========== 新的短期用藥設定函數 ==========

// 設定用藥頻率（一日幾次）
function setFrequency(frequency, buttonElement) {
    document.getElementById('dosesPerDay').value = frequency;

    // 更新按鈕狀態
    document.querySelectorAll('.frequency-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    // 顯示對應的時段方案
    document.getElementById('plan-2-times').style.display = 'none';
    document.getElementById('plan-3-times').style.display = 'none';
    document.getElementById('plan-4-times').style.display = 'none';
    document.getElementById(`plan-${frequency}-times`).style.display = 'grid';

    // 重置為 plan1 並隱藏自訂時間
    document.getElementById('timingPlan').value = 'plan1';
    document.getElementById('customTimesInput').style.display = 'none';

    // 更新當前顯示的方案中的 active 狀態
    const currentPlan = document.getElementById(`plan-${frequency}-times`);
    currentPlan.querySelectorAll('.timing-plan-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    currentPlan.querySelector('[data-plan="plan1"]').classList.add('active');

    // 更新自訂時間輸入欄位數量
    updateCustomTimesFields(frequency);
}

// 設定時段方案
function setTimingPlan(plan, buttonElement) {
    document.getElementById('timingPlan').value = plan;

    // 更新按鈕狀態（只在當前顯示的 timing-plans 內）
    const parent = buttonElement.closest('.timing-plans');
    parent.querySelectorAll('.timing-plan-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    // 顯示/隱藏自訂時間輸入
    const customInput = document.getElementById('customTimesInput');
    if (plan === 'custom') {
        customInput.style.display = 'block';
    } else {
        customInput.style.display = 'none';
    }
}

// 更新自訂時間輸入欄位
function updateCustomTimesFields(frequency) {
    const container = document.getElementById('customTimesList');
    container.innerHTML = '';

    const defaultTimes = {
        2: ['08:00', '18:00'],
        3: ['08:00', '13:00', '18:00'],
        4: ['08:00', '12:00', '17:00', '21:00']
    };

    const times = defaultTimes[frequency] || defaultTimes[3];

    times.forEach((time, index) => {
        const div = document.createElement('div');
        div.className = 'custom-time-input';
        div.innerHTML = `
            <span class="time-label">第 ${index + 1} 次：</span>
            <input type="time" class="custom-time-field" value="${time}">
        `;
        container.appendChild(div);
    });
}

// 設定開始日期
function setStartDate(type, buttonElement) {
    const input = document.getElementById('startDateInput');
    const hidden = document.getElementById('startDate');

    // 更新按鈕狀態
    document.querySelectorAll('.start-date-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    if (type === 'custom') {
        input.style.display = 'block';
        // 設定預設值為今天
        const today = new Date().toISOString().split('T')[0];
        input.value = today;
        hidden.value = 'custom';
    } else {
        input.style.display = 'none';
        hidden.value = type;
    }
}

// 預覽短期用藥排程
async function previewShortTermSchedule() {
    try {
        // 收集表單資料
        const dosesPerDay = parseInt(document.getElementById('dosesPerDay').value);
        const timingPlan = document.getElementById('timingPlan').value;
        const treatmentDays = parseInt(document.getElementById('treatmentDays').value);
        const startDateType = document.getElementById('startDate').value;
        const isAntibiotic = document.getElementById('isAntibiotic').value === 'yes';

        // 計算開始日期
        let startDate = new Date();
        if (startDateType === 'tomorrow') {
            startDate.setDate(startDate.getDate() + 1);
        } else if (startDateType === 'custom') {
            const customDate = document.getElementById('startDateInput').value;
            if (customDate) {
                startDate = new Date(customDate);
            }
        }

        // 收集自訂時間（如果是自訂方案）
        let customTimes = null;
        if (timingPlan === 'custom') {
            customTimes = Array.from(document.querySelectorAll('.custom-time-field'))
                .map(input => input.value)
                .filter(time => time);

            if (customTimes.length === 0) {
                showToast('請設定自訂時間', 'warning');
                return;
            }
        }

        // 驗證
        if (!treatmentDays || treatmentDays < 1) {
            showToast('請輸入療程天數', 'warning');
            return;
        }

        // 建立預覽資料
        const previewData = {
            dosesPerDay,
            timingPlan: timingPlan === 'custom' ? 'custom' : timingPlan,
            customTimes,
            treatmentDays,
            startDate: startDate.toISOString().split('T')[0],
            isAntibiotic
        };

        console.log('預覽資料:', previewData);

        // 顯示預覽彈窗
        await show3DayPreview(previewData);

    } catch (error) {
        console.error('預覽失敗:', error);
        showToast('預覽失敗：' + error.message, 'error');
    }
}

// 顯示 3 天預覽彈窗
async function show3DayPreview(scheduleData) {
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-modal-content">
            <div class="preview-modal-header">
                <h2>📅 3 天用藥計畫預覽</h2>
                <button class="preview-modal-close" onclick="this.closest('.preview-modal').remove()">✕</button>
            </div>
            <div class="preview-modal-body">
                <div class="preview-loading">
                    <div class="spinner"></div>
                    <p>正在生成預覽...</p>
                </div>
            </div>
            <div class="preview-modal-footer">
                <button class="btn-secondary" onclick="this.closest('.preview-modal').remove()">關閉</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 顯示動畫
    setTimeout(() => modal.classList.add('show'), 10);

    try {
        // 調用後端預覽 API
        const response = await fetch(`${API_BASE_URL}/api/medication-reminders/preview?days=3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dosesPerDay: scheduleData.dosesPerDay,
                timingPlan: scheduleData.timingPlan,
                customTimes: scheduleData.customTimes,
                treatmentDays: scheduleData.treatmentDays,
                startDate: scheduleData.startDate,
                isAntibiotic: scheduleData.isAntibiotic,
                medicationName: document.getElementById('medicationName')?.value || '預覽藥物'
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '預覽生成失敗');
        }

        const { preview, cronSchedule, reminderTimes } = result.data;

        // 顯示預覽結果
        const body = modal.querySelector('.preview-modal-body');
        body.innerHTML = `
            <div class="preview-summary">
                <div class="preview-info">
                    <h3>📊 用藥方案</h3>
                    <ul>
                        <li><strong>每日次數：</strong>${scheduleData.dosesPerDay} 次</li>
                        <li><strong>時段方案：</strong>${scheduleData.timingPlan === 'plan1' ? '方案一' : scheduleData.timingPlan === 'plan2' ? '方案二' : '自訂時間'}</li>
                        ${scheduleData.customTimes ? `<li><strong>自訂時間：</strong>${scheduleData.customTimes.join(', ')}</li>` : ''}
                        <li><strong>療程天數：</strong>${scheduleData.treatmentDays} 天</li>
                        <li><strong>開始日期：</strong>${scheduleData.startDate}</li>
                        <li><strong>提醒時間：</strong>${reminderTimes.join(', ')}</li>
                    </ul>
                </div>

                <div class="preview-schedule">
                    <h3>📆 3 天用藥計畫</h3>
                    ${preview.map(day => `
                        <div class="preview-day">
                            <h4>${day.dayOfWeek} (${day.date})</h4>
                            <div class="preview-times">
                                ${day.schedules.map(schedule => `
                                    <div class="preview-time-item ${schedule.status}">
                                        <span class="time">${schedule.time}</span>
                                        <span class="label">${schedule.label}</span>
                                        ${schedule.status === 'passed' ? '<span class="status-badge">已過</span>' : '<span class="status-badge">待服藥</span>'}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <p class="preview-note">💡 確認無誤後，請點選「儲存」完成設定</p>
            </div>
        `;

    } catch (error) {
        console.error('預覽生成失敗:', error);
        const body = modal.querySelector('.preview-modal-body');
        body.innerHTML = `<p class="error-message">❌ 預覽生成失敗：${error.message}</p>`;
    }
}

// 添加預設時間
function addPresetTime(time) {
    // 檢查是否已經存在該時間
    const existingTimes = Array.from(document.querySelectorAll('.reminder-time'))
        .map(input => input.value);

    if (existingTimes.includes(time)) {
        showToast('此時間已經存在', 'warning');
        return;
    }

    // 尋找第一個空的時間輸入欄
    const emptyInput = Array.from(document.querySelectorAll('.reminder-time'))
        .find(input => !input.value);

    if (emptyInput) {
        emptyInput.value = time;
    } else {
        // 如果沒有空的輸入欄，新增一個
        addReminderTimeInForm();
        // 等待 DOM 更新後設定值
        setTimeout(() => {
            const allInputs = document.querySelectorAll('.reminder-time');
            const lastInput = allInputs[allInputs.length - 1];
            if (lastInput) {
                lastInput.value = time;
            }
        }, 10);
    }

    showToast(`已添加 ${time} 的提醒`, 'success');
}

// ==================== 輔助函數 ====================

// 生成短期用藥的提醒時間
function generateShorttermReminders(startDate, startTime, intervalHours, days) {
    const reminders = [];
    const start = new Date(`${startDate}T${startTime}`);
    const totalDoses = Math.ceil((days * 24) / intervalHours);

    for (let i = 0; i < totalDoses; i++) {
        const reminderTime = new Date(start.getTime() + (i * intervalHours * 60 * 60 * 1000));
        // 只取時間部分（HH:MM）
        const timeStr = reminderTime.toTimeString().slice(0, 5);
        if (!reminders.includes(timeStr)) {
            reminders.push(timeStr);
        }
    }

    return reminders;
}

// 計算結束日期
function calculateEndDate(startDate, days) {
    const start = new Date(startDate);
    const end = new Date(start.getTime() + (days * 24 * 60 * 60 * 1000));
    return end.toISOString().split('T')[0];
}

// ==================== 新增/編輯藥物 ====================

function showAddMedicationForm() {
    document.getElementById('modalTitle').textContent = '➕ 新增用藥時間';
    document.getElementById('medicationForm').reset();
    document.getElementById('medicationId').value = '';

    // 重置劑量按鈕選中狀態
    document.querySelectorAll('.dosage-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // 重置提醒時間容器，只保留一個空的時間輸入
    const container = document.getElementById('reminderTimesContainer');
    container.innerHTML = `
        <div class="time-input-group-large">
            <label class="time-label">提醒時間：</label>
            <input type="time" class="reminder-time large-time-input" required>
            <button type="button" class="btn-icon-large danger" onclick="removeReminderTime(this)" style="display: none;">
                ❌ 刪除
            </button>
        </div>
    `;

    // 收起進階設定
    const collapsibleContent = document.querySelector('.collapsible-content');
    if (collapsibleContent) {
        collapsibleContent.style.display = 'none';
    }

    document.getElementById('medicationModal').classList.add('show');
}

// 切換進階設定區塊
function toggleSection(header) {
    const content = header.nextElementSibling;
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    header.textContent = isHidden ? '🔼 進階設定（選填）' : '🔽 進階設定（選填）';
}

// 在表單中新增提醒時間
function addReminderTimeInForm() {
    const container = document.getElementById('reminderTimesContainer');
    const div = document.createElement('div');
    div.className = 'time-input-group-large';
    div.innerHTML = `
        <label class="time-label">提醒時間：</label>
        <input type="time" class="reminder-time large-time-input" required>
        <button type="button" class="btn-icon-large danger" onclick="removeReminderTime(this)">
            ❌ 刪除
        </button>
    `;
    container.appendChild(div);

    // 顯示所有刪除按鈕（當有多個時間時）
    updateRemoveButtons();
}

// 更新刪除按鈕的顯示狀態
function updateRemoveButtons() {
    const container = document.getElementById('reminderTimesContainer');
    const groups = container.querySelectorAll('.time-input-group-large');
    groups.forEach((group, index) => {
        const btn = group.querySelector('.btn-icon-large');
        // 如果只有一個時間，隱藏刪除按鈕
        if (btn) {
            btn.style.display = groups.length > 1 ? 'inline-block' : 'none';
        }
    });
}

// 監聽藥物類型變化，顯示/隱藏抗生素療程天數
document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('medicationType');
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            const antibioticGroup = document.getElementById('antibioticDaysGroup');
            if (this.value === 'antibiotic') {
                antibioticGroup.style.display = 'block';
            } else {
                antibioticGroup.style.display = 'none';
            }
        });
    }
});

async function editMedication(id) {
    const med = medications.find(m => m.id === id);
    if (!med) return;

    console.log('📝 編輯藥物資料:', med);

    // ✅ 設定標題
    document.getElementById('modalTitle').textContent = '✏️ 編輯藥物與提醒';
    document.getElementById('medicationId').value = med.id;

    // ✅ 設定藥物名稱（需要處理下拉選單和輸入框）
    const nameSelect = document.getElementById('medicationNameSelect');
    const nameInput = document.getElementById('medicationName');

    // 檢查是否為常見藥物
    const isCommonMed = Array.from(nameSelect.options).some(option => option.value === med.medication_name);

    if (isCommonMed) {
        nameSelect.value = med.medication_name;
        nameInput.style.display = 'none';
        nameInput.value = med.medication_name;
    } else {
        nameSelect.value = 'custom';
        nameInput.style.display = 'block';
        nameInput.value = med.medication_name;
    }

    // ✅ 設定劑量和劑量按鈕
    const dosageValue = med.dosage || '';
    document.getElementById('dosage').value = dosageValue;

    // 更新劑量按鈕的選中狀態
    document.querySelectorAll('.dosage-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.textContent.trim() === dosageValue) {
            btn.classList.add('selected');
        }
    });

    // ✅ 設定進階欄位
    document.getElementById('medicationType').value = med.medication_type || '';
    document.getElementById('purpose').value = med.purpose || '';

    // ✅ 從 instructions 中提取用藥時機
    const instructions = med.instructions || '';
    let mealTiming = 'anytime';
    let cleanedInstructions = instructions;

    if (instructions.includes('飯前')) {
        mealTiming = 'before_meal';
        cleanedInstructions = instructions.replace(/飯前30分鐘服用[。\.]/g, '').trim();
    } else if (instructions.includes('飯中') || instructions.includes('隨餐')) {
        mealTiming = 'with_meal';
        cleanedInstructions = instructions.replace(/隨餐服用[。\.]/g, '').trim();
    } else if (instructions.includes('飯後')) {
        mealTiming = 'after_meal';
        cleanedInstructions = instructions.replace(/飯後30分鐘服用[。\.]/g, '').trim();
    } else if (instructions.includes('睡前')) {
        mealTiming = 'bedtime';
        cleanedInstructions = instructions.replace(/睡前服用[。\.]/g, '').trim();
    } else if (instructions.includes('不限時間')) {
        mealTiming = 'anytime';
        cleanedInstructions = instructions.replace(/不限時間[。\.]/g, '').trim();
    }

    document.getElementById('mealTiming').value = mealTiming;
    document.getElementById('instructions').value = cleanedInstructions;
    document.getElementById('sideEffects').value = med.side_effects || '';
    document.getElementById('prescribingDoctor').value = med.prescribing_doctor || '';
    document.getElementById('stockQuantity').value = med.stock_quantity || 30;

    // ✅ 載入提醒時間並判斷用藥類型
    try {
        const response = await fetch(`${API_BASE_URL}/api/medication-reminders/elder/${currentElderId}`);
        const result = await response.json();
        const reminder = result.data?.find(r => r.medication_id === id);

        console.log('📅 提醒設定:', reminder);

        // ✅ 判斷是長期還是短期用藥
        let durationType = 'chronic'; // 預設為長期
        let times = [];

        if (reminder) {
            // 檢查是否有 end_date（短期用藥的標誌）
            if (reminder.end_date) {
                durationType = 'shortterm';
                console.log('🔍 檢測到短期用藥');
            }

            // 解析提醒時間
            if (reminder.reminder_times) {
                if (typeof reminder.reminder_times === 'object' && reminder.reminder_times.times) {
                    times = reminder.reminder_times.times;
                } else if (Array.isArray(reminder.reminder_times)) {
                    times = reminder.reminder_times;
                }
            }
        }

        // ✅ 設定用藥類型按鈕
        document.querySelectorAll('.type-option-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === durationType) {
                btn.classList.add('active');
            }
        });
        document.getElementById('medicationDurationType').value = durationType;

        // ✅ 顯示對應的時間設定區域
        const chronicSettings = document.getElementById('chronicTimeSettings');
        const shorttermSettings = document.getElementById('shorttermTimeSettings');

        if (durationType === 'chronic') {
            chronicSettings.style.display = 'block';
            shorttermSettings.style.display = 'none';

            // ✅ 填充長期用藥的時間
            if (times.length > 0) {
                const container = document.getElementById('reminderTimesContainer');
                container.innerHTML = times.map((time, index) => `
                    <div class="time-input-group-large">
                        <label class="time-label">提醒時間：</label>
                        <input type="time" class="reminder-time large-time-input" value="${time}" required>
                        <button type="button" class="btn-icon-large danger" onclick="removeReminderTime(this)"
                                style="display: ${times.length > 1 ? 'inline-block' : 'none'};">
                            ❌ 刪除
                        </button>
                    </div>
                `).join('');
            }
        } else {
            chronicSettings.style.display = 'none';
            shorttermSettings.style.display = 'block';

            // ✅ 填充短期用藥的設定（如果有的話）
            // TODO: 這裡可以根據 reminder 的 metadata 來還原短期用藥的設定
            console.log('⚠️ 短期用藥編輯功能待完善');
        }

    } catch (error) {
        console.error('❌ 載入提醒設定失敗:', error);
        showToast('載入提醒設定失敗', 'error');
    }

    // ✅ 顯示彈窗
    document.getElementById('medicationModal').classList.add('show');
}

async function saveMedication(event) {
    event.preventDefault();

    const durationType = document.getElementById('medicationDurationType').value;
    let times = [];
    let reminderMetadata = {}; // 用來儲存額外的提醒資訊

    // 根據用藥類型處理不同的時間設定
    if (durationType === 'chronic') {
        // 長期用藥：收集提醒時間
        times = Array.from(document.querySelectorAll('#reminderTimesContainer .reminder-time'))
            .map(input => input.value)
            .filter(t => t);

        if (times.length === 0) {
            showToast('請至少設定一個提醒時間', 'warning');
            return;
        }
    } else {
        // 短期用藥：使用新的智能排程
        const isAntibiotic = document.getElementById('isAntibiotic').value === 'yes';
        const treatmentDays = parseInt(document.getElementById('treatmentDays').value) || 3;

        if (isAntibiotic) {
            // 抗生素：需要首次用藥時間和間隔
            const firstDoseDate = document.getElementById('firstDoseDate')?.value;
            const firstDoseTime = document.getElementById('firstDoseTime')?.value;
            const intervalHours = parseInt(document.getElementById('doseInterval')?.value);

            if (!firstDoseDate || !firstDoseTime || !intervalHours) {
                showToast('請完整填寫抗生素用藥資訊（首次時間、間隔）', 'warning');
                return;
            }

            const dosesPerDay = 24 / intervalHours;

            reminderMetadata = {
                durationType: 'shortterm',
                useSmartSchedule: true,
                isAntibiotic: true,
                firstDoseDateTime: `${firstDoseDate}T${firstDoseTime}`,
                dosesPerDay: dosesPerDay,
                treatmentDays: treatmentDays,
                endDate: calculateEndDate(firstDoseDate, treatmentDays)
            };
        } else {
            // 一般短期用藥：使用新的智能排程系統
            const dosesPerDay = parseInt(document.getElementById('dosesPerDay')?.value) || 3;
            const timingPlan = document.getElementById('timingPlan')?.value || 'plan1';
            const startDateType = document.getElementById('startDateType')?.value || 'today';

            // 計算開始日期
            let startDate = new Date();
            if (startDateType === 'tomorrow') {
                startDate.setDate(startDate.getDate() + 1);
            } else if (startDateType === 'custom') {
                const customDate = document.getElementById('customStartDate')?.value;
                if (customDate) {
                    startDate = new Date(customDate);
                }
            }
            startDate.setHours(0, 0, 0, 0); // 設定為 00:00

            // 收集自訂時間（如果有的話）
            let customTimes = null;
            if (timingPlan === 'custom') {
                customTimes = Array.from(document.querySelectorAll('.custom-time-field'))
                    .map(input => input.value)
                    .filter(t => t);

                if (customTimes.length === 0) {
                    showToast('請設定自訂的用藥時間', 'warning');
                    return;
                }
            }

            reminderMetadata = {
                durationType: 'shortterm',
                useSmartSchedule: true,
                isAntibiotic: false,
                dosesPerDay: dosesPerDay,
                timingPlan: timingPlan,
                customTimes: customTimes,
                treatmentDays: treatmentDays,
                startDate: startDate.toISOString().split('T')[0]
            };
        }

        // 暫時設定空陣列，實際排程會在後端生成
        times = [];
    }

    const id = document.getElementById('medicationId').value;

    // 組合用藥時機和說明
    const mealTiming = document.getElementById('mealTiming').value;
    const mealTimingText = {
        'before_meal': '飯前30分鐘服用',
        'with_meal': '隨餐服用',
        'after_meal': '飯後30分鐘服用',
        'anytime': '不限時間',
        'bedtime': '睡前服用'
    }[mealTiming] || '';

    const existingInstructions = document.getElementById('instructions').value;
    const combinedInstructions = existingInstructions
        ? `${mealTimingText}。${existingInstructions}`
        : mealTimingText;

    // 檢查是否有 elder_id
    if (!currentElderId) {
        showToast('❌ 無法取得使用者資料，請重新整理頁面', 'error');
        console.error('❌ currentElderId 是 null，無法儲存藥物');
        console.log('當前使用者:', currentUser);
        console.log('請檢查是否已完成 onboarding 流程');

        // 嘗試重新載入使用者資料
        await loadCurrentUser();

        if (!currentElderId) {
            showToast('❌ 初始化失敗，請聯繫系統管理員', 'error');
            return;
        }
    }

    // 準備藥物基本資料（不包含 end_date，那是 reminder 的屬性）
    const data = {
        elderId: currentElderId,
        medicationName: document.getElementById('medicationName').value,
        dosage: document.getElementById('dosage').value,
        medicationType: document.getElementById('medicationType').value || 'tablet',
        purpose: document.getElementById('purpose').value,
        instructions: combinedInstructions,
        sideEffects: document.getElementById('sideEffects').value,
        prescribingDoctor: document.getElementById('prescribingDoctor').value,
        stockQuantity: parseInt(document.getElementById('stockQuantity').value) || 30,
        status: 'active'
    };

    try {
        let response;
        let medicationId = id;

        if (id) {
            // 更新藥物 - 移除 elderId，因為不應該更改藥物所屬的長輩
            const { elderId, ...updateData } = data;
            response = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
        } else {
            // 新增藥物
            response = await fetch(`${API_BASE_URL}/api/medications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }

        const result = await response.json();

        if (!response.ok) {
            showToast(result.message || '儲存藥物失敗', 'error');
            return;
        }

        // 取得藥物 ID
        medicationId = result.data?.id || id;

        // 查詢是否已有提醒設定
        let existingReminderId = null;

        if (medicationId) {
            console.log('🔍 檢查是否已有提醒設定...');
            try {
                const reminderListResponse = await fetch(
                    `${API_BASE_URL}/api/medication-reminders/elder/${currentElderId}`
                );

                if (reminderListResponse.ok) {
                    const reminderList = await reminderListResponse.json();
                    const existingReminder = reminderList.data?.find(
                        r => r.medication_id === medicationId
                    );

                    if (existingReminder) {
                        existingReminderId = existingReminder.id;
                        console.log('✅ 找到現有提醒，將使用 PUT 更新:', existingReminderId);
                    } else {
                        console.log('ℹ️  未找到現有提醒，將使用 POST 創建新提醒');
                    }
                }
            } catch (error) {
                console.warn('查詢現有提醒失敗，將使用 POST 創建:', error);
            }
        }

        // 準備提醒資料
        let finalReminderData = {
            medicationId: medicationId,
            elderId: currentElderId,
            isEnabled: true
        };

        if (durationType === 'chronic') {
            // 長期用藥：使用舊的 cron 方式
            const cronSchedule = timesToCron(times);
            finalReminderData.cronSchedule = cronSchedule;
            finalReminderData.reminderTimes = { times: times };
        } else {
            // 短期用藥：使用新的智能排程 API
            finalReminderData = {
                ...finalReminderData,
                ...reminderMetadata // 包含所有智能排程參數
            };
        }

        // 根據是否已有提醒來決定使用 POST 或 PUT
        let reminderResponse;

        if (existingReminderId) {
            // 更新現有提醒
            console.log('🔄 更新現有提醒 (PUT):', existingReminderId);

            // ✅ 先刪除今日尚未服用的舊記錄
            try {
                console.log('🗑️ 刪除今日尚未服用的舊記錄...');
                const deleteResponse = await fetch(
                    `${API_BASE_URL}/api/medication-logs/today-pending/${medicationId}?elderId=${currentElderId}`,
                    { method: 'DELETE' }
                );
                const deleteResult = await deleteResponse.json();
                console.log('✅ 刪除結果:', deleteResult);
            } catch (deleteError) {
                console.warn('⚠️ 刪除舊記錄失敗（可能沒有記錄）:', deleteError);
            }

            reminderResponse = await fetch(
                `${API_BASE_URL}/api/medication-reminders/${existingReminderId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(finalReminderData)
                }
            );
        } else {
            // 創建新提醒
            console.log('➕ 創建新提醒 (POST)');
            reminderResponse = await fetch(
                `${API_BASE_URL}/api/medication-reminders`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(finalReminderData)
                }
            );
        }

        if (!reminderResponse.ok) {
            console.warn('提醒設定儲存失敗，但藥物已新增');
            const errorData = await reminderResponse.json();
            console.error('提醒API錯誤:', errorData);
        } else {
            const reminderResult = await reminderResponse.json();
            console.log('✅ 提醒設定成功:', reminderResult);

            // ✅ 更新提醒成功後，重新生成今日用藥記錄
            if (existingReminderId) {
                try {
                    console.log('🔄 重新生成今日用藥記錄...');
                    const generateResponse = await fetch(`${API_BASE_URL}/api/scheduler/generate-today-logs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ elderId: currentElderId })
                    });
                    const generateResult = await generateResponse.json();
                    console.log('✅ 重新生成結果:', generateResult);
                } catch (genError) {
                    console.warn('⚠️ 重新生成今日記錄失敗:', genError);
                }
            }
        }

        showToast('✅ 用藥提醒設定完成！', 'success');
        closeMedicationModal();
        await loadMedications();

        // ✅ 如果當前在「今日用藥」分頁，也重新載入
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab === 'today') {
            await loadTodayMedications();
        }
    } catch (error) {
        console.error('儲存藥物失敗:', error);
        showToast('儲存失敗，請稍後再試', 'error');
    }
}

function closeMedicationModal() {
    document.getElementById('medicationModal').classList.remove('show');
}

async function deleteMedication(id) {
    if (!confirm('確定要刪除這個藥物嗎？\n相關的提醒設定也會一併移除。')) {
        return;
    }

    try {
        console.log('🗑️ 刪除藥物:', id);

        const response = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
            method: 'DELETE'
        });

        console.log('📡 刪除 API 回應狀態:', response.status);

        const result = await response.json();
        console.log('📊 刪除 API 回應內容:', result);

        if (response.ok) {
            showToast('藥物已刪除', 'success');
            await loadMedications();
        } else {
            const errorMsg = result.message || result.error || '刪除失敗';
            console.error('❌ 刪除失敗:', errorMsg);
            showToast(`刪除失敗: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('❌ 刪除藥物異常:', error);
        showToast('刪除失敗，請稍後再試', 'error');
    }
}

// ==================== 提醒設定 ====================

async function showReminderSettings(medicationId) {
    const med = medications.find(m => m.id === medicationId);
    if (!med) return;

    try {
        // 載入現有的提醒設定
        const response = await fetch(`${API_BASE_URL}/api/medication-reminders/elder/${currentElderId}`);
        const result = await response.json();

        const reminder = result.data?.find(r => r.medication_id === medicationId);

        const content = document.getElementById('reminderContent');
        content.innerHTML = `
            <div class="reminder-settings">
                <h3>💊 ${med.medication_name}</h3>
                <form id="reminderForm" onsubmit="saveReminder(event, '${medicationId}')">
                    <div class="form-group">
                        <label>提醒方式</label>
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="enablePush" ${reminder?.is_enabled ? 'checked' : ''}>
                                <span>📱 推播通知（免費）</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="enableEmail" ${reminder ? 'checked' : ''}>
                                <span>📧 Email 通知</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>提醒時間</label>
                        <div id="reminderTimes">
                            ${reminder?.reminder_times ? renderReminderTimes(reminder.reminder_times) : ''}
                        </div>
                        <button type="button" class="btn-secondary" onclick="addReminderTime()">
                            ➕ 新增時間
                        </button>
                    </div>

                    <div class="form-group">
                        <label>進階設定</label>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="reminderAdvance">提前提醒（分鐘）</label>
                                <input type="number" id="reminderAdvance" value="${reminder?.reminder_advance_minutes || 0}" min="0" max="60">
                            </div>
                            <div class="form-group">
                                <label for="autoMarkMissed">逾時標記（分鐘）</label>
                                <input type="number" id="autoMarkMissed" value="${reminder?.auto_mark_missed_after_minutes || 30}" min="1" max="120">
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="notifyFamily" ${reminder?.notify_family_if_missed !== false ? 'checked' : ''}>
                            <span>未服藥時通知家屬</span>
                        </label>
                    </div>

                    <input type="hidden" id="reminderId" value="${reminder?.id || ''}">

                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeReminderModal()">
                            取消
                        </button>
                        <button type="submit" class="btn-primary">
                            儲存設定
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('reminderModal').classList.add('show');
    } catch (error) {
        console.error('載入提醒設定失敗:', error);
        showToast('載入失敗', 'error');
    }
}

function renderReminderTimes(times) {
    if (!Array.isArray(times)) return '';

    return times.map((time, index) => `
        <div class="time-input-group">
            <input type="time" class="reminder-time" value="${time}" required>
            <button type="button" class="btn-icon danger" onclick="removeReminderTime(this)">
                ❌
            </button>
        </div>
    `).join('');
}

function addReminderTime() {
    const container = document.getElementById('reminderTimes');
    const div = document.createElement('div');
    div.className = 'time-input-group';
    div.innerHTML = `
        <input type="time" class="reminder-time" required>
        <button type="button" class="btn-icon danger" onclick="removeReminderTime(this)">
            ❌
        </button>
    `;
    container.appendChild(div);
}

function removeReminderTime(btn) {
    btn.parentElement.remove();
    // 更新刪除按鈕的顯示狀態
    updateRemoveButtons();
}

async function saveReminder(event, medicationId) {
    event.preventDefault();

    const times = Array.from(document.querySelectorAll('.reminder-time'))
        .map(input => input.value)
        .filter(t => t);

    if (times.length === 0) {
        showToast('請至少設定一個提醒時間', 'warning');
        return;
    }

    console.log('收集到的提醒時間:', times);

    // 將時間轉換為 cron 表達式
    const cronSchedule = timesToCron(times);

    if (!cronSchedule) {
        showToast('時間格式錯誤，請檢查輸入的時間', 'error');
        console.error('無法生成 cron 表達式，輸入時間:', times);
        return;
    }

    console.log('生成的 cron 表達式:', cronSchedule);

    const data = {
        medicationId: medicationId,
        elderId: currentElderId,
        cronSchedule: cronSchedule,
        reminderTimes: times,
        isEnabled: document.getElementById('enablePush').checked,
        autoMarkMissedAfterMinutes: parseInt(document.getElementById('autoMarkMissed').value) || 30,
        notifyFamilyIfMissed: document.getElementById('notifyFamily').checked
    };

    const reminderId = document.getElementById('reminderId').value;

    try {
        let response;
        if (reminderId) {
            // 更新
            response = await fetch(`${API_BASE_URL}/api/medication-reminders/${reminderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // 新增
            response = await fetch(`${API_BASE_URL}/api/medication-reminders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }

        const result = await response.json();

        if (response.ok) {
            showToast('提醒設定已儲存', 'success');
            closeReminderModal();
        } else {
            showToast(result.message || '儲存失敗', 'error');
        }
    } catch (error) {
        console.error('儲存提醒設定失敗:', error);
        showToast('儲存失敗，請稍後再試', 'error');
    }
}

function timesToCron(times) {
    // 將時間陣列轉換為 cron 表達式
    // 例如：['08:00', '12:00', '20:00'] => '0 0 8,12,20 * * *'

    if (!times || times.length === 0) {
        console.error('timesToCron: 時間陣列為空');
        return null;
    }

    const timeData = times.map(t => {
        // 確保時間格式正確 (HH:MM)
        if (typeof t !== 'string' || !t.includes(':')) {
            console.error('timesToCron: 無效的時間格式:', t);
            return null;
        }

        const [hour, minute] = t.split(':');
        return {
            hour: parseInt(hour),
            minute: parseInt(minute)
        };
    }).filter(td => td !== null);

    if (timeData.length === 0) {
        console.error('timesToCron: 沒有有效的時間資料');
        return null;
    }

    // 按照時間排序
    timeData.sort((a, b) => {
        if (a.hour !== b.hour) return a.hour - b.hour;
        return a.minute - b.minute;
    });

    // 檢查是否所有時間都有相同的分鐘數
    const firstMinute = timeData[0].minute;
    const allSameMinute = timeData.every(td => td.minute === firstMinute);

    if (allSameMinute) {
        // 如果分鐘數相同，可以用簡化的格式
        const hours = timeData.map(td => td.hour).join(',');
        return `0 ${firstMinute} ${hours} * * *`;
    } else {
        // 如果分鐘數不同，需要為每個時間點建立獨立的 cron 表達式
        // 這裡返回第一個簡化版本，後端需要支援更複雜的排程
        console.warn('timesToCron: 不同的分鐘數，使用第一個時間的分鐘數');
        const hours = timeData.map(td => td.hour).join(',');
        return `0 ${firstMinute} ${hours} * * *`;
    }
}

function closeReminderModal() {
    document.getElementById('reminderModal').classList.remove('show');
}

// ==================== 今日用藥 ====================

function setTodayDate(date = new Date()) {
    selectedDate = new Date(date); // 更新全域選擇的日期

    const dateStr = selectedDate.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });

    // 更新日期顯示
    document.getElementById('todayDate').textContent = dateStr;

    // 更新日期選擇器的值
    const datePickerValue = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const datePicker = document.getElementById('datePicker');
    if (datePicker) {
        datePicker.value = datePickerValue;
    }

    // 如果是今天，加上「今天」標記
    const today = new Date();
    const isToday = selectedDate.getFullYear() === today.getFullYear() &&
                    selectedDate.getMonth() === today.getMonth() &&
                    selectedDate.getDate() === today.getDate();

    if (isToday) {
        document.getElementById('todayDate').textContent = dateStr + ' 【今天】';
    }
}

async function loadTodayMedications() {
    if (!currentElderId) {
        // 隱藏載入狀態
        const loadingState = document.querySelector('#today-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        return;
    }

    try {
        console.log('📅 開始載入用藥計畫...');

        // ✅ 使用全域的 selectedDate 而不是固定的 today
        const targetDate = new Date(selectedDate);

        // 先嘗試生成選定日期的用藥記錄（如果還沒生成的話）
        try {
            console.log('🔄 呼叫生成記錄 API...');
            const generateResponse = await fetch(`${API_BASE_URL}/api/scheduler/generate-today-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ elderId: currentElderId })
            });
            const generateResult = await generateResponse.json();
            console.log('✅ 生成記錄結果:', generateResult);
        } catch (genError) {
            console.warn('⚠️ 生成記錄失敗（可能已存在）:', genError);
        }

        // ✅ 修正：使用 selectedDate 來比較
        const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

        console.log('🔍 查詢用藥記錄...', {
            elderId: currentElderId,
            targetDateStr: targetDateStr,
            selectedDate: targetDate.toISOString()
        });

        const response = await fetch(`${API_BASE_URL}/api/medication-logs/elder/${currentElderId}?days=7`);
        const result = await response.json();

        console.log('📊 查詢結果:', result);

        // 隱藏載入狀態
        const loadingState = document.querySelector('#today-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }

        if (!result.success && !result.data) {
            console.log('⚠️ 沒有查詢到用藥記錄');
            todayLogs = [];
            renderTodayTimeline(todayLogs);
            updateTodayStats(todayLogs);
            return;
        }

        // ✅ 過濾選定日期的記錄（使用本地時區的日期比較）
        const allLogs = result.data || [];
        console.log(`📝 總共 ${allLogs.length} 筆記錄`);
        console.log('🔍 [DEBUG] All logs before filtering:', allLogs.map(log => ({
            id: log.id,
            medication_id: log.medication_id,
            medication_name: log.medication_name || log.medications?.medication_name,
            scheduled_time: log.scheduled_time
        })));

        todayLogs = allLogs.filter(log => {
            // ✅ 修正：將 UTC 時間轉換為本地時間，然後只比較日期部分
            const logDate = new Date(log.scheduled_time);
            const logDateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
            const isTargetDate = logDateStr === targetDateStr;

            console.log(`🔍 [DEBUG] Filtering log ${log.id} (${log.medication_name || log.medications?.medication_name}):`, {
                scheduled_time: log.scheduled_time,
                logDateStr: logDateStr,
                targetDateStr: targetDateStr,
                isTargetDate
            });
            return isTargetDate;
        });

        console.log(`✅ 選定日期記錄: ${todayLogs.length} 筆`);
        console.log('🔍 [DEBUG] Today logs after filtering:', todayLogs.map(log => ({
            id: log.id,
            medication_id: log.medication_id,
            medication_name: log.medication_name || log.medications?.medication_name,
            scheduled_time: log.scheduled_time
        })));

        renderTodayTimeline(todayLogs);
        updateTodayStats(todayLogs);
    } catch (error) {
        console.error('❌ 載入今日用藥失敗:', error);
        // 隱藏載入狀態
        const loadingState = document.querySelector('#today-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        showToast('載入失敗', 'error');
    }
}

function updateTodayStats(logs) {
    const stats = {
        total: logs.length,
        taken: logs.filter(l => l.status === 'taken').length,
        pending: logs.filter(l => l.status === 'pending').length,
        missed: logs.filter(l => l.status === 'missed').length
    };

    document.getElementById('todayTotal').textContent = stats.total;
    document.getElementById('todayTaken').textContent = stats.taken;
    document.getElementById('todayPending').textContent = stats.pending;
    document.getElementById('todayMissed').textContent = stats.missed;
}

function renderTodayTimeline(logs) {
    console.log('🔍 [DEBUG] renderTodayTimeline called');
    console.log('🔍 [DEBUG] Number of logs received:', logs.length);
    console.log('🔍 [DEBUG] All logs data:', logs);

    // 檢查是否有重複的藥物
    const medNames = logs.map(log => log.medication_name || log.medications?.medication_name);
    console.log('🔍 [DEBUG] Medication names:', medNames);

    const container = document.getElementById('todayTimeline');

    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <h3>今天沒有排定的用藥計劃</h3>
                <p>請先在「藥物列表」中新增藥物並設定提醒時間</p>
                <button class="btn-primary" onclick="switchTab('medications')">
                    ➕ 前往設定提醒
                </button>
            </div>
        `;
        return;
    }

    // 按時間排序
    logs.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

    container.innerHTML = logs.map((log, index) => {
        console.log(`🔍 [DEBUG] Rendering log ${index}:`, {
            id: log.id,
            medication_id: log.medication_id,
            medication_name: log.medication_name || log.medications?.medication_name,
            scheduled_time: log.scheduled_time,
            status: log.status
        });

        const time = new Date(log.scheduled_time);
        const timeStr = time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
        const now = new Date();

        // 判斷狀態類別
        let statusClass = '';
        let statusText = '';
        let showConfirmButton = false;

        if (log.status === 'taken') {
            statusClass = 'completed';
            statusText = '✓ 已服用';
            if (log.taken_at) {
                const takenTime = new Date(log.taken_at);
                const takenStr = takenTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                statusText += ` (${takenStr})`;
            }
        } else if (log.status === 'missed') {
            statusClass = 'missed';
            statusText = '✗ 已錯過';
        } else if (log.status === 'pending') {
            if (now > time) {
                statusClass = 'overdue';
                statusText = '⚠️ 逾時';
                showConfirmButton = true;
            } else {
                statusClass = 'pending';
                statusText = '⏰ 待服用';
                showConfirmButton = true;
            }
        }

        // 取得藥物資訊
        const medName = log.medication_name || log.medications?.medication_name || '藥物';
        const dosage = log.dosage || log.medications?.dosage || '';

        return `
            <div class="timeline-item ${statusClass}">
                <div class="timeline-time">${timeStr}</div>
                <div class="timeline-content">
                    <h4>💊 ${medName}</h4>
                    ${dosage ? `<p class="dosage-info">劑量：${dosage}</p>` : ''}
                    ${log.notes ? `<p class="notes-info">📝 ${log.notes}</p>` : ''}
                    <div class="timeline-actions">
                        ${showConfirmButton ? `
                            <button class="btn-small btn-primary" onclick="confirmMedication('${log.id}')">
                                ✓ 確認已服用
                            </button>
                        ` : `
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function confirmMedication(logId) {
    try {
        // 顯示確認對話框
        if (!confirm('確認已服用此藥物？')) {
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/medication-logs/${logId}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                confirmedBy: currentUser.id,
                confirmationMethod: 'app',
                takenAt: new Date().toISOString()
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('✅ 已標記為已服用', 'success');
            // 重新載入今日用藥資料
            await loadTodayMedications();
        } else {
            showToast(result.message || '標記失敗', 'error');
        }
    } catch (error) {
        console.error('確認服藥失敗:', error);
        showToast('操作失敗，請稍後再試', 'error');
    }
}

// ==================== 統計 ====================

async function loadStatistics(days) {
    if (!currentElderId) {
        // 隱藏載入狀態
        const loadingState = document.querySelector('#stats-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/medication-logs/statistics/${currentElderId}?days=${days}`);
        const result = await response.json();

        // 隱藏載入狀態
        const loadingState = document.querySelector('#stats-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }

        const stats = result.data;
        renderStatistics(stats, days);
    } catch (error) {
        console.error('載入統計失敗:', error);
        // 隱藏載入狀態
        const loadingState = document.querySelector('#stats-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        showToast('載入統計失敗', 'error');
    }
}

function renderStatistics(stats, days) {
    const container = document.getElementById('statisticsCards');

    container.innerHTML = `
        <div class="stat-card-large">
            <h3>📊 過去 ${days} 天用藥統計</h3>
            <div class="stat-grid">
                <div class="stat-item">
                    <div class="stat-label">總計</div>
                    <div class="stat-value-large">${stats.total}</div>
                </div>
                <div class="stat-item success">
                    <div class="stat-label">已服用</div>
                    <div class="stat-value-large">${stats.taken}</div>
                </div>
                <div class="stat-item warning">
                    <div class="stat-label">延遲服用</div>
                    <div class="stat-value-large">${stats.late}</div>
                </div>
                <div class="stat-item danger">
                    <div class="stat-label">錯過</div>
                    <div class="stat-value-large">${stats.missed}</div>
                </div>
            </div>
        </div>

        <div class="stat-card-large">
            <h3>📈 服藥順從率</h3>
            <div class="adherence-rate">
                <div class="rate-circle">
                    <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e0e0" stroke-width="10"/>
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#4caf50" stroke-width="10"
                                stroke-dasharray="${stats.adherenceRate * 2.827}, 282.7"
                                transform="rotate(-90 50 50)"/>
                    </svg>
                    <div class="rate-text">${stats.adherenceRate}%</div>
                </div>
                <p class="rate-description">
                    ${stats.adherenceRate >= 90 ? '✨ 非常好！' :
                      stats.adherenceRate >= 70 ? '👍 不錯！' :
                      '💪 需要加油！'}
                </p>
            </div>
        </div>
    `;
}

// ==================== Email 設定 ====================

function showSettings() {
    loadEmailSettings();
    document.getElementById('emailModal').classList.add('show');
}

async function loadEmailSettings() {
    try {
        const { data: elder } = await supabaseClient
            .from('elders')
            .select('email')
            .eq('id', currentElderId)
            .single();

        document.getElementById('userEmail').value = elder?.email || '';
    } catch (error) {
        console.error('載入 Email 設定失敗:', error);
    }
}

async function saveEmailSettings(event) {
    event.preventDefault();

    const email = document.getElementById('userEmail').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/elders/${currentElderId}/email`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            showToast('Email 設定已儲存', 'success');
            closeEmailModal();
        } else {
            showToast('儲存失敗', 'error');
        }
    } catch (error) {
        console.error('儲存 Email 失敗:', error);
        showToast('儲存失敗', 'error');
    }
}

async function testEmail() {
    const email = document.getElementById('userEmail').value;

    if (!email) {
        showToast('請先輸入 Email', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/email/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            showToast('測試郵件已發送，請查收信箱', 'success');
        } else {
            showToast('發送失敗', 'error');
        }
    } catch (error) {
        console.error('發送測試郵件失敗:', error);
        showToast('發送失敗', 'error');
    }
}

function closeEmailModal() {
    document.getElementById('emailModal').classList.remove('show');
}

// ==================== 通知 Toast ====================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}


// 在初始化時註冊 FCM Token
async function registerFCMToken() {
  const token = localStorage.getItem('fcm_token');

  if (!token) {
    console.log('ℹ️ FCM Token 尚未取得，稍後自動註冊');
    return;
  }

  if (!currentUser) {
    console.log('ℹ️ 等待使用者登入後註冊 FCM Token');
    return;
  }

  try {
    const { data: elder } = await supabaseClient
      .from('elders')
      .select('id')
      .eq('auth_user_id', currentUser.id)
      .single();

    if (!elder) {
      console.error('❌ 找不到長輩資料');
      return;
    }

    // 發送到後端 API
    const response = await fetch(`${API_BASE_URL}/api/fcm/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId: elder.id,
        token: token,
        deviceType: 'web'
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ FCM Token 註冊成功');
    }
  } catch (error) {
    console.error('❌ FCM Token 註冊失敗:', error);
  }
}

// ==================== 通知權限管理 ====================

/**
 * 檢查通知權限狀態
 */
function checkNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('此瀏覽器不支援通知功能');
    return 'unsupported';
  }

  console.log('🔔 通知權限狀態:', Notification.permission);
  return Notification.permission;
}

/**
 * 顯示通知權限橫幅
 */
function showNotificationBanner() {
  const banner = document.getElementById('notificationBanner');
  if (banner) {
    banner.style.display = 'block';
  }
}

/**
 * 隱藏通知權限橫幅
 */
function hideNotificationBanner() {
  const banner = document.getElementById('notificationBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

/**
 * 關閉橫幅
 */
function closeBanner() {
  hideNotificationBanner();
  // 記住用戶關閉了橫幅（可以存在 localStorage）
  localStorage.setItem('notificationBannerClosed', 'true');
}

/**
 * 請求通知權限
 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showPermissionGuide('unsupported');
    return false;
  }

  // 如果已經被拒絕，顯示引導說明
  if (Notification.permission === 'denied') {
    showPermissionGuide('denied');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('通知權限請求結果:', permission);

    if (permission === 'granted') {
      hideNotificationBanner();
      alert('✅ 通知權限已開啟！現在會發送測試通知');

      // 發送測試通知
      testNotification();

      return true;
    } else if (permission === 'denied') {
      showPermissionGuide('denied');
      return false;
    } else {
      alert('⚠️ 通知權限未授予，請點擊「允許」以開啟通知');
      return false;
    }
  } catch (error) {
    console.error('請求通知權限失敗:', error);
    alert('請求通知權限失敗');
    return false;
  }
}

/**
 * 測試推送通知（使用 Service Worker 的完整 PWA 通知）
 */
async function testNotification() {
  const permission = checkNotificationPermission();

  if (permission === 'unsupported') {
    alert('您的瀏覽器不支援通知功能');
    return;
  }

  if (permission === 'denied') {
    alert('通知權限被拒絕\n\n請在瀏覽器設定中允許通知：\n1. 點擊網址列左側的鎖頭圖示\n2. 找到「通知」設定\n3. 改為「允許」');
    return;
  }

  if (permission === 'default') {
    // 需要請求權限
    requestNotificationPermission();
    return;
  }

  // permission === 'granted'
  try {
    console.log('🔔 準備發送 PWA 測試通知（包含快速操作按鈕）...');
    console.log('📱 瀏覽器資訊:', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor
    });

    // 檢查 Service Worker 是否已註冊
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ 瀏覽器不支援 Service Worker，使用簡單通知');
      // 降級為簡單通知
      const notification = new Notification('💊 用藥提醒測試', {
        body: '這是一個測試通知（簡化版）',
        tag: 'medication-test',
        requireInteraction: true
      });
      console.log('✅ 簡單通知物件已建立:', notification);
      showToast('✅ 測試通知已發送（簡化版）', 'success');
      return;
    }

    // 獲取 Service Worker registration
    console.log('⏳ 等待 Service Worker ready...');
    const registration = await navigator.serviceWorker.ready;
    console.log('✅ Service Worker ready:', {
      scope: registration.scope,
      active: registration.active?.state,
      installing: registration.installing?.state,
      waiting: registration.waiting?.state
    });

    // 使用 Service Worker 顯示通知（支援快速操作按鈕）
    console.log('📤 準備透過 Service Worker 顯示通知...');
    const notificationOptions = {
      body: '該服用 助眠藥 (1顆) 了\n\n這是測試通知，請試試下方的快速操作按鈕！',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'medication-test-' + Date.now(),
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500],
      silent: false,
      renotify: true,
      // 快速操作按鈕
      actions: [
        {
          action: 'taken',
          title: '✅ 已服用',
          icon: '/icons/check-icon.png'
        },
        {
          action: 'snooze',
          title: '⏰ 10分鐘後提醒',
          icon: '/icons/snooze-icon.png'
        },
        {
          action: 'skip',
          title: '❌ 跳過',
          icon: '/icons/skip-icon.png'
        }
      ],
      data: {
        type: 'test',
        medicationName: '助眠藥',
        dosage: '1顆',
        logId: 'test-log-id',
        timestamp: Date.now(),
        url: '/medications.html'
      }
    };

    console.log('📋 通知選項:', notificationOptions);

    await registration.showNotification('💊 用藥提醒測試', notificationOptions);

    console.log('✅ PWA 測試通知已發送');
    console.log('💡 請檢查：');
    console.log('   1. 瀏覽器右上角的通知中心');
    console.log('   2. 作業系統的通知中心（Windows 通知中心、Mac 通知中心等）');
    console.log('   3. 如果是行動裝置，請下拉通知列');

    showToast('✅ 測試通知已發送！請查看通知區域並試試快速操作按鈕', 'success');

    // 延遲顯示提示
    setTimeout(() => {
      showToast('💡 提示：請檢查瀏覽器或系統的通知中心', 'info');
    }, 2000);

  } catch (error) {
    console.error('❌ 發送測試通知失敗:', error);
    showToast('❌ 發送測試通知失敗: ' + error.message, 'error');
  }
}

/**
 * 顯示通知權限引導說明
 */
function showPermissionGuide(status) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  let message = '';
  let title = '';

  if (status === 'unsupported') {
    title = '❌ 不支援通知功能';
    message = '您的瀏覽器不支援推送通知功能。\n\n建議使用 Chrome、Firefox 或 Edge 瀏覽器。';
  } else if (status === 'denied') {
    title = '🔓 需要開啟通知權限';

    if (isMobile) {
      message = `請按照以下步驟開啟通知權限：

📱 行動裝置設定步驟：

1. 點擊瀏覽器右上角的「⋮」選單
2. 選擇「設定」
3. 找到「網站設定」
4. 選擇「通知」
5. 找到本網站並設為「允許」

完成後請重新整理頁面！`;
    } else {
      message = `請按照以下步驟開啟通知權限：

💻 電腦版設定步驟：

1. 點擊網址列左側的 🔒 鎖頭圖示
2. 找到「通知」設定
3. 將「封鎖」改為「允許」
4. 重新整理頁面

或者：
• Chrome/Edge: 設定 → 隱私權和安全性 → 網站設定 → 通知
• Firefox: 設定 → 隱私權與安全性 → 權限 → 通知`;
    }
  }

  if (confirm(title + '\n\n' + message + '\n\n是否現在開啟瀏覽器設定？')) {
    // 對於桌面版瀏覽器，嘗試提供快捷連結
    if (!isMobile) {
      // Chrome/Edge
      if (navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Edg')) {
        window.open('chrome://settings/content/notifications', '_blank');
      }
      // Firefox
      else if (navigator.userAgent.includes('Firefox')) {
        alert('請在 Firefox 網址列輸入：about:preferences#privacy\n然後找到「權限」區塊中的「通知」設定');
      }
    }
  }
}

/**
 * 頁面載入時自動檢查通知權限
 */
function initNotificationCheck() {
  // 檢查是否已經關閉過橫幅
  const bannerClosed = localStorage.getItem('notificationBannerClosed');

  const permission = checkNotificationPermission();

  // 如果權限未授予且用戶未關閉橫幅，則顯示橫幅
  if (permission !== 'granted' && permission !== 'unsupported' && !bannerClosed) {
    // 延遲 1 秒後顯示橫幅，讓頁面先載入完成
    setTimeout(() => {
      showNotificationBanner();
    }, 1000);
  }

  // 如果權限已授予，記錄狀態
  if (permission === 'granted') {
    console.log('✅ 通知權限已授予');
  }

  // 定期檢查權限是否改變（用戶可能在設定中手動開啟）
  setInterval(() => {
    const currentPermission = Notification.permission;
    if (currentPermission === 'granted' && permission !== 'granted') {
      console.log('✅ 通知權限已開啟！');
      hideNotificationBanner();
      alert('✅ 通知權限已成功開啟！\n\n現在會發送測試通知');
      testNotification();
    }
  }, 2000); // 每2秒檢查一次
}

// 在頁面載入時執行
window.addEventListener('DOMContentLoaded', () => {
  // ... 其他初始化代碼 ...

  registerFCMToken();

  // 初始化通知權限檢查
  initNotificationCheck();
});

// ==================== Google Calendar 同步功能 ====================

/**
 * 同步今日用藥到 Google Calendar
 * 使用 Google Calendar 的 URL 參數來建立事件
 */
async function syncToGoogleCalendar() {
  try {
    showToast('正在準備同步...', 'info');

    // 取得今日所有用藥提醒
    const response = await fetch(`${API_BASE_URL}/api/medications/elder/${currentElderId}`);
    const result = await response.json();

    if (!response.ok || !result.data) {
      throw new Error('無法載入用藥資料');
    }

    const medications = result.data;

    if (medications.length === 0) {
      showToast('目前沒有用藥資料需要同步', 'warning');
      return;
    }

    // 為每個用藥建立 Google Calendar 事件
    let syncedCount = 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (const med of medications) {
      // 取得該藥物的提醒時間
      const reminderResponse = await fetch(
        `${API_BASE_URL}/api/medication-reminders/elder/${currentElderId}`
      );
      const reminderResult = await reminderResponse.json();

      if (!reminderResult.data) continue;

      // 找到對應的提醒
      const reminder = reminderResult.data.find(r => r.medication_id === med.id);
      if (!reminder || !reminder.is_enabled) continue;

      // 解析提醒時間
      let times = [];
      if (reminder.reminder_times && reminder.reminder_times.times) {
        times = reminder.reminder_times.times;
      }

      // 為每個時間建立 Calendar 事件
      for (const time of times) {
        const calendarUrl = createGoogleCalendarEventUrl({
          title: `💊 ${med.medication_name}`,
          description: `劑量: ${med.dosage || '未設定'}\n${med.instructions || ''}`,
          location: '',
          startDate: todayStr,
          startTime: time,
          duration: 15, // 15分鐘
          recurrence: 'DAILY' // 每天重複
        });

        // 開啟新視窗
        window.open(calendarUrl, '_blank');
        syncedCount++;

        // 延遲避免瀏覽器阻擋多個彈窗
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (syncedCount > 0) {
      showToast(`✅ 已開啟 ${syncedCount} 個 Google Calendar 視窗，請在每個視窗中確認儲存`, 'success');
    } else {
      showToast('沒有找到需要同步的用藥提醒', 'warning');
    }

  } catch (error) {
    console.error('同步到 Google Calendar 失敗:', error);
    showToast('同步失敗: ' + error.message, 'error');
  }
}

/**
 * 建立 Google Calendar 事件 URL
 */
function createGoogleCalendarEventUrl(options) {
  const {
    title,
    description,
    location,
    startDate,
    startTime,
    duration = 30,
    recurrence = null
  } = options;

  // 組合開始時間
  const startDateTime = `${startDate}T${startTime}:00`;
  const start = new Date(startDateTime);

  // 計算結束時間
  const end = new Date(start.getTime() + duration * 60000);

  // 格式化為 Google Calendar 需要的格式 (YYYYMMDDTHHmmss)
  const formatGoogleDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  // 建立 URL 參數
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: description || '',
    location: location || '',
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`
  });

  // 如果有重複規則
  if (recurrence) {
    params.append('recur', `RRULE:FREQ=${recurrence}`);
  }

  // 加入提醒（提前5分鐘和15分鐘）
  params.append('reminder', '5');
  params.append('reminder', '15');

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ==================== 通知狀態檢查 ====================

/**
 * 檢查並顯示通知狀態
 */
async function checkNotificationStatus() {
  const permissionStatus = document.getElementById('permissionStatus');
  const swStatus = document.getElementById('swStatus');

  // 檢查通知權限
  if (!('Notification' in window)) {
    permissionStatus.innerHTML = '<span style="color: #dc3545;">❌ 不支援</span>';
    permissionStatus.title = '您的瀏覽器不支援推送通知';
  } else {
    const permission = Notification.permission;
    if (permission === 'granted') {
      permissionStatus.innerHTML = '<span style="color: #28a745;">✅ 已允許</span>';
      permissionStatus.title = '通知權限已授予';
    } else if (permission === 'denied') {
      permissionStatus.innerHTML = '<span style="color: #dc3545;">❌ 已拒絕</span>';
      permissionStatus.title = '請在瀏覽器設定中允許通知';
    } else {
      permissionStatus.innerHTML = '<span style="color: #ffc107;">⚠️ 未設定</span>';
      permissionStatus.title = '請點擊測試按鈕以請求權限';
    }
  }

  // 檢查 Service Worker
  if (!('serviceWorker' in navigator)) {
    swStatus.innerHTML = '<span style="color: #dc3545;">❌ 不支援</span>';
    swStatus.title = '您的瀏覽器不支援 Service Worker';
  } else {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (registration) {
        if (registration.active) {
          swStatus.innerHTML = '<span style="color: #28a745;">✅ 已啟用</span>';
          swStatus.title = 'Service Worker 運作中';
        } else if (registration.installing) {
          swStatus.innerHTML = '<span style="color: #ffc107;">⏳ 安裝中</span>';
          swStatus.title = 'Service Worker 正在安裝';
        } else {
          swStatus.innerHTML = '<span style="color: #ffc107;">⚠️ 待啟動</span>';
          swStatus.title = 'Service Worker 已註冊但尚未啟動';
        }
      } else {
        swStatus.innerHTML = '<span style="color: #dc3545;">❌ 未註冊</span>';
        swStatus.title = '請重新整理頁面';
      }
    } catch (error) {
      swStatus.innerHTML = '<span style="color: #dc3545;">❌ 檢查失敗</span>';
      swStatus.title = error.message;
      console.error('檢查 Service Worker 失敗:', error);
    }
  }

  showToast('✅ 已更新通知狀態', 'success');
}

// 頁面載入時自動檢查通知狀態
if (document.getElementById('notificationStatus')) {
  // 等待頁面完全載入後再檢查
  setTimeout(() => {
    checkNotificationStatus();
  }, 1000);
}

// ==================== 手機鬧鐘設定功能 ====================

/**
 * 偵測裝置類型並顯示對應的提醒設定選項
 */
function initDeviceBasedReminder() {
  console.log('🔍 開始裝置偵測...');
  console.log('   User Agent:', navigator.userAgent);
  console.log('   Screen Width:', window.innerWidth);

  const isMobile = DeviceDetector.isMobile();
  console.log('   isMobile 結果:', isMobile);

  const mobileAlarmSection = document.getElementById('mobileAlarmSection');
  const desktopCalendarBtn = document.getElementById('desktopCalendarBtn');

  console.log('   找到 mobileAlarmSection:', mobileAlarmSection ? '✅' : '❌');
  console.log('   找到 desktopCalendarBtn:', desktopCalendarBtn ? '✅' : '❌');

  if (isMobile) {
    // 手機：顯示鬧鐘設定
    if (mobileAlarmSection) {
      mobileAlarmSection.style.display = 'block';
      console.log('✅ 已顯示手機鬧鐘區域');
    } else {
      console.error('❌ 找不到 mobileAlarmSection 元素！');
    }
    if (desktopCalendarBtn) {
      desktopCalendarBtn.style.display = 'none';
    }
    console.log('📱 偵測到手機裝置，顯示鬧鐘設定功能');
  } else {
    // 桌面：顯示 Google Calendar
    if (mobileAlarmSection) {
      mobileAlarmSection.style.display = 'none';
    }
    if (desktopCalendarBtn) {
      desktopCalendarBtn.style.display = 'block';
      console.log('✅ 已顯示 Google Calendar 按鈕');
    } else {
      console.error('❌ 找不到 desktopCalendarBtn 元素！');
    }
    console.log('💻 偵測到桌面裝置，顯示 Google Calendar 功能');
  }
}

/**
 * 開啟手機鬧鐘設定彈窗
 */
async function setupPhoneAlarms() {
  console.log('📱 開始設定手機鬧鐘...');

  // 檢查是否有今日用藥記錄
  if (!todayLogs || todayLogs.length === 0) {
    showToast('⚠️ 今日沒有用藥計劃', 'warning');
    return;
  }

  // 開啟彈窗
  const modal = document.getElementById('phoneAlarmModal');
  const alarmListContent = document.getElementById('alarmListContent');

  if (!modal || !alarmListContent) {
    console.error('❌ 找不到鬧鐘設定 Modal');
    return;
  }

  // 清空列表
  alarmListContent.innerHTML = '';

  // 依時間排序
  const sortedLogs = [...todayLogs].sort((a, b) => {
    return a.scheduled_time.localeCompare(b.scheduled_time);
  });

  // 建立鬧鐘列表
  sortedLogs.forEach((log, index) => {
    const alarmItem = document.createElement('div');
    alarmItem.className = 'alarm-item';
    alarmItem.innerHTML = `
      <div class="alarm-item-info">
        <div class="alarm-time">${log.scheduled_time}</div>
        <div class="alarm-label">${getMealTimeLabel(log.scheduled_time)}</div>
        <div class="alarm-medicine">💊 ${log.medication_name} - ${log.dosage}</div>
      </div>
      <div class="alarm-item-action">
        <button class="btn-set-alarm" onclick="setPhoneAlarm('${log.scheduled_time}', '${log.medication_name}', '${log.dosage}', ${index})">
          ⏰ 設定鬧鐘
        </button>
      </div>
    `;
    alarmListContent.appendChild(alarmItem);
  });

  // 顯示彈窗
  modal.style.display = 'flex';

  showToast(`✅ 找到 ${sortedLogs.length} 個用藥時間`, 'success');
}

/**
 * 設定單個手機鬧鐘
 */
function setPhoneAlarm(time, medicineName, dosage, index) {
  console.log(`⏰ 設定鬧鐘: ${time} - ${medicineName}`);

  // 解析時間
  const [hours, minutes] = time.split(':').map(num => parseInt(num));

  // 建立鬧鐘標籤
  const label = `用藥提醒：${medicineName} ${dosage}`;

  // Android: 使用 Intent URI 開啟鬧鐘設定
  const androidIntent = `intent://alarm?hour=${hours}&minutes=${minutes}&message=${encodeURIComponent(label)}&skipUi=false#Intent;scheme=android.intent.action.SET_ALARM;end`;

  // iOS: 使用 clock: URI (有限支援)
  const iosScheme = `clock://`;

  // 偵測系統
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

  if (isAndroid) {
    // Android: 開啟鬧鐘設定
    console.log('📱 偵測到 Android，開啟鬧鐘設定');
    window.location.href = androidIntent;
  } else if (isIOS) {
    // iOS: 開啟時鐘 App（需手動設定）
    console.log('📱 偵測到 iOS，開啟時鐘 App');
    showToast('iOS 需要手動設定鬧鐘', 'info');

    // 嘗試開啟時鐘 App
    setTimeout(() => {
      window.location.href = iosScheme;
    }, 500);

    // 顯示提示
    alert(`請在時鐘 App 中手動設定鬧鐘：\n\n時間：${time}\n標籤：${label}`);
  } else {
    // 其他裝置
    showToast('⚠️ 此功能僅支援 Android 和 iOS 手機', 'warning');
    return;
  }

  // 標記為已設定
  const buttons = document.querySelectorAll('.btn-set-alarm');
  if (buttons[index]) {
    buttons[index].classList.add('set');
    buttons[index].innerHTML = '✅ 已設定';
  }

  showToast(`✅ 已開啟 ${time} 的鬧鐘設定`, 'success');
}

/**
 * 關閉手機鬧鐘設定彈窗
 */
function closePhoneAlarmModal() {
  const modal = document.getElementById('phoneAlarmModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ==================== 日期切換功能 ====================

/**
 * 切換日期（前一天或後一天）
 * @param {number} offset - 天數偏移量（-1 表示前一天，1 表示後一天）
 */
function changeDate(offset) {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    selectedDate = newDate;

    // 更新日期顯示
    setTodayDate(selectedDate);

    // 重新載入該日期的用藥資料
    loadTodayMedications();
}

/**
 * 選擇特定日期
 * @param {string} dateString - 日期字串（YYYY-MM-DD 格式）
 */
function selectSpecificDate(dateString) {
    if (!dateString) return;

    const newDate = new Date(dateString + 'T00:00:00'); // 確保使用本地時區
    selectedDate = newDate;

    // 更新日期顯示
    setTodayDate(selectedDate);

    // 重新載入該日期的用藥資料
    loadTodayMedications();
}

/**
 * 回到今天
 */
function goToToday() {
    selectedDate = new Date();

    // 更新日期顯示
    setTodayDate(selectedDate);

    // 重新載入今日用藥資料
    loadTodayMedications();
}

/**
 * 根據時間取得餐次標籤
 */
function getMealTimeLabel(time) {
  const [hours] = time.split(':').map(num => parseInt(num));

  if (hours >= 5 && hours < 10) {
    return '🌅 早餐時間';
  } else if (hours >= 10 && hours < 14) {
    return '🌞 午餐時間';
  } else if (hours >= 14 && hours < 18) {
    return '☀️ 下午時間';
  } else if (hours >= 18 && hours < 22) {
    return '🌆 晚餐時間';
  } else {
    return '🌙 睡前時間';
  }
}

// 註解：裝置偵測已移至主要的 DOMContentLoaded 事件中
