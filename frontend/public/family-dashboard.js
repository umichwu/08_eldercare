/**
 * 家屬監控面板 - 前端邏輯
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
let currentFamilyMemberId = null;
let currentElderId = null;
let elders = [];
let adherenceChart = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadCurrentUser();
    await loadElders();
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

        if (profile && profile.role === 'family_member') {
            const { data: familyMember, error: familyError } = await supabaseClient
                .from('family_members')
                .select('*')
                .eq('user_profile_id', profile.id)
                .single();

            if (familyError) {
                console.error('載入 family member 失敗:', familyError);
                showToast('找不到家屬資料', 'error');
                return;
            }

            currentFamilyMemberId = familyMember?.id;
            console.log('✅ 當前家屬 ID:', currentFamilyMemberId);
        } else {
            showToast('此功能僅供家屬使用', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
        }
    } catch (error) {
        console.error('載入使用者失敗:', error);
        showToast('載入使用者資料失敗', 'error');
    }
}

// ==================== 長輩管理 ====================

async function loadElders() {
    if (!currentFamilyMemberId) {
        showToast('請先完成個人資料設定', 'warning');
        return;
    }

    try {
        // 查詢關聯的長輩
        const { data: relationships, error } = await supabaseClient
            .from('elder_family_relationships')
            .select(`
                elder_id,
                relationship,
                elders (
                    id,
                    name,
                    nickname,
                    age,
                    phone,
                    email
                )
            `)
            .eq('family_member_id', currentFamilyMemberId);

        if (error) {
            console.error('載入長輩失敗:', error);
            showToast('載入長輩列表失敗', 'error');
            return;
        }

        elders = relationships.map(rel => ({
            ...rel.elders,
            relationship: rel.relationship
        }));

        renderElderSelector();

        if (elders.length > 0) {
            currentElderId = elders[0].id;
            await loadDashboardData();
        } else {
            showToast('尚未關聯任何長輩', 'warning');
        }
    } catch (error) {
        console.error('載入長輩失敗:', error);
        showToast('載入長輩列表失敗', 'error');
    }
}

function renderElderSelector() {
    const select = document.getElementById('elderSelect');

    if (elders.length === 0) {
        select.innerHTML = '<option value="">尚未關聯長輩</option>';
        return;
    }

    select.innerHTML = elders.map(elder => `
        <option value="${elder.id}">
            ${elder.name}（${elder.relationship}）${elder.nickname ? ' - ' + elder.nickname : ''}
        </option>
    `).join('');

    select.value = currentElderId;
}

function switchElder(elderId) {
    currentElderId = elderId;
    loadDashboardData();
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
    if (tabName === 'medication') {
        loadMedicationLogs();
    } else if (tabName === 'conversations') {
        loadConversations();
    } else if (tabName === 'alerts') {
        loadAlerts();
    }
}

// ==================== 總覽面板 ====================

async function loadDashboardData() {
    if (!currentElderId) return;

    try {
        await Promise.all([
            loadTodayMetrics(),
            loadAdherenceTrend(),
            loadRecentActivity()
        ]);
    } catch (error) {
        console.error('載入儀表板資料失敗:', error);
        showToast('載入資料失敗', 'error');
    }
}

async function loadTodayMetrics() {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 今日用藥遵從率
        const adherenceResponse = await fetch(
            `${API_BASE_URL}/api/medication-logs/statistics/${currentElderId}?days=1`
        );
        const adherenceData = await adherenceResponse.json();

        if (adherenceData.success && adherenceData.data) {
            const rate = adherenceData.data.adherenceRate || 0;
            document.getElementById('todayAdherence').textContent = `${rate}%`;

            const trend = rate >= 80 ? '✓ 良好' : rate >= 60 ? '⚠ 注意' : '✗ 不佳';
            const trendClass = rate >= 80 ? 'trend-good' : rate >= 60 ? 'trend-warning' : 'trend-bad';
            document.getElementById('adherenceTrend').innerHTML = `<span class="${trendClass}">${trend}</span>`;
        }

        // 今日對話次數
        const { data: conversations, error: convError } = await supabaseClient
            .from('conversations')
            .select('id')
            .eq('user_id', currentElderId)
            .gte('created_at', today + 'T00:00:00');

        if (!convError) {
            document.getElementById('todayConversations').textContent = conversations.length;
            const trend = conversations.length > 0 ? '✓ 活躍' : '- 無活動';
            document.getElementById('conversationsTrend').textContent = trend;
        }

        // 最後活動時間
        const { data: lastConv } = await supabaseClient
            .from('conversations')
            .select('updated_at')
            .eq('user_id', currentElderId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (lastConv) {
            const lastTime = new Date(lastConv.updated_at);
            const now = new Date();
            const diffHours = Math.floor((now - lastTime) / (1000 * 60 * 60));

            document.getElementById('lastActivity').textContent = formatTimeAgo(lastTime);

            const status = diffHours < 6 ? '✓ 正常' : diffHours < 24 ? '⚠ 注意' : '✗ 異常';
            const statusClass = diffHours < 6 ? 'trend-good' : diffHours < 24 ? 'trend-warning' : 'trend-bad';
            document.getElementById('activityStatus').innerHTML = `<span class="${statusClass}">${status}</span>`;
        }

        // 待處理警示
        // TODO: 實作警示系統後補充
        document.getElementById('pendingAlerts').textContent = '0';
        document.getElementById('alertsTrend').innerHTML = '<span class="trend-good">✓ 無異常</span>';

    } catch (error) {
        console.error('載入今日指標失敗:', error);
    }
}

async function loadAdherenceTrend() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/medication-logs/statistics/${currentElderId}?days=7`
        );
        const result = await response.json();

        if (!result.success || !result.data) return;

        const stats = result.data;
        const labels = [];
        const data = [];

        // 計算過去 7 天的遵從率
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }));

            // 這裡簡化處理，實際應該從後端獲取每日數據
            data.push(Math.floor(Math.random() * 20) + 80); // 模擬數據，待後端 API 完善
        }

        renderAdherenceChart(labels, data);
    } catch (error) {
        console.error('載入遵從趨勢失敗:', error);
    }
}

function renderAdherenceChart(labels, data) {
    const ctx = document.getElementById('adherenceChart');

    if (adherenceChart) {
        adherenceChart.destroy();
    }

    adherenceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '用藥遵從率 (%)',
                data: data,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

async function loadRecentActivity() {
    try {
        const { data: activities, error } = await supabaseClient
            .from('conversations')
            .select('id, title, created_at, message_count')
            .eq('user_id', currentElderId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('載入活動失敗:', error);
            return;
        }

        const container = document.getElementById('recentActivity');

        if (!activities || activities.length === 0) {
            container.innerHTML = '<p class="empty-state">尚無活動記錄</p>';
            return;
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">💬</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title || '對話'}</div>
                    <div class="activity-time">${formatTimeAgo(new Date(activity.created_at))}</div>
                </div>
                <button class="btn-secondary btn-sm" onclick="viewConversationDetail('${activity.id}')">
                    查看
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('載入活動失敗:', error);
    }
}

// ==================== 用藥記錄 ====================

async function loadMedicationLogs() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/medication-logs/elder/${currentElderId}?days=30`
        );
        const result = await response.json();

        if (!result.success) {
            showToast('載入用藥記錄失敗', 'error');
            return;
        }

        renderMedicationLogs(result.data || []);
        loadMedicationStats();
    } catch (error) {
        console.error('載入用藥記錄失敗:', error);
        showToast('載入用藥記錄失敗', 'error');
    }
}

function renderMedicationLogs(logs) {
    const container = document.getElementById('medicationLogs');

    if (!logs || logs.length === 0) {
        container.innerHTML = '<p class="empty-state">尚無用藥記錄</p>';
        return;
    }

    container.innerHTML = logs.map(log => {
        const statusClass = {
            'taken': 'status-taken',
            'missed': 'status-missed',
            'late': 'status-late',
            'pending': 'status-pending'
        }[log.status] || '';

        const statusText = {
            'taken': '✓ 已服用',
            'missed': '✗ 已錯過',
            'late': '⚠ 遲服用',
            'pending': '⏳ 待服用'
        }[log.status] || log.status;

        return `
            <div class="medication-log-item">
                <div class="log-header">
                    <div class="log-medication">
                        <strong>${log.medication_name}</strong>
                        <span class="log-dosage">${log.dosage || ''}</span>
                    </div>
                    <span class="log-status ${statusClass}">${statusText}</span>
                </div>
                <div class="log-details">
                    <div class="log-time">
                        預定時間：${formatDateTime(log.scheduled_time)}
                    </div>
                    ${log.taken_at ? `
                        <div class="log-time">
                            實際服用：${formatDateTime(log.taken_at)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function loadMedicationStats() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/medication-logs/statistics/${currentElderId}?days=30`
        );
        const result = await response.json();

        if (!result.success || !result.data) return;

        const stats = result.data;
        const container = document.getElementById('medicationStats');

        container.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">總計</div>
                <div class="stat-value">${stats.totalLogs || 0}</div>
            </div>
            <div class="stat-item success">
                <div class="stat-label">已服用</div>
                <div class="stat-value">${stats.takenCount || 0}</div>
            </div>
            <div class="stat-item warning">
                <div class="stat-label">遲服用</div>
                <div class="stat-value">${stats.lateCount || 0}</div>
            </div>
            <div class="stat-item danger">
                <div class="stat-label">已錯過</div>
                <div class="stat-value">${stats.missedCount || 0}</div>
            </div>
            <div class="stat-item info">
                <div class="stat-label">遵從率</div>
                <div class="stat-value">${stats.adherenceRate || 0}%</div>
            </div>
        `;
    } catch (error) {
        console.error('載入用藥統計失敗:', error);
    }
}

function filterMedicationLogs(status) {
    // TODO: 實作篩選邏輯
    console.log('Filter by status:', status);
}

function filterByDate(date) {
    // TODO: 實作日期篩選
    console.log('Filter by date:', date);
}

// ==================== 對話記錄 ====================

async function loadConversations() {
    try {
        const { data: conversations, error } = await supabaseClient
            .from('conversations')
            .select('id, title, created_at, updated_at, message_count')
            .eq('user_id', currentElderId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('載入對話失敗:', error);
            showToast('載入對話記錄失敗', 'error');
            return;
        }

        renderConversations(conversations || []);
    } catch (error) {
        console.error('載入對話失敗:', error);
        showToast('載入對話記錄失敗', 'error');
    }
}

function renderConversations(conversations) {
    const container = document.getElementById('conversationsList');

    if (!conversations || conversations.length === 0) {
        container.innerHTML = '<p class="empty-state">尚無對話記錄</p>';
        return;
    }

    container.innerHTML = conversations.map(conv => `
        <div class="conversation-item" onclick="viewConversationDetail('${conv.id}')">
            <div class="conversation-icon">💬</div>
            <div class="conversation-content">
                <div class="conversation-title">${conv.title || '對話'}</div>
                <div class="conversation-meta">
                    <span>${formatDateTime(conv.created_at)}</span>
                    <span>${conv.message_count || 0} 則訊息</span>
                </div>
            </div>
            <button class="btn-secondary btn-sm">查看詳情</button>
        </div>
    `).join('');
}

async function viewConversationDetail(conversationId) {
    try {
        const { data: messages, error } = await supabaseClient
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('載入對話詳情失敗:', error);
            showToast('載入對話詳情失敗', 'error');
            return;
        }

        const container = document.getElementById('conversationDetail');
        container.innerHTML = messages.map(msg => `
            <div class="message ${msg.role}">
                <div class="message-header">
                    <strong>${msg.role === 'user' ? '長輩' : 'AI 助手'}</strong>
                    <span class="message-time">${formatDateTime(msg.created_at)}</span>
                </div>
                <div class="message-content">${msg.content}</div>
            </div>
        `).join('');

        document.getElementById('conversationModal').classList.add('show');
    } catch (error) {
        console.error('載入對話詳情失敗:', error);
        showToast('載入對話詳情失敗', 'error');
    }
}

function closeConversationModal() {
    document.getElementById('conversationModal').classList.remove('show');
}

function filterConversations(date) {
    // TODO: 實作日期篩選
    console.log('Filter conversations by date:', date);
}

// ==================== 警示系統 ====================

async function loadAlerts() {
    // TODO: 實作警示系統
    const container = document.getElementById('alertsList');
    container.innerHTML = '<p class="empty-state">功能開發中...</p>';
}

function filterAlerts(type) {
    // TODO: 實作警示篩選
    console.log('Filter alerts by type:', type);
}

function closeAlertModal() {
    document.getElementById('alertModal').classList.remove('show');
}

function markAlertAsResolved() {
    // TODO: 實作標記警示為已處理
    showToast('功能開發中', 'info');
}

// ==================== 工具函數 ====================

function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '剛剛';
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    if (diffHours < 24) return `${diffHours} 小時前`;
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-TW');
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showSettings() {
    // TODO: 實作設定功能
    showToast('功能開發中', 'info');
}
