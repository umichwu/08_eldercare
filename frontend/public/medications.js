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
            showToast('載入使用者資料失敗', 'error');
            return;
        }

        if (profile && profile.role === 'elder') {
            const { data: elder, error: elderError } = await supabaseClient
                .from('elders')
                .select('*')
                .eq('user_profile_id', profile.id)
                .single();

            if (elderError) {
                console.error('載入 elder 失敗:', elderError);
                showToast('找不到長輩資料', 'error');
                return;
            }

            currentElderId = elder?.id;
            console.log('✅ 當前長輩 ID:', currentElderId);
        } else {
            showToast('此功能僅供長輩使用', 'warning');
        }
    } catch (error) {
        console.error('載入使用者失敗:', error);
        showToast('載入使用者資料失敗', 'error');
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
        showToast('請先完成個人資料設定', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/medications/elder/${currentElderId}`);
        const result = await response.json();

        if (result.data && result.data.length > 0) {
            medications = result.data;
            renderMedications(medications);
            document.getElementById('emptyState').style.display = 'none';
        } else {
            medications = [];
            document.querySelector('.loading-state').style.display = 'none';
            document.getElementById('emptyState').style.display = 'flex';
        }
    } catch (error) {
        console.error('載入藥物失敗:', error);
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
    document.getElementById('modalTitle').textContent = '➕ 新增藥物';
    document.getElementById('medicationForm').reset();
    document.getElementById('medicationId').value = '';
    document.getElementById('medicationModal').classList.add('show');
}

async function editMedication(id) {
    const med = medications.find(m => m.id === id);
    if (!med) return;

    document.getElementById('modalTitle').textContent = '✏️ 編輯藥物';
    document.getElementById('medicationId').value = med.id;
    document.getElementById('medicationName').value = med.medication_name;
    document.getElementById('dosage').value = med.dosage || '';
    document.getElementById('medicationType').value = med.medication_type || '';
    document.getElementById('purpose').value = med.purpose || '';
    document.getElementById('instructions').value = med.instructions || '';
    document.getElementById('sideEffects').value = med.side_effects || '';
    document.getElementById('prescribingDoctor').value = med.prescribing_doctor || '';
    document.getElementById('stockQuantity').value = med.stock_quantity || 0;

    document.getElementById('medicationModal').classList.add('show');
}

async function saveMedication(event) {
    event.preventDefault();

    const id = document.getElementById('medicationId').value;
    const data = {
        elderId: currentElderId,
        medicationName: document.getElementById('medicationName').value,
        dosage: document.getElementById('dosage').value,
        medicationType: document.getElementById('medicationType').value,
        purpose: document.getElementById('purpose').value,
        instructions: document.getElementById('instructions').value,
        sideEffects: document.getElementById('sideEffects').value,
        prescribingDoctor: document.getElementById('prescribingDoctor').value,
        stockQuantity: parseInt(document.getElementById('stockQuantity').value) || 0,
        status: 'active'
    };

    try {
        let response;
        if (id) {
            // 更新
            response = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // 新增
            response = await fetch(`${API_BASE_URL}/api/medications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }

        const result = await response.json();

        if (response.ok) {
            showToast(id ? '藥物更新成功' : '藥物新增成功', 'success');
            closeMedicationModal();
            await loadMedications();
        } else {
            showToast(result.message || '儲存失敗', 'error');
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
    if (!currentElderId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/medication-logs/pending?elderId=${currentElderId}`);
        const result = await response.json();

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
    if (!currentElderId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/medication-logs/statistics/${currentElderId}?days=${days}`);
        const result = await response.json();

        const stats = result.data;
        renderStatistics(stats, days);
    } catch (error) {
        console.error('載入統計失敗:', error);
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
        const { data: elder } = await supabase
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
