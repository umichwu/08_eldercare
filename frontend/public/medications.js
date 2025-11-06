/**
 * 用藥管理系統 - 前端邏輯
 */

// API 基礎 URL
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://eldercare-backend.onrender.com';

// Supabase 設定
const SUPABASE_URL = 'https://oatdjdelzybcacwqafkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGRqZGVsenliY2Fjd3FhZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM5ODUsImV4cCI6MjA3Njc3OTk4NX0.Flk-9yHREG7gWr1etG-TEc2ufPjP-zvW2Ejd2gCqG4w';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 全域變數
let currentUser = null;
let currentElderId = null;
let medications = [];
let todayLogs = [];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadCurrentUser();
    await loadMedications();
    setTodayDate();
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

        if (profile && profile.role === 'elder') {
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
            console.log('✅ 當前長輩 ID:', currentElderId);
        } else if (!profile.role) {
            // 如果沒有設定角色，預設為長輩並建立資料
            await updateProfileAndCreateElder(profile.id);
        } else {
            showToast('此功能僅供長輩使用', 'warning');
        }
    } catch (error) {
        console.error('載入使用者失敗:', error);
        showToast('載入使用者資料失敗', 'error');
    }
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
            return;
        }

        console.log('✅ Profile 建立成功:', data);
        // 繼續建立長輩資料
        await createDefaultElder(data.id);
    } catch (error) {
        console.error('建立預設 profile 失敗:', error);
        showToast('初始化失敗', 'error');
    }
}

// 建立預設的長輩資料
async function createDefaultElder(profileId) {
    try {
        const { data, error } = await supabaseClient
            .from('elders')
            .insert([{
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
            return;
        }

        currentElderId = data.id;
        console.log('✅ Elder 資料建立成功:', currentElderId);
        showToast('✅ 個人資料初始化完成', 'success');

        // 重新載入頁面資料
        await loadMedications();
    } catch (error) {
        console.error('建立預設 elder 失敗:', error);
        showToast('初始化失敗', 'error');
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
// Guard: ensure loading spinner is hidden when elder id not ready
/* removed bare early-return to prevent endless loading */

    if (!currentElderId) {
        showToast('請先完成個人資料設定', 'warning');
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

// ==================== 新增/編輯藥物 ====================

function showAddMedicationForm() {
    document.getElementById('modalTitle').textContent = '➕ 快速新增用藥提醒';
    document.getElementById('medicationForm').reset();
    document.getElementById('medicationId').value = '';

    // 重置提醒時間容器，只保留一個空的時間輸入
    const container = document.getElementById('reminderTimesContainer');
    container.innerHTML = `
        <div class="time-input-group">
            <input type="time" class="reminder-time" required>
            <button type="button" class="btn-icon danger" onclick="removeReminderTime(this)" style="display: none;">
                ❌
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
    div.className = 'time-input-group';
    div.innerHTML = `
        <input type="time" class="reminder-time" required>
        <button type="button" class="btn-icon danger" onclick="removeReminderTime(this)">
            ❌
        </button>
    `;
    container.appendChild(div);

    // 顯示所有刪除按鈕（當有多個時間時）
    updateRemoveButtons();
}

// 更新刪除按鈕的顯示狀態
function updateRemoveButtons() {
    const container = document.getElementById('reminderTimesContainer');
    const groups = container.querySelectorAll('.time-input-group');
    groups.forEach((group, index) => {
        const btn = group.querySelector('.btn-icon');
        // 如果只有一個時間，隱藏刪除按鈕
        btn.style.display = groups.length > 1 ? 'inline-block' : 'none';
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

    document.getElementById('modalTitle').textContent = '✏️ 編輯藥物與提醒';
    document.getElementById('medicationId').value = med.id;
    document.getElementById('medicationName').value = med.medication_name;
    document.getElementById('dosage').value = med.dosage || '';
    document.getElementById('medicationType').value = med.medication_type || '';
    document.getElementById('purpose').value = med.purpose || '';

    // 從 instructions 中提取用藥時機
    const instructions = med.instructions || '';
    let mealTiming = '';
    let cleanedInstructions = instructions;

    if (instructions.includes('飯前')) {
        mealTiming = 'before_meal';
        cleanedInstructions = instructions.replace('飯前30分鐘服用。', '').trim();
    } else if (instructions.includes('飯中') || instructions.includes('隨餐')) {
        mealTiming = 'with_meal';
        cleanedInstructions = instructions.replace('隨餐服用。', '').trim();
    } else if (instructions.includes('飯後')) {
        mealTiming = 'after_meal';
        cleanedInstructions = instructions.replace('飯後30分鐘服用。', '').trim();
    } else if (instructions.includes('睡前')) {
        mealTiming = 'bedtime';
        cleanedInstructions = instructions.replace('睡前服用。', '').trim();
    } else {
        mealTiming = 'anytime';
    }

    document.getElementById('mealTiming').value = mealTiming;
    document.getElementById('instructions').value = cleanedInstructions;
    document.getElementById('sideEffects').value = med.side_effects || '';
    document.getElementById('prescribingDoctor').value = med.prescribing_doctor || '';
    document.getElementById('stockQuantity').value = med.stock_quantity || 30;

    // 載入提醒時間
    try {
        const response = await fetch(`${API_BASE_URL}/api/medication-reminders/elder/${currentElderId}`);
        const result = await response.json();
        const reminder = result.data?.find(r => r.medication_id === id);

        if (reminder && reminder.reminder_times) {
            const container = document.getElementById('reminderTimesContainer');
            container.innerHTML = reminder.reminder_times.map((time, index) => `
                <div class="time-input-group">
                    <input type="time" class="reminder-time" value="${time}" required>
                    <button type="button" class="btn-icon danger" onclick="removeReminderTime(this)"
                            style="display: ${reminder.reminder_times.length > 1 ? 'inline-block' : 'none'};">
                        ❌
                    </button>
                </div>
            `).join('');
        } else {
            // 如果沒有提醒設定，顯示空的時間輸入
            const container = document.getElementById('reminderTimesContainer');
            container.innerHTML = `
                <div class="time-input-group">
                    <input type="time" class="reminder-time" required>
                    <button type="button" class="btn-icon danger" onclick="removeReminderTime(this)" style="display: none;">
                        ❌
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('載入提醒設定失敗:', error);
    }

    document.getElementById('medicationModal').classList.add('show');
}

async function saveMedication(event) {
    event.preventDefault();

    // 收集提醒時間
    const times = Array.from(document.querySelectorAll('#reminderTimesContainer .reminder-time'))
        .map(input => input.value)
        .filter(t => t);

    if (times.length === 0) {
        showToast('請至少設定一個提醒時間', 'warning');
        return;
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
            // 更新藥物
            response = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
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

        // 儲存提醒設定
        const cronSchedule = timesToCron(times);
        const reminderData = {
            medicationId: medicationId,
            elderId: currentElderId,
            cronSchedule: cronSchedule,
            reminderTimes: times,
            isEnabled: true,
            autoMarkMissedAfterMinutes: 30,
            notifyFamilyIfMissed: true
        };

        const reminderResponse = await fetch(`${API_BASE_URL}/api/medication-reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reminderData)
        });

        if (!reminderResponse.ok) {
            console.warn('提醒設定儲存失敗，但藥物已新增');
        }

        showToast('✅ 用藥提醒設定完成！', 'success');
        closeMedicationModal();
        await loadMedications();
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
        const response = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('藥物已刪除', 'success');
            await loadMedications();
        } else {
            showToast('刪除失敗', 'error');
        }
    } catch (error) {
        console.error('刪除藥物失敗:', error);
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

    // 將時間轉換為 cron 表達式
    const cronSchedule = timesToCron(times);

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
    // 例如：['08:00', '12:00', '20:00'] => '0 8,12,20 * * *'
    const hours = times.map(t => t.split(':')[0]).join(',');
    return `0 ${hours} * * *`;
}

function closeReminderModal() {
    document.getElementById('reminderModal').classList.remove('show');
}

// ==================== 今日用藥 ====================

function setTodayDate() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
    document.getElementById('todayDate').textContent = dateStr;
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
        const response = await fetch(`${API_BASE_URL}/api/medication-logs/pending?elderId=${currentElderId}`);
        const result = await response.json();

        // 隱藏載入狀態
        const loadingState = document.querySelector('#today-tab .loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }

        todayLogs = result.data || [];

        // 過濾今日的記錄
        const today = new Date().toDateString();
        todayLogs = todayLogs.filter(log =>
            new Date(log.scheduled_time).toDateString() === today
        );

        renderTodayTimeline(todayLogs);
        updateTodayStats(todayLogs);
    } catch (error) {
        console.error('載入今日用藥失敗:', error);
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
    const container = document.getElementById('todayTimeline');

    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>今天沒有排定的用藥計劃</p>
                <button class="btn-primary" onclick="switchTab('medications')">
                    前往設定提醒
                </button>
            </div>
        `;
        return;
    }

    // 按時間排序
    logs.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

    container.innerHTML = logs.map(log => {
        const time = new Date(log.scheduled_time);
        const timeStr = time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
        const statusClass = log.status === 'taken' ? 'completed' :
                          log.status === 'missed' ? 'missed' :
                          new Date() > time ? 'overdue' : 'pending';

        return `
            <div class="timeline-item ${statusClass}">
                <div class="timeline-time">${timeStr}</div>
                <div class="timeline-content">
                    <h4>${log.medications?.medication_name || '藥物'}</h4>
                    <p>${log.medications?.dosage || ''}</p>
                    ${log.status === 'pending' && new Date() <= time ? `
                        <button class="btn-small btn-primary" onclick="confirmMedication('${log.id}')">
                            ✓ 已服用
                        </button>
                    ` : ''}
                    ${log.status === 'taken' ? `
                        <span class="status-badge success">✓ 已服用</span>
                    ` : ''}
                    ${log.status === 'missed' ? `
                        <span class="status-badge danger">✗ 已錯過</span>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function confirmMedication(logId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/medication-logs/${logId}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                confirmedBy: currentUser.id,
                confirmationMethod: 'app'
            })
        });

        if (response.ok) {
            showToast('已標記為已服用', 'success');
            await loadTodayMedications();
        } else {
            showToast('標記失敗', 'error');
        }
    } catch (error) {
        console.error('確認服藥失敗:', error);
        showToast('操作失敗', 'error');
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
