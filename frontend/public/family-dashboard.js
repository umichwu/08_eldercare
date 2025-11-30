/**
 * 家屬監控面板 - 前端邏輯
 */

// API 基礎 URL - 從全域配置讀取 (config.js)
// 注意：API_BASE_URL 已在 config.js 中定義為全域變數，這裡不需要重新宣告

// Supabase 設定
const SUPABASE_URL = 'https://oatdjdelzybcacwqafkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGRqZGVsenliY2Fjd3FhZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM5ODUsImV4cCI6MjA3Njc3OTk4NX0.Flk-9yHREG7gWr1etG-TEc2ufPjP-zvW2Ejd2gCqG4w';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 全域變數
let currentUser = null;
let currentUserProfile = null; // ✅ 儲存使用者 profile
let currentFamilyMemberId = null;
let currentElderId = null;
let currentElderData = null; // ✅ 如果使用者是長輩，儲存長輩資料
let elders = [];
let adherenceChart = null;

// 快取資料用於篩選
let allMedicationLogs = [];
let allConversations = [];

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

        currentUserProfile = profile; // ✅ 儲存 profile

        // 檢查是否為家屬角色
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
        } else if (profile && profile.role === 'elder') {
            // ✅ 如果是長輩角色，載入長輩資料以便自我監控
            const { data: elder, error: elderError } = await supabaseClient
                .from('elders')
                .select('*')
                .eq('user_profile_id', profile.id)
                .single();

            if (!elderError && elder) {
                currentElderData = elder;
                currentElderId = elder.id; // ✅ 設定當前長輩 ID
                console.log('✅ 當前長輩 ID (自我監控):', currentElderId);
                showToast('歡迎！您可以監控自己的用藥狀況', 'success');
            } else {
                console.error('載入長輩資料失敗:', elderError);
                showToast('找不到長輩資料，請先完成個人資料設定', 'warning');
            }
        } else {
            // 其他角色或未設定角色，顯示警告但不立即跳轉
            showToast('建議使用家屬帳號訪問此頁面', 'warning');
            console.log('⚠️ 非家屬角色:', profile?.role);
            // 給使用者 5 秒時間查看，然後提示是否要跳轉
            setTimeout(() => {
                if (confirm('此功能主要供家屬使用。是否要返回主頁？')) {
                    window.location.href = 'index.html';
                }
            }, 3000);
        }
    } catch (error) {
        console.error('載入使用者失敗:', error);
        showToast('載入使用者資料失敗', 'error');
    }
}

// ==================== 長輩管理 ====================

async function loadElders() {
    try {
        elders = []; // 重置長輩列表

        // ✅ 情況 1：如果使用者是長輩，加入「自己」
        if (currentElderData) {
            elders.push({
                ...currentElderData,
                relationship: '本人', // 標記為自己
                isSelf: true // 標記這是自己
            });
            console.log('✅ 加入自我監控:', currentElderData.name);
        }

        // ✅ 情況 2：如果是家屬，查詢關聯的長輩
        if (currentFamilyMemberId) {
            const { data: relationships, error } = await supabaseClient
                .from('elder_family_relations')
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
                .eq('family_member_id', currentFamilyMemberId)
                .eq('status', 'active');

            if (error) {
                console.error('載入關聯長輩失敗:', error);
                showToast('載入長輩列表失敗', 'error');
            } else if (relationships && relationships.length > 0) {
                const relatedElders = relationships.map(rel => ({
                    ...rel.elders,
                    relationship: rel.relationship,
                    isSelf: false
                }));
                elders.push(...relatedElders);
                console.log(`✅ 加入 ${relationships.length} 位關聯長輩`);
            }
        }

        // ✅ 檢查是否有可監控的對象
        if (elders.length === 0) {
            showToast('沒有可監控的對象。請先設定個人資料或建立家屬關聯。', 'warning');
            renderElderSelector(); // 顯示空的選擇器
            return;
        }

        renderElderSelector();

        if (elders.length > 0) {
            currentElderId = elders[0].id;
            await loadDashboardData();
        }
        // ✅ 如果沒有長輩，訊息已在前面顯示，這裡不需要重複
    } catch (error) {
        console.error('載入長輩失敗:', error);
        showToast('載入長輩列表失敗', 'error');
    }
}

function renderElderSelector() {
    const select = document.getElementById('elderSelect');

    if (elders.length === 0) {
        select.innerHTML = '<option value="">請先完成個人資料設定</option>';
        return;
    }

    select.innerHTML = elders.map(elder => `
        <option value="${elder.id}">
            ${elder.isSelf ? '👤 ' : ''}${elder.name}（${elder.relationship}）${elder.nickname ? ' - ' + elder.nickname : ''}
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
    } else if (tabName === 'geolocation') {
        loadGeolocationTab();
        loadLocationHistoryPreview();
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
        console.log(`🔍 載入今日指標 - Elder ID: ${currentElderId}`);

        if (!currentElderId) {
            console.warn('⚠️ Elder ID 未設定，跳過載入指標');
            document.getElementById('todayAdherence').textContent = '-';
            document.getElementById('adherenceTrend').innerHTML = '<span class="trend-bad">- 請選擇長輩</span>';
            return;
        }

        const adherenceResponse = await fetch(
            `${API_BASE_URL}/api/medication-logs/statistics/${currentElderId}?days=1`
        );

        if (!adherenceResponse.ok) {
            console.error(`❌ 用藥統計 API 錯誤: ${adherenceResponse.status} ${adherenceResponse.statusText}`);
            const errorText = await adherenceResponse.text();
            console.error('錯誤詳情:', errorText);
            document.getElementById('todayAdherence').textContent = '錯誤';
            document.getElementById('adherenceTrend').innerHTML = '<span class="trend-bad">- 載入失敗</span>';
            return;
        }

        const adherenceData = await adherenceResponse.json();
        console.log('📊 今日用藥統計:', adherenceData);

        // 後端返回格式: { message: "查詢成功", data: {...} } 或 { success: true, data: {...} }
        if (adherenceData.data || (adherenceData.success && adherenceData.data)) {
            const rate = adherenceData.data.adherenceRate || 0;
            document.getElementById('todayAdherence').textContent = `${rate}%`;

            const trend = rate >= 80 ? '✓ 良好' : rate >= 60 ? '⚠ 注意' : '✗ 不佳';
            const trendClass = rate >= 80 ? 'trend-good' : rate >= 60 ? 'trend-warning' : 'trend-bad';
            document.getElementById('adherenceTrend').innerHTML = `<span class="${trendClass}">${trend}</span>`;
        } else {
            console.warn('⚠️ 用藥統計 API 未返回資料');
            document.getElementById('todayAdherence').textContent = '0%';
            document.getElementById('adherenceTrend').innerHTML = '<span class="trend-bad">- 無資料</span>';
        }

        // 今日對話次數
        const { data: conversations, error: convError } = await supabaseClient
            .from('conversations')
            .select('id')
            .eq('elder_id', currentElderId)
            .gte('created_at', today + 'T00:00:00');

        if (convError) {
            console.error('載入對話次數失敗:', convError);
            document.getElementById('todayConversations').textContent = '錯誤';
            document.getElementById('conversationsTrend').textContent = '- 載入失敗';
        } else {
            document.getElementById('todayConversations').textContent = conversations?.length || 0;
            const trend = (conversations?.length || 0) > 0 ? '✓ 活躍' : '- 無活動';
            document.getElementById('conversationsTrend').textContent = trend;
        }

        // 最後活動時間
        const { data: lastConvData, error: lastConvError } = await supabaseClient
            .from('conversations')
            .select('updated_at')
            .eq('elder_id', currentElderId)
            .order('updated_at', { ascending: false })
            .limit(1);

        if (lastConvError) {
            console.warn('載入最後活動時間失敗:', lastConvError.message);
            document.getElementById('lastActivity').textContent = '無記錄';
            document.getElementById('activityStatus').innerHTML = '<span class="trend-bad">- 無活動</span>';
        } else if (lastConvData && lastConvData.length > 0) {
            const lastConv = lastConvData[0];
            const lastTime = new Date(lastConv.updated_at);
            const now = new Date();
            const diffHours = Math.floor((now - lastTime) / (1000 * 60 * 60));

            document.getElementById('lastActivity').textContent = formatTimeAgo(lastTime);

            const status = diffHours < 6 ? '✓ 正常' : diffHours < 24 ? '⚠ 注意' : '✗ 異常';
            const statusClass = diffHours < 6 ? 'trend-good' : diffHours < 24 ? 'trend-warning' : 'trend-bad';
            document.getElementById('activityStatus').innerHTML = `<span class="${statusClass}">${status}</span>`;
        } else {
            document.getElementById('lastActivity').textContent = '無記錄';
            document.getElementById('activityStatus').innerHTML = '<span class="trend-bad">- 無活動</span>';
        }

        // 待處理警示
        await loadAlertStatistics();

    } catch (error) {
        console.error('載入今日指標失敗:', error);
    }
}

async function loadAdherenceTrend() {
    try {
        console.log(`🔍 開始載入用藥趨勢 - Elder ID: ${currentElderId}`);

        const response = await fetch(
            `${API_BASE_URL}/api/medication-logs/statistics/${currentElderId}?days=7`
        );

        if (!response.ok) {
            console.error(`❌ API 錯誤: ${response.status} ${response.statusText}`);
            renderEmptyChart('載入失敗');
            return;
        }

        const result = await response.json();
        console.log('📊 API 返回結果:', result);

        if (!result.data) {
            console.warn('⚠️ API 沒有返回 data');
            renderEmptyChart('無數據');
            return;
        }

        if (!result.data.dailyStats) {
            console.warn('⚠️ API 沒有返回 dailyStats');
            renderEmptyChart('無每日統計數據');
            return;
        }

        const stats = result.data;
        const labels = [];
        const data = [];

        // ✅ 使用真實的每日統計數據
        if (stats.dailyStats.length === 0) {
            console.warn('⚠️ dailyStats 是空陣列');
            renderEmptyChart('最近 7 天無用藥記錄');
            return;
        }

        stats.dailyStats.forEach(dayStat => {
            const date = new Date(dayStat.date);
            labels.push(date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }));
            data.push(dayStat.adherenceRate);
        });

        console.log('📊 用藥趨勢圖數據:', { labels, data });

        renderAdherenceChart(labels, data);
    } catch (error) {
        console.error('❌ 載入遵從趨勢失敗:', error);
        renderEmptyChart('載入失敗');
    }
}

function renderEmptyChart(message) {
    const labels = [];
    const data = [];

    // 生成最近 7 天的標籤，但數據為 0
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }));
        data.push(0);
    }

    renderAdherenceChart(labels, data);

    // 在圖表上方顯示提示訊息
    const chartCard = document.querySelector('.chart-card');
    if (chartCard) {
        let messageDiv = chartCard.querySelector('.chart-message');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.className = 'chart-message';
            messageDiv.style.cssText = 'text-align: center; color: #999; padding: 10px; background: #f5f5f5; border-radius: 8px; margin-bottom: 15px;';
            const h3 = chartCard.querySelector('h3');
            h3.insertAdjacentElement('afterend', messageDiv);
        }
        messageDiv.textContent = `📊 ${message}`;
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
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#4caf50',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#66bb6a',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(76, 175, 80, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    borderColor: '#4caf50',
                    borderWidth: 2,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        },
                        color: '#4caf50',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(76, 175, 80, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#4caf50'
                    },
                    grid: {
                        color: 'rgba(76, 175, 80, 0.1)'
                    }
                }
            }
        }
    });
}

async function loadRecentActivity() {
    if (!currentElderId) {
        const container = document.getElementById('recentActivity');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>請先選擇長輩</p>
                </div>
            `;
        }
        return;
    }

    try {
        const { data: activities, error } = await supabaseClient
            .from('conversations')
            .select('id, title, created_at, updated_at')
            .eq('elder_id', currentElderId)
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
    if (!currentElderId) {
        const container = document.getElementById('medicationLogs');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>請先選擇長輩</p>
                </div>
            `;
        }
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/medication-logs/elder/${currentElderId}?days=30`
        );
        const result = await response.json();

        if (!result.data && !result.success) {
            showToast('載入用藥記錄失敗', 'error');
            return;
        }

        // 儲存所有記錄供篩選使用
        allMedicationLogs = result.data || [];
        renderMedicationLogs(allMedicationLogs);
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

    // ✅ 排序：時間由小到大
    const sortedLogs = [...logs].sort((a, b) => {
        return new Date(a.scheduled_time) - new Date(b.scheduled_time);
    });

    container.innerHTML = sortedLogs.map(log => {
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

        if (!result.data) return;

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
    // 套用狀態和日期篩選
    applyMedicationFilters();
}

function filterByDate(date) {
    // 套用狀態和日期篩選
    applyMedicationFilters();
}

function applyMedicationFilters() {
    const statusFilter = document.getElementById('medicationFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;

    let filteredLogs = [...allMedicationLogs];

    // 狀態篩選
    if (statusFilter && statusFilter !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.status === statusFilter);
    }

    // 日期篩選
    if (dateFilter) {
        filteredLogs = filteredLogs.filter(log => {
            const logDate = new Date(log.scheduled_time).toISOString().split('T')[0];
            return logDate === dateFilter;
        });
    }

    // 渲染篩選後的結果
    renderMedicationLogs(filteredLogs);

    // 顯示篩選提示
    if (filteredLogs.length === 0) {
        const container = document.getElementById('medicationLogs');
        container.innerHTML = '<p class="empty-state">沒有符合條件的用藥記錄</p>';
    }
}

// ==================== 對話記錄 ====================

async function loadConversations() {
    if (!currentElderId) {
        const container = document.getElementById('conversationsList');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>請先選擇長輩</p>
                </div>
            `;
        }
        return;
    }

    try {
        // 先嘗試載入對話資料，使用基本欄位
        const { data: conversations, error } = await supabaseClient
            .from('conversations')
            .select('id, title, created_at, updated_at')
            .eq('elder_id', currentElderId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('載入對話失敗:', error);

            // 顯示友善的錯誤訊息
            const container = document.getElementById('conversationsList');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p style="color: #f44336;">載入對話記錄失敗</p>
                        <p style="font-size: 14px; color: #999; margin-top: 10px;">
                            ${error.message || '資料庫連線錯誤'}
                        </p>
                    </div>
                `;
            }
            return;
        }

        // 儲存所有對話供篩選使用
        allConversations = conversations || [];
        renderConversations(allConversations);
    } catch (error) {
        console.error('載入對話失敗:', error);

        const container = document.getElementById('conversationsList');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p style="color: #f44336;">載入對話記錄失敗</p>
                    <p style="font-size: 14px; color: #999; margin-top: 10px;">請稍後再試</p>
                </div>
            `;
        }
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
                    <span>建立時間：${formatDateTime(conv.created_at)}</span>
                    ${conv.updated_at && conv.updated_at !== conv.created_at ?
                        `<span>最後更新：${formatDateTime(conv.updated_at)}</span>` :
                        ''
                    }
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
    // 套用日期篩選
    applyConversationFilters();
}

function applyConversationFilters() {
    const dateFilter = document.getElementById('conversationDateFilter').value;

    let filteredConversations = [...allConversations];

    // 日期篩選
    if (dateFilter) {
        filteredConversations = filteredConversations.filter(conv => {
            const convDate = new Date(conv.created_at).toISOString().split('T')[0];
            return convDate === dateFilter;
        });
    }

    // 渲染篩選後的結果
    renderConversations(filteredConversations);

    // 顯示篩選提示
    if (filteredConversations.length === 0) {
        const container = document.getElementById('conversationsList');
        container.innerHTML = '<p class="empty-state">沒有符合條件的對話記錄</p>';
    }
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

// ==================== Android App 下載 ====================

function downloadAndroidApp() {
    // 使用固定檔名下載最新版本的 APK
    const apkUrl = '/downloads/eldercare-v1.1.0-20251126.apk';

    // 創建隱藏的下載連結
    const link = document.createElement('a');
    link.href = apkUrl;
    link.download = 'ElderCare.apk'; // 固定的下載檔名
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ 開始下載 Android App');
    showToast('開始下載 ElderCare App...', 'success');
}

// ==================== 設定功能 ====================

async function showSettings() {
    document.getElementById('settingsModal').classList.add('show');
    await loadLinkedElders();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('show');
}

async function loadLinkedElders() {
    if (!currentFamilyMemberId) {
        document.getElementById('linkedEldersList').innerHTML = `
            <div class="empty-state">
                <p>⚠️ 尚未建立家屬資料</p>
            </div>
        `;
        return;
    }

    try {
        const { data: relations, error } = await supabaseClient
            .from('elder_family_relations')
            .select(`
                id,
                relationship,
                status,
                elders (
                    id,
                    name,
                    nickname,
                    age
                )
            `)
            .eq('family_member_id', currentFamilyMemberId);

        if (error) {
            console.error('載入關聯失敗:', error);
            showToast('載入關聯失敗', 'error');
            return;
        }

        if (!relations || relations.length === 0) {
            document.getElementById('linkedEldersList').innerHTML = `
                <div class="empty-state">
                    <p>📝 尚未關聯任何長輩</p>
                    <p class="help-text">請點擊下方「新增長輩關聯」按鈕開始設定</p>
                </div>
            `;
            return;
        }

        document.getElementById('linkedEldersList').innerHTML = relations.map(rel => `
            <div class="linked-elder-item">
                <div class="elder-info">
                    <div class="elder-avatar">${rel.elders.name.charAt(0)}</div>
                    <div class="elder-details">
                        <h4>${rel.elders.name}${rel.elders.nickname ? ` (${rel.elders.nickname})` : ''}</h4>
                        <p class="relationship-tag">${rel.relationship}</p>
                        <p class="age-info">${rel.elders.age ? `${rel.elders.age} 歲` : ''}</p>
                    </div>
                </div>
                <div class="elder-actions">
                    <span class="status-badge ${rel.status === 'active' ? 'status-active' : 'status-inactive'}">
                        ${rel.status === 'active' ? '✓ 啟用中' : '暫停'}
                    </span>
                    ${rel.status === 'active' ? `
                        <button class="btn-small btn-secondary" onclick="toggleRelationStatus('${rel.id}', 'inactive')">
                            暫停監控
                        </button>
                    ` : `
                        <button class="btn-small btn-primary" onclick="toggleRelationStatus('${rel.id}', 'active')">
                            恢復監控
                        </button>
                    `}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('載入關聯失敗:', error);
        showToast('載入關聯失敗', 'error');
    }
}

async function showLinkElderForm() {
    document.getElementById('linkElderModal').classList.add('show');
    await loadAvailableElders();
}

function closeLinkElderModal() {
    document.getElementById('linkElderModal').classList.remove('show');
}

async function loadAvailableElders() {
    try {
        // 載入所有長輩
        const { data: allElders, error } = await supabaseClient
            .from('elders')
            .select('id, name, nickname')
            .order('name');

        if (error) {
            console.error('載入長輩列表失敗:', error);
            return;
        }

        const select = document.getElementById('elderSelectForLink');
        if (!allElders || allElders.length === 0) {
            select.innerHTML = '<option value="">系統中沒有長輩帳號</option>';
            return;
        }

        select.innerHTML = `
            <option value="">請選擇長輩</option>
            ${allElders.map(elder => `
                <option value="${elder.id}">
                    ${elder.name}${elder.nickname ? ` (${elder.nickname})` : ''}
                </option>
            `).join('')}
        `;
    } catch (error) {
        console.error('載入長輩列表失敗:', error);
    }
}

async function submitLinkElder(event) {
    event.preventDefault();

    const elderId = document.getElementById('elderSelectForLink').value;
    const relationship = document.getElementById('relationshipType').value;

    if (!elderId || !relationship) {
        showToast('請填寫完整資料', 'warning');
        return;
    }

    if (!currentFamilyMemberId) {
        showToast('找不到家屬資料，請重新登入', 'error');
        return;
    }

    try {
        // 檢查是否已經關聯
        const { data: existing } = await supabaseClient
            .from('elder_family_relations')
            .select('id')
            .eq('family_member_id', currentFamilyMemberId)
            .eq('elder_id', elderId)
            .single();

        if (existing) {
            showToast('已經關聯過此長輩', 'warning');
            return;
        }

        // 建立關聯
        const { data, error } = await supabaseClient
            .from('elder_family_relations')
            .insert([{
                family_member_id: currentFamilyMemberId,
                elder_id: elderId,
                relationship: relationship,
                status: 'active',
                can_receive_alerts: true
            }])
            .select();

        if (error) {
            console.error('建立關聯失敗:', error);
            showToast('建立關聯失敗：' + error.message, 'error');
            return;
        }

        showToast('✅ 成功關聯長輩', 'success');
        closeLinkElderModal();
        await loadLinkedElders();
        await loadElders(); // 重新載入主選單
    } catch (error) {
        console.error('建立關聯失敗:', error);
        showToast('建立關聯失敗', 'error');
    }
}

async function toggleRelationStatus(relationId, newStatus) {
    try {
        const { error } = await supabaseClient
            .from('elder_family_relations')
            .update({ status: newStatus })
            .eq('id', relationId);

        if (error) {
            showToast('更新失敗', 'error');
            return;
        }

        showToast(newStatus === 'active' ? '✅ 已恢復監控' : '⏸️ 已暫停監控', 'success');
        await loadLinkedElders();
        await loadElders();
    } catch (error) {
        console.error('更新狀態失敗:', error);
        showToast('更新失敗', 'error');
    }
}

// ==================== 地理位置功能 ====================

let locationMap = null;
let elderLocationMarker = null;
let safeZoneCircles = [];

async function loadGeolocationTab() {
    if (!currentElderId) {
        // 清空所有容器，顯示提示訊息
        const containers = ['currentLocation', 'safeZonesList', 'geofenceAlertsList', 'locationHistoryList'];
        containers.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = `
                    <div class="empty-state">
                        <p>請先選擇長輩</p>
                    </div>
                `;
            }
        });
        return;
    }

    // ✅ 檢查是否安裝 Android App，顯示引導
    checkAndPromptAppForLocation();

    // 初始化地圖
    if (!locationMap) {
        initLocationMap();
    }

    // 載入資料
    try {
        await Promise.all([
            loadCurrentLocation(),
            loadSafeZonesPreview(),
            loadGeofenceAlertsPreview()
        ]);
    } catch (error) {
        console.error('載入地理位置資料錯誤:', error);
    }
}

function initLocationMap() {
    const mapContainer = document.getElementById('locationMap');
    if (!mapContainer) return;

    // 初始化 Leaflet 地圖（台灣中心）
    locationMap = L.map('locationMap').setView([23.6978, 120.9605], 8);

    // 加入 OpenStreetMap 圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(locationMap);
}

async function loadCurrentLocation() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/location/latest/${currentElderId}`);
        const result = await response.json();

        const locationContainer = document.getElementById('currentLocation');

        if (result.success && result.location) {
            const loc = result.location;

            locationContainer.innerHTML = `
                <div class="location-info" style="background: #e8f5e9; padding: 20px; border-radius: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #c8e6c9;">
                        <span style="color: #2e7d32; font-weight: 500;">📍 位置</span>
                        <span style="color: #666;">${loc.address || '未知地址'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #c8e6c9;">
                        <span style="color: #2e7d32; font-weight: 500;">🕐 時間</span>
                        <span style="color: #666;">${formatTimeAgo(new Date(loc.recorded_at))}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #2e7d32; font-weight: 500;">📐 座標</span>
                        <span style="color: #666; font-size: 13px;">${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}</span>
                    </div>
                    ${loc.battery_level ? `
                    <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 2px solid #c8e6c9;">
                        <span style="color: #2e7d32; font-weight: 500;">🔋 電量</span>
                        <span style="color: ${loc.battery_level < 20 ? '#f44336' : '#666'}; font-weight: ${loc.battery_level < 20 ? 'bold' : 'normal'};">
                            ${loc.battery_level}%
                        </span>
                    </div>
                    ` : ''}
                </div>
            `;

            // 在地圖上標記位置
            if (locationMap) {
                if (elderLocationMarker) {
                    locationMap.removeLayer(elderLocationMarker);
                }

                elderLocationMarker = L.marker([loc.latitude, loc.longitude], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                }).addTo(locationMap);

                elderLocationMarker.bindPopup(`
                    <strong>📍 長輩位置</strong><br>
                    ${loc.address || '未知地址'}<br>
                    <small>${formatTimeAgo(new Date(loc.recorded_at))}</small>
                `);

                locationMap.setView([loc.latitude, loc.longitude], 15);
            }

        } else {
            locationContainer.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 48px; margin-bottom: 15px;">📍</div>
                    <p>尚無位置記錄</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('載入位置錯誤:', error);
        document.getElementById('currentLocation').innerHTML = `
            <div class="empty-state">
                <p style="color: #f44336;">載入失敗</p>
            </div>
        `;
    }
}

async function loadSafeZonesPreview() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/safe-zones/elder/${currentElderId}`);
        const result = await response.json();

        const safeZonesList = document.getElementById('safeZonesList');

        if (result.success && result.safe_zones.length > 0) {
            // 清除舊的圓圈
            safeZoneCircles.forEach(circle => {
                if (locationMap) locationMap.removeLayer(circle);
            });
            safeZoneCircles = [];

            // 顯示前 3 個安全區域
            const preview = result.safe_zones.slice(0, 3);

            safeZonesList.innerHTML = `
                ${preview.map(zone => `
                    <div style="background: linear-gradient(145deg, #ffffff 0%, #f1f8f4 100%); border-left: 5px solid #4caf50; padding: 15px; border-radius: 12px; margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 16px; font-weight: 600; color: #2e7d32;">🛡️ ${zone.name}</span>
                            <span style="padding: 4px 12px; background: ${zone.is_active ? '#c8e6c9' : '#ffcdd2'}; color: ${zone.is_active ? '#2e7d32' : '#c62828'}; border-radius: 12px; font-size: 12px; font-weight: 500;">
                                ${zone.is_active ? '✓ 啟用' : '✗ 停用'}
                            </span>
                        </div>
                        <div style="color: #666; font-size: 14px;">
                            📍 半徑 ${zone.radius_meters}m &nbsp;|&nbsp; 🚨 ${zone.alert_on_exit ? '離開警示' : ''} ${zone.alert_on_enter ? '進入通知' : ''}
                        </div>
                    </div>
                `).join('')}
                ${result.safe_zones.length > 3 ? `
                    <div style="text-align: center; margin-top: 15px;">
                        <span style="color: #999; font-size: 14px;">還有 ${result.safe_zones.length - 3} 個安全區域</span>
                    </div>
                ` : ''}
                <button class="btn btn-primary" onclick="window.location.href='geolocation.html'" style="width: 100%; margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
                    ⚙️ 管理所有安全區域
                </button>
            `;

            // 在地圖上繪製安全區域
            if (locationMap) {
                result.safe_zones.forEach(zone => {
                    const circle = L.circle([zone.center_latitude, zone.center_longitude], {
                        radius: zone.radius_meters,
                        color: zone.is_active ? '#4caf50' : '#999',
                        fillColor: zone.is_active ? '#4caf50' : '#999',
                        fillOpacity: 0.15,
                        weight: 2
                    }).addTo(locationMap);

                    circle.bindPopup(`<strong>🛡️ ${zone.name}</strong><br>半徑：${zone.radius_meters}m`);
                    safeZoneCircles.push(circle);
                });
            }

        } else {
            safeZonesList.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 48px; margin-bottom: 15px;">🛡️</div>
                    <p>尚未設定安全區域</p>
                    <button class="btn btn-primary" onclick="window.location.href='geolocation.html'" style="margin-top: 15px; padding: 12px 24px; background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
                        ➕ 新增安全區域
                    </button>
                </div>
            `;
        }

    } catch (error) {
        console.error('載入安全區域錯誤:', error);
    }
}

async function loadGeofenceAlertsPreview() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/alerts/elder/${currentElderId}`);
        const result = await response.json();

        const alertsList = document.getElementById('geofenceAlertsList');

        if (result.success && result.alerts.length > 0) {
            // 只顯示最近 5 個警示
            const recentAlerts = result.alerts.slice(0, 5);

            alertsList.innerHTML = `
                ${recentAlerts.map(alert => {
                    const typeColor = {
                        'exit': '#f44336',
                        'enter': '#4caf50',
                        'sos': '#d32f2f',
                        'low_battery': '#ff9800',
                        'inactive': '#9e9e9e'
                    };

                    const typeIcon = {
                        'exit': '🚨',
                        'enter': '✅',
                        'sos': '🆘',
                        'low_battery': '🔋',
                        'inactive': '⏰'
                    };

                    const typeName = {
                        'exit': '離開安全區域',
                        'enter': '進入安全區域',
                        'sos': '緊急求助',
                        'low_battery': '低電量',
                        'inactive': '無活動'
                    };

                    return `
                        <div style="background: white; border-left: 5px solid ${typeColor[alert.alert_type]}; padding: 15px; border-radius: 8px; margin-bottom: 12px; ${alert.status !== 'pending' ? 'opacity: 0.6;' : ''}">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="font-weight: 600; font-size: 15px;">
                                    ${typeIcon[alert.alert_type]} ${typeName[alert.alert_type]}
                                </span>
                                <span style="color: #999; font-size: 12px;">${formatTimeAgo(new Date(alert.created_at))}</span>
                            </div>
                            <div style="color: #666; font-size: 14px;">
                                ${alert.safe_zone_name ? `📍 ${alert.safe_zone_name}` : ''}
                                ${alert.address ? `<br>🗺️ ${alert.address}` : ''}
                            </div>
                            ${alert.status !== 'pending' ? `
                                <div style="margin-top: 8px; color: #4caf50; font-size: 13px;">
                                    ✓ ${alert.status === 'acknowledged' ? '已知悉' : '已處理'}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
                ${result.alerts.length > 5 ? `
                    <div style="text-align: center; margin-top: 15px;">
                        <span style="color: #999; font-size: 14px;">還有 ${result.alerts.length - 5} 個警示</span>
                    </div>
                ` : ''}
            `;

        } else {
            alertsList.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
                    <p>目前無警示記錄</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('載入警示錯誤:', error);
    }
}

async function loadLocationHistoryPreview() {
    if (!currentElderId) {
        const historyList = document.getElementById('locationHistoryList');
        if (historyList) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <p>請先選擇長輩</p>
                </div>
            `;
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/location/elder/${currentElderId}?hours=24`);
        const result = await response.json();

        const historyList = document.getElementById('locationHistoryList');

        if (result.success && result.history.length > 0) {
            // 只顯示最近 10 筆
            const recent = result.history.slice(0, 10);

            historyList.innerHTML = `
                <div style="max-height: 400px; overflow-y: auto;">
                    ${recent.map(loc => `
                        <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #4caf50;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="font-weight: 500; color: #2e7d32;">📍 ${loc.address || '未知地址'}</span>
                                <span style="color: #999; font-size: 12px;">${formatTimeAgo(new Date(loc.recorded_at))}</span>
                            </div>
                            <div style="color: #666; font-size: 13px;">
                                📐 ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

        } else {
            historyList.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 48px; margin-bottom: 15px;">📜</div>
                    <p>最近 24 小時無位置記錄</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('載入位置歷史錯誤:', error);
    }
}

async function refreshLocation() {
    if (!currentElderId) {
        showToast('請先選擇長輩', 'warning');
        return;
    }

    showToast('正在更新位置...', 'info');
    await loadGeolocationTab();
    showToast('位置已更新', 'success');
}

/**
 * 手動記錄當前位置（使用瀏覽器地理位置 API）
 */
async function recordCurrentLocation() {
    if (!currentElderId) {
        showToast('請先選擇長輩', 'warning');
        return;
    }

    // 檢查瀏覽器是否支援地理位置 API
    if (!('geolocation' in navigator)) {
        showToast('您的瀏覽器不支援地理位置功能', 'error');
        return;
    }

    showToast('正在取得位置...', 'info');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude, accuracy, altitude, speed, heading } = position.coords;

                console.log('📍 瀏覽器地理位置:', { latitude, longitude, accuracy });

                // 上傳到後端
                const response = await fetch(`${API_BASE_URL}/api/geolocation/location`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        elder_id: currentElderId,
                        latitude,
                        longitude,
                        accuracy: accuracy || null,
                        altitude: altitude || null,
                        speed: speed || null,
                        heading: heading || null,
                        is_manual: true
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '記錄位置失敗');
                }

                const result = await response.json();
                console.log('✅ 位置記錄成功:', result);

                showToast('位置記錄成功！', 'success');

                // 重新載入位置資訊
                await loadGeolocationTab();

                // 顯示成功訊息
                if (result.alerts_triggered && result.alerts_triggered.length > 0) {
                    const alertTypes = result.alerts_triggered.map(a => a.alert_type).join(', ');
                    showToast(`⚠️ 觸發警示: ${alertTypes}`, 'warning');
                }

            } catch (error) {
                console.error('❌ 記錄位置失敗:', error);
                showToast(`記錄位置失敗: ${error.message}`, 'error');
            }
        },
        (error) => {
            console.error('❌ 取得位置失敗:', error);

            let message = '取得位置失敗';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = '您拒絕了位置權限請求。請在瀏覽器設定中允許位置存取。';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = '無法取得位置資訊。請確認您的裝置支援定位功能。';
                    break;
                case error.TIMEOUT:
                    message = '取得位置逾時。請檢查網路連線並重試。';
                    break;
            }

            showToast(message, 'error');
        },
        {
            enableHighAccuracy: true,  // 要求高精確度（可能會使用 GPS）
            timeout: 15000,            // 15秒超時
            maximumAge: 0              // 不使用快取位置
        }
    );
}

// ==================== Android App 整合 ====================

/**
 * 檢查並提示下載 Android App（位置追蹤功能）
 */
function checkAndPromptAppForLocation() {
    // 檢查是否已安裝 Android App
    if (typeof appDetection === 'undefined' || appDetection.appInstalled) {
        return; // 已安裝或模組未載入
    }

    // 檢查是否已經顯示過提示（避免重複）
    if (sessionStorage.getItem('location_app_prompt_shown') === 'true') {
        return;
    }

    // 標記已顯示
    sessionStorage.setItem('location_app_prompt_shown', 'true');

    // 延遲 1 秒後顯示提示（等待頁面載入完成）
    setTimeout(() => {
        appDetection.showDownloadBanner('位置追蹤需要 Android App 才能在背景運行');
    }, 1000);
}

console.log('✅ 家屬監控面板 - Android App 整合模組已載入');

// ==================== 今日用藥詳情功能 ====================

/**
 * 顯示今日用藥詳情 Modal
 */
async function showTodayMedicationDetail() {
    if (!currentElderId) {
        showToast('請先選擇長輩', 'warning');
        return;
    }

    // 打開 Modal
    document.getElementById('todayMedicationModal').classList.add('show');

    // 顯示載入狀態
    const container = document.getElementById('todayMedicationDetail');
    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>載入今日用藥記錄...</p>
        </div>
    `;

    try {
        const today = new Date().toISOString().split('T')[0];
        const todayStart = new Date(today + 'T00:00:00').getTime();
        const todayEnd = new Date(today + 'T23:59:59').getTime();

        // 查詢今日用藥記錄
        const response = await fetch(
            `${API_BASE_URL}/api/medication-logs/elder/${currentElderId}?days=1`
        );

        if (!response.ok) {
            throw new Error('查詢失敗');
        }

        const result = await response.json();
        const allLogs = result.data || [];

        // ✅ 過濾：只保留今天的記錄
        const logs = allLogs.filter(log => {
            const logTime = new Date(log.scheduled_time).getTime();
            return logTime >= todayStart && logTime <= todayEnd;
        });

        console.log('📊 API 返回記錄數:', allLogs.length);
        console.log('📊 今日用藥記錄數:', logs.length);
        console.log('📊 今日用藥記錄:', logs);

        // 統計資料
        const stats = {
            total: logs.length,
            taken: logs.filter(log => log.status === 'taken').length,
            late: logs.filter(log => log.status === 'late').length,
            missed: logs.filter(log => log.status === 'missed').length,
            pending: logs.filter(log => log.status === 'pending').length
        };

        const adherenceRate = stats.total > 0
            ? Math.round((stats.taken + stats.late) / stats.total * 100)
            : 0;

        if (logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
                    <p style="font-size: 18px; color: #666;">今日無用藥記錄</p>
                </div>
            `;
            return;
        }

        // 渲染詳細資訊
        container.innerHTML = `
            <!-- 統計卡片 -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); color: white; padding: 15px; border-radius: 12px; text-align: center; box-shadow: 0 2px 10px rgba(76, 175, 80, 0.3);">
                    <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${adherenceRate}%</div>
                    <div style="font-size: 14px; opacity: 0.9;">遵從率</div>
                </div>
                <div style="background: linear-gradient(135deg, #2196f3 0%, #42a5f5 100%); color: white; padding: 15px; border-radius: 12px; text-align: center; box-shadow: 0 2px 10px rgba(33, 150, 243, 0.3);">
                    <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${stats.total}</div>
                    <div style="font-size: 14px; opacity: 0.9;">總計</div>
                </div>
                <div style="background: linear-gradient(135deg, #66bb6a 0%, #81c784 100%); color: white; padding: 15px; border-radius: 12px; text-align: center; box-shadow: 0 2px 10px rgba(102, 187, 106, 0.3);">
                    <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${stats.taken}</div>
                    <div style="font-size: 14px; opacity: 0.9;">已服用</div>
                </div>
                <div style="background: linear-gradient(135deg, #f44336 0%, #ef5350 100%); color: white; padding: 15px; border-radius: 12px; text-align: center; box-shadow: 0 2px 10px rgba(244, 67, 54, 0.3);">
                    <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${stats.missed}</div>
                    <div style="font-size: 14px; opacity: 0.9;">已錯過</div>
                </div>
            </div>

            <!-- 用藥清單 -->
            <div style="background: white; border-radius: 15px; padding: 20px; box-shadow: 0 2px 15px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 20px 0; color: #4caf50; font-size: 18px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px;">
                    📋 用藥明細
                </h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${logs.map((log, index) => {
                        const statusConfig = {
                            'taken': {
                                icon: '✅',
                                text: '已服用',
                                color: '#4caf50',
                                bgColor: '#e8f5e9'
                            },
                            'late': {
                                icon: '⏰',
                                text: '遲服用',
                                color: '#ff9800',
                                bgColor: '#fff3e0'
                            },
                            'missed': {
                                icon: '❌',
                                text: '已錯過',
                                color: '#f44336',
                                bgColor: '#ffebee'
                            },
                            'pending': {
                                icon: '⏳',
                                text: '待服用',
                                color: '#2196f3',
                                bgColor: '#e3f2fd'
                            },
                            'skipped': {
                                icon: '⊘',
                                text: '已跳過',
                                color: '#9e9e9e',
                                bgColor: '#f5f5f5'
                            }
                        };

                        const config = statusConfig[log.status] || statusConfig['pending'];
                        const scheduledTime = new Date(log.scheduled_time);
                        const timeStr = scheduledTime.toLocaleTimeString('zh-TW', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        return `
                            <div style="border: 2px solid ${config.color}; border-radius: 12px; padding: 15px; background: ${config.bgColor}; transition: all 0.3s ease;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                                    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                                        <div style="font-size: 24px;">${config.icon}</div>
                                        <div style="flex: 1;">
                                            <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">
                                                ${log.medication_name}
                                            </div>
                                            <div style="font-size: 13px; color: #666;">
                                                ${log.dosage || ''}
                                                ${log.dose_label ? `<span style="margin-left: 8px; padding: 2px 8px; background: rgba(76, 175, 80, 0.15); border-radius: 4px; font-size: 11px;">${log.dose_label}</span>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="background: ${config.color}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 5px;">
                                            ${config.text}
                                        </div>
                                        <div style="font-size: 13px; color: #666;">
                                            ⏰ ${timeStr}
                                        </div>
                                    </div>
                                </div>
                                ${log.actual_time ? `
                                    <div style="border-top: 1px solid ${config.color}; padding-top: 10px; margin-top: 10px;">
                                        <div style="font-size: 13px; color: #666;">
                                            實際服用時間：${new Date(log.actual_time).toLocaleString('zh-TW', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                ` : ''}
                                ${log.notes ? `
                                    <div style="border-top: 1px solid ${config.color}; padding-top: 10px; margin-top: 10px;">
                                        <div style="font-size: 13px; color: #666;">
                                            備註：${log.notes}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('載入今日用藥詳情失敗:', error);
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 15px; color: #f44336;">⚠️</div>
                <p style="font-size: 18px; color: #f44336;">載入失敗</p>
                <p style="font-size: 14px; color: #999; margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
}

/**
 * 關閉今日用藥詳情 Modal
 */
function closeTodayMedicationModal() {
    document.getElementById('todayMedicationModal').classList.remove('show');
}

// ============================================================================
// 警示系統功能
// ============================================================================

/**
 * 載入警示統計（顯示在總覽頁面）
 */
async function loadAlertStatistics() {
    try {
        if (!currentElderId) {
            document.getElementById('pendingAlerts').textContent = '-';
            document.getElementById('alertsTrend').innerHTML = '<span class="trend-bad">- 請選擇長輩</span>';
            return;
        }

        const response = await fetch(
            `${API_BASE_URL}/api/alerts/statistics/${currentElderId}?userId=${currentUser.id}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': currentUser.id
                }
            }
        );

        if (!response.ok) {
            throw new Error('載入警示統計失敗');
        }

        const result = await response.json();
        const stats = result.statistics;

        // 更新待處理警示數量
        const pendingCount = stats.pending_count || 0;
        const criticalCount = stats.critical_count || 0;
        const highCount = stats.high_count || 0;

        document.getElementById('pendingAlerts').textContent = pendingCount;

        // 根據警示嚴重程度和數量顯示趨勢
        let trend = '';
        let trendClass = '';

        if (criticalCount > 0) {
            trend = `✗ ${criticalCount} 則危急警示`;
            trendClass = 'trend-bad';
        } else if (highCount > 0) {
            trend = `⚠ ${highCount} 則重要警示`;
            trendClass = 'trend-warning';
        } else if (pendingCount > 0) {
            trend = `⚠ ${pendingCount} 則待處理`;
            trendClass = 'trend-warning';
        } else {
            trend = '✓ 無異常';
            trendClass = 'trend-good';
        }

        document.getElementById('alertsTrend').innerHTML = `<span class="${trendClass}">${trend}</span>`;

    } catch (error) {
        console.error('載入警示統計失敗:', error);
        document.getElementById('pendingAlerts').textContent = '錯誤';
        document.getElementById('alertsTrend').innerHTML = '<span class="trend-bad">- 載入失敗</span>';
    }
}

/**
 * 載入警示列表
 */
async function loadAlerts() {
    try {
        console.log('🔍 載入警示列表 - Elder ID:', currentElderId);

        if (!currentElderId) {
            console.warn('⚠️ Elder ID 未設定，無法載入警示');
            displayEmptyAlerts('請先選擇長輩');
            return;
        }

        const statusFilter = document.getElementById('alertStatusFilter')?.value || '';
        const severityFilter = document.getElementById('alertSeverityFilter')?.value || '';
        const typeFilter = document.getElementById('alertTypeFilter')?.value || '';

        // 建立查詢參數
        let queryParams = [`userId=${currentUser.id}`];
        if (statusFilter) queryParams.push(`status=${statusFilter}`);
        if (severityFilter) queryParams.push(`severity=${severityFilter}`);
        if (typeFilter) queryParams.push(`type=${typeFilter}`);

        const response = await fetch(
            `${API_BASE_URL}/api/alerts/elder/${currentElderId}?${queryParams.join('&')}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': currentUser.id
                }
            }
        );

        if (!response.ok) {
            throw new Error('載入警示列表失敗');
        }

        const result = await response.json();
        const alerts = result.alerts || [];

        console.log('📊 載入到', alerts.length, '則警示');

        const container = document.getElementById('alertsList');
        if (alerts.length === 0) {
            displayEmptyAlerts('目前沒有警示');
            return;
        }

        // 渲染警示列表
        container.innerHTML = alerts.map(alert => createAlertCard(alert)).join('');

    } catch (error) {
        console.error('載入警示列表失敗:', error);
        displayEmptyAlerts('載入失敗，請重試');
    }
}

/**
 * 創建警示卡片 HTML
 */
function createAlertCard(alert) {
    const severityIcons = {
        'critical': '🚨',
        'high': '⚠️',
        'medium': 'ℹ️',
        'low': '💡'
    };

    const severityColors = {
        'critical': '#f44336',
        'high': '#ff9800',
        'medium': '#2196f3',
        'low': '#9e9e9e'
    };

    const severityLabels = {
        'critical': '危急',
        'high': '重要',
        'medium': '中等',
        'low': '低'
    };

    const typeIcons = {
        'medication': '💊',
        'health': '🏥',
        'activity': '📊',
        'emergency': '🚨',
        'vital_signs': '❤️'
    };

    const typeLabels = {
        'medication': '用藥警示',
        'health': '健康警示',
        'activity': '活動警示',
        'emergency': '緊急警示',
        'vital_signs': '生命徵象'
    };

    const statusLabels = {
        'pending': '待處理',
        'acknowledged': '已確認',
        'resolved': '已解決',
        'dismissed': '已忽略'
    };

    const statusColors = {
        'pending': '#ff9800',
        'acknowledged': '#2196f3',
        'resolved': '#4caf50',
        'dismissed': '#9e9e9e'
    };

    const icon = severityIcons[alert.severity] || '📌';
    const severityColor = severityColors[alert.severity] || '#9e9e9e';
    const severityLabel = severityLabels[alert.severity] || alert.severity;
    const typeIcon = typeIcons[alert.alert_type] || '📌';
    const typeLabel = typeLabels[alert.alert_type] || alert.alert_type;
    const statusLabel = statusLabels[alert.status] || alert.status;
    const statusColor = statusColors[alert.status] || '#9e9e9e';
    const timeAgo = formatTimeAgo(new Date(alert.created_at));

    const isPending = alert.status === 'pending';
    const isAcknowledged = alert.status === 'acknowledged';

    return `
        <div class="alert-card severity-${alert.severity}" data-alert-id="${alert.id}">
            <div class="alert-header">
                <div class="alert-icon" style="font-size: 24px;">${icon}</div>
                <div class="alert-title-group">
                    <div class="alert-title">${escapeHtml(alert.title)}</div>
                    <div class="alert-meta">
                        <span class="alert-type">
                            <span style="margin-right: 4px;">${typeIcon}</span>
                            ${typeLabel}
                        </span>
                        <span class="alert-severity" style="color: ${severityColor};">
                            ${severityLabel}
                        </span>
                        <span class="alert-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="alert-status" style="background: ${statusColor};">
                    ${statusLabel}
                </div>
            </div>
            <div class="alert-body">
                <p class="alert-description">${escapeHtml(alert.description || '無詳細說明')}</p>
                ${alert.resolution_note ? `<p class="alert-resolution"><strong>處理備註:</strong> ${escapeHtml(alert.resolution_note)}</p>` : ''}
            </div>
            <div class="alert-actions">
                ${isPending ? `
                    <button class="btn btn-secondary" onclick="acknowledgeAlert('${alert.id}')">
                        確認
                    </button>
                    <button class="btn btn-primary" onclick="resolveAlert('${alert.id}')">
                        標記已解決
                    </button>
                    <button class="btn btn-text" onclick="dismissAlert('${alert.id}')">
                        忽略
                    </button>
                ` : isAcknowledged ? `
                    <button class="btn btn-primary" onclick="resolveAlert('${alert.id}')">
                        標記已解決
                    </button>
                ` : `
                    <span class="alert-resolved-info">
                        ${alert.resolver_name ? `由 ${alert.resolver_name} 處理` : '已處理'}
                        ${alert.resolved_at ? ` · ${formatTimeAgo(new Date(alert.resolved_at))}` : ''}
                    </span>
                `}
            </div>
        </div>
    `;
}

/**
 * 顯示空狀態
 */
function displayEmptyAlerts(message) {
    const container = document.getElementById('alertsList');
    container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">🔔</div>
            <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #666;">沒有警示</h3>
            <p style="margin: 0; font-size: 14px; color: #999;">${message}</p>
        </div>
    `;
}

/**
 * 確認警示
 */
async function acknowledgeAlert(alertId) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/alerts/${alertId}/acknowledge?userId=${currentUser.id}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': currentUser.id
                }
            }
        );

        if (!response.ok) {
            throw new Error('確認警示失敗');
        }

        showToast('警示已確認', 'success');
        await loadAlerts();
        await loadAlertStatistics();

    } catch (error) {
        console.error('確認警示失敗:', error);
        showToast('操作失敗，請重試', 'error');
    }
}

/**
 * 解決警示
 */
async function resolveAlert(alertId) {
    try {
        // 詢問處理備註（可選）
        const note = prompt('請輸入處理備註（可選）:');

        const response = await fetch(
            `${API_BASE_URL}/api/alerts/${alertId}/resolve?userId=${currentUser.id}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify({
                    resolutionNote: note || undefined
                })
            }
        );

        if (!response.ok) {
            throw new Error('解決警示失敗');
        }

        showToast('警示已標記為已解決', 'success');
        await loadAlerts();
        await loadAlertStatistics();

    } catch (error) {
        console.error('解決警示失敗:', error);
        showToast('操作失敗，請重試', 'error');
    }
}

/**
 * 忽略警示
 */
async function dismissAlert(alertId) {
    try {
        if (!confirm('確定要忽略此警示嗎？')) {
            return;
        }

        const note = prompt('請輸入忽略原因（可選）:');

        const response = await fetch(
            `${API_BASE_URL}/api/alerts/${alertId}/dismiss?userId=${currentUser.id}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify({
                    resolutionNote: note || undefined
                })
            }
        );

        if (!response.ok) {
            throw new Error('忽略警示失敗');
        }

        showToast('警示已忽略', 'success');
        await loadAlerts();
        await loadAlertStatistics();

    } catch (error) {
        console.error('忽略警示失敗:', error);
        showToast('操作失敗，請重試', 'error');
    }
}

/**
 * 篩選警示
 */
function filterAlerts() {
    loadAlerts();
}

/**
 * HTML 轉義（防止 XSS）
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('✅ family-dashboard.js (警示系統) 載入完成');
