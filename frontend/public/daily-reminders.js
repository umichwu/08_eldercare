/**
 * 生活提醒系統 - 前端邏輯
 * ElderCare Companion - Daily Reminders Frontend
 */

// ==================== 全域變數 ====================
let supabase;
let currentUser = null;
let currentElderId = null;
let currentTab = 'today';
let currentCategory = 'all';
let selectedDate = new Date();
let reminderCategories = [];
let editingReminderId = null;
let confirmingLog = null;

// Chart 實例
let completionChart = null;
let categoryChart = null;
let trendChart = null;

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 初始化 Supabase（使用與 index.html 相同的配置）
    const SUPABASE_URL = 'https://oatdjdelzybcacwqafkk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGRqZGVsenliY2Fjd3FhZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM5ODUsImV4cCI6MjA3Njc3OTk4NX0.Flk-9yHREG7gWr1etG-TEc2ufPjP-zvW2Ejd2gCqG4w';
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // 檢查使用者登入狀態
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login.html';
      return;
    }
    currentUser = user;

    // 取得當前長輩 ID（從 localStorage 或 URL 參數）
    currentElderId = localStorage.getItem('currentElderId') ||
                     new URLSearchParams(window.location.search).get('elderId');

    if (!currentElderId) {
      alert('請先選擇要管理的長輩');
      window.location.href = '/index.html';
      return;
    }

    // 載入提醒類別
    await loadReminderCategories();

    // 初始化日期選擇器
    updateDateDisplay();

    // 載入今日提醒
    await loadTodayReminders();

    // 初始化事件監聽器
    initEventListeners();

    console.log('✅ 生活提醒系統初始化完成');
  } catch (error) {
    console.error('❌ 初始化失敗:', error);
    alert('系統初始化失敗，請重新載入頁面');
  }
});

// ==================== 事件監聽器 ====================
function initEventListeners() {
  // 表單提交
  document.getElementById('reminderForm').addEventListener('submit', handleReminderSubmit);

  // 確認表單提交
  document.getElementById('confirmForm').addEventListener('submit', handleConfirmSubmit);

  // 模態視窗關閉
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });

  // 類別選擇變更
  document.getElementById('reminderCategory').addEventListener('change', (e) => {
    selectCategory(e.target.value);
  });
}

// ==================== 提醒類別載入 ====================
async function loadReminderCategories() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/reminder-categories`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('載入類別失敗');

    const result = await response.json();
    reminderCategories = result.data || [];

    // 更新類別選擇器（篩選按鈕已在 HTML 中定義）
    const categorySelect = document.getElementById('reminderCategory');
    categorySelect.innerHTML = '<option value="">選擇類別</option>';

    reminderCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.category_key;
      option.textContent = `${cat.icon} ${cat.name_zh}`;
      categorySelect.appendChild(option);
    });
  } catch (error) {
    console.error('載入類別失敗:', error);
  }
}

// ==================== 標籤切換 ====================
function switchTab(tabName) {
  currentTab = tabName;

  // 更新標籤樣式
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');

  // 隱藏所有內容
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // 顯示對應內容
  const tabContent = document.getElementById(`${tabName}Tab`);
  if (tabContent) {
    tabContent.classList.add('active');
  }

  // 載入對應資料
  switch(tabName) {
    case 'today':
      loadTodayReminders();
      break;
    case 'all':
      loadAllReminders();
      break;
    case 'stats':
      loadStatistics();
      break;
  }
}

// ==================== 類別篩選 ====================
function filterByCategory(category) {
  currentCategory = category;

  // 更新按鈕樣式
  document.querySelectorAll('.category-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[onclick="filterByCategory('${category}')"]`).classList.add('active');

  // 重新載入資料
  if (currentTab === 'today') {
    loadTodayReminders();
  } else if (currentTab === 'all') {
    loadAllReminders();
  }
}

// ==================== 日期選擇 ====================
function updateDateDisplay() {
  const dateDisplay = document.getElementById('currentDate');
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  dateDisplay.textContent = selectedDate.toLocaleDateString('zh-TW', options);
}

function changeDate(days) {
  selectedDate.setDate(selectedDate.getDate() + days);
  updateDateDisplay();
  loadTodayReminders();
}

function goToToday() {
  selectedDate = new Date();
  updateDateDisplay();
  loadTodayReminders();
}

// ==================== 載入今日提醒 ====================
async function loadTodayReminders() {
  try {
    const categoryParam = currentCategory !== 'all' ? `&category=${currentCategory}` : '';
    const dateStr = selectedDate.toISOString().split('T')[0];

    const response = await fetch(
      `${getApiBaseUrl()}/api/daily-reminder-logs/today/${currentElderId}?date=${dateStr}${categoryParam}`,
      { headers: getAuthHeaders() }
    );

    if (!response.ok) throw new Error('載入失敗');

    const result = await response.json();
    const logs = result.data || [];

    // 更新統計卡片
    updateTodaySummary(logs);

    // 顯示提醒列表
    displayTodayReminders(logs);
  } catch (error) {
    console.error('載入今日提醒失敗:', error);
    showError('載入今日提醒失敗');
  }
}

function updateTodaySummary(logs) {
  const total = logs.length;
  const completed = logs.filter(l => l.status === 'completed').length;
  const pending = logs.filter(l => l.status === 'pending').length;
  const missed = logs.filter(l => l.status === 'missed').length;

  document.getElementById('todayTotal').textContent = total;
  document.getElementById('todayCompleted').textContent = completed;
  document.getElementById('todayPending').textContent = pending;
  document.getElementById('todayMissed').textContent = missed;
}

function displayTodayReminders(logs) {
  const container = document.getElementById('todayRemindersList');

  if (logs.length === 0) {
    container.innerHTML = '<div class="empty-state">📅 今日沒有提醒事項</div>';
    return;
  }

  container.innerHTML = logs.map(log => {
    const category = reminderCategories.find(c => c.category_key === log.category);
    const statusClass = log.status === 'completed' ? 'completed' :
                       log.status === 'missed' ? 'missed' : 'pending';
    const statusText = log.status === 'completed' ? '已完成' :
                      log.status === 'missed' ? '已錯過' : '待執行';

    return `
      <div class="reminder-card ${statusClass}">
        <div class="reminder-header">
          <div class="reminder-icon">${category?.icon || '📋'}</div>
          <div class="reminder-info">
            <div class="reminder-title">${escapeHtml(log.title)}</div>
            <div class="reminder-meta">
              <span class="reminder-time">⏰ ${formatTime(log.scheduled_time)}</span>
              <span class="reminder-category">${category?.name_zh || log.category}</span>
            </div>
          </div>
          <span class="reminder-status status-${statusClass}">${statusText}</span>
        </div>
        ${log.description ? `<div class="reminder-description">${escapeHtml(log.description)}</div>` : ''}
        ${renderCategoryDetails(log)}
        ${log.status === 'pending' ? `
          <div class="reminder-actions">
            <button class="btn btn-success btn-sm" onclick="openConfirmModal(${log.id}, '${log.category}')">
              ✓ 完成
            </button>
            <button class="btn btn-secondary btn-sm" onclick="skipReminder(${log.id})">
              ⊘ 跳過
            </button>
          </div>
        ` : ''}
        ${log.status === 'completed' && log.completed_at ? `
          <div class="reminder-completed-info">
            ✓ ${formatDateTime(log.completed_at)} 完成
            ${log.notes ? `<br>備註: ${escapeHtml(log.notes)}` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderCategoryDetails(log) {
  const data = log.category_data || {};

  switch(log.category) {
    case 'water':
      return data.water_amount ? `<div class="category-detail">💧 飲水量: ${data.water_amount}ml</div>` : '';
    case 'meal':
      return data.meal_timing ? `<div class="category-detail">🍽️ ${data.meal_timing === 'before' ? '餐前' : '餐後'}</div>` : '';
    case 'exercise':
      return data.exercise_type ? `<div class="category-detail">🏃 ${data.exercise_type} ${data.duration || ''}分鐘</div>` : '';
    case 'medication':
      return data.medication_name ? `<div class="category-detail">💊 ${data.medication_name} ${data.dosage || ''}</div>` : '';
    case 'appointment':
      return data.hospital_name ? `<div class="category-detail">🏥 ${data.hospital_name} - ${data.department || ''}</div>` : '';
    default:
      return '';
  }
}

// ==================== 載入所有提醒 ====================
async function loadAllReminders() {
  try {
    const categoryParam = currentCategory !== 'all' ? `?category=${currentCategory}` : '';

    const response = await fetch(
      `${getApiBaseUrl()}/api/daily-reminders/elder/${currentElderId}${categoryParam}`,
      { headers: getAuthHeaders() }
    );

    if (!response.ok) throw new Error('載入失敗');

    const result = await response.json();
    const reminders = result.data || [];

    displayAllReminders(reminders);
  } catch (error) {
    console.error('載入所有提醒失敗:', error);
    showError('載入提醒列表失敗');
  }
}

function displayAllReminders(reminders) {
  const container = document.getElementById('allRemindersList');

  if (reminders.length === 0) {
    container.innerHTML = '<div class="empty-state">📋 尚未建立任何提醒</div>';
    return;
  }

  container.innerHTML = reminders.map(reminder => {
    const category = reminderCategories.find(c => c.category_key === reminder.category);
    const isPaused = reminder.status === 'paused';

    return `
      <div class="reminder-card ${isPaused ? 'paused' : ''}">
        <div class="reminder-header">
          <div class="reminder-icon">${category?.icon || '📋'}</div>
          <div class="reminder-info">
            <div class="reminder-title">${escapeHtml(reminder.title)}</div>
            <div class="reminder-meta">
              <span class="reminder-time">⏰ ${reminder.reminder_time}</span>
              <span class="reminder-category">${category?.name_zh || reminder.category}</span>
            </div>
          </div>
          <span class="reminder-status ${isPaused ? 'status-paused' : 'status-active'}">
            ${isPaused ? '已暫停' : '進行中'}
          </span>
        </div>
        ${reminder.description ? `<div class="reminder-description">${escapeHtml(reminder.description)}</div>` : ''}
        <div class="reminder-schedule">
          <span>🔄 ${formatRecurrence(reminder.recurrence_pattern)}</span>
          ${reminder.recurrence_days ? `<span>📅 ${formatDays(reminder.recurrence_days)}</span>` : ''}
        </div>
        <div class="reminder-actions">
          <button class="btn btn-primary btn-sm" onclick="editReminder(${reminder.id})">
            ✎ 編輯
          </button>
          <button class="btn btn-warning btn-sm" onclick="toggleReminder(${reminder.id}, ${!isPaused})">
            ${isPaused ? '▶ 恢復' : '⏸ 暫停'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteReminder(${reminder.id})">
            🗑 刪除
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== 快速建立提醒 ====================
async function createQuickReminder(template) {
  const templates = {
    morning_water: {
      title: '早晨喝水',
      category: 'water',
      reminder_time: '08:00',
      recurrence_pattern: 'daily',
      category_data: { water_amount: 300 }
    },
    lunch: {
      title: '午餐提醒',
      category: 'meal',
      reminder_time: '12:00',
      recurrence_pattern: 'daily',
      category_data: { meal_timing: 'before' }
    },
    afternoon_walk: {
      title: '下午散步',
      category: 'exercise',
      reminder_time: '15:00',
      recurrence_pattern: 'daily',
      category_data: { exercise_type: '散步', duration: 30 }
    },
    evening_medication: {
      title: '晚間服藥',
      category: 'medication',
      reminder_time: '20:00',
      recurrence_pattern: 'daily'
    },
    bedtime: {
      title: '就寢時間',
      category: 'sleep',
      reminder_time: '22:00',
      recurrence_pattern: 'daily'
    }
  };

  const templateData = templates[template];
  if (!templateData) return;

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/daily-reminders/quick-create`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        elder_id: currentElderId,
        ...templateData
      })
    });

    if (!response.ok) throw new Error('建立失敗');

    showSuccess('快速提醒建立成功！');
    loadAllReminders();
  } catch (error) {
    console.error('快速建立失敗:', error);
    showError('建立提醒失敗');
  }
}

// ==================== 提醒表單處理 ====================
function showAddReminderForm() {
  editingReminderId = null;
  document.getElementById('reminderModalTitle').textContent = '新增生活提醒';
  document.getElementById('reminderForm').reset();
  document.getElementById('categorySpecificFields').innerHTML = '';
  document.getElementById('reminderModal').style.display = 'flex';
}

function closeReminderModal() {
  document.getElementById('reminderModal').style.display = 'none';
  editingReminderId = null;
}

function selectCategory(category) {
  const container = document.getElementById('categorySpecificFields');
  container.innerHTML = '';

  switch(category) {
    case 'water':
      container.innerHTML = `
        <div class="form-group">
          <label>飲水量 (ml)</label>
          <input type="number" id="water_amount" min="0" step="50" value="300" class="form-input">
        </div>
      `;
      break;
    case 'meal':
      container.innerHTML = `
        <div class="form-group">
          <label>用餐時機</label>
          <select id="meal_timing" class="form-input">
            <option value="before">餐前</option>
            <option value="after">餐後</option>
          </select>
        </div>
      `;
      break;
    case 'exercise':
      container.innerHTML = `
        <div class="form-group">
          <label>運動類型</label>
          <input type="text" id="exercise_type" placeholder="例如: 散步、體操" class="form-input">
        </div>
        <div class="form-group">
          <label>建議時長 (分鐘)</label>
          <input type="number" id="duration" min="0" step="5" value="30" class="form-input">
        </div>
      `;
      break;
    case 'medication':
      container.innerHTML = `
        <div class="form-group">
          <label>藥物名稱</label>
          <input type="text" id="medication_name" class="form-input">
        </div>
        <div class="form-group">
          <label>劑量</label>
          <input type="text" id="dosage" placeholder="例如: 1顆" class="form-input">
        </div>
      `;
      break;
    case 'appointment':
      container.innerHTML = `
        <div class="form-group">
          <label>醫院名稱</label>
          <input type="text" id="hospital_name" class="form-input">
        </div>
        <div class="form-group">
          <label>科別</label>
          <input type="text" id="department" placeholder="例如: 內科" class="form-input">
        </div>
        <div class="form-group">
          <label>回診日期</label>
          <input type="date" id="appointment_date" class="form-input">
        </div>
      `;
      break;
  }
}

async function handleReminderSubmit(e) {
  e.preventDefault();

  const formData = {
    elder_id: currentElderId,
    title: document.getElementById('reminderTitle').value,
    description: document.getElementById('reminderDescription').value,
    category: document.getElementById('reminderCategory').value,
    reminder_time: document.getElementById('reminderTime').value,
    recurrence_pattern: document.getElementById('recurrencePattern').value,
    category_data: getCategorySpecificData(document.getElementById('reminderCategory').value)
  };

  // 處理重複天數
  const pattern = formData.recurrence_pattern;
  if (pattern === 'weekly' || pattern === 'custom') {
    const days = Array.from(document.querySelectorAll('input[name="recurrence_days"]:checked'))
      .map(cb => parseInt(cb.value));
    if (days.length > 0) {
      formData.recurrence_days = days;
    }
  }

  try {
    const url = editingReminderId
      ? `${getApiBaseUrl()}/api/daily-reminders/${editingReminderId}`
      : `${getApiBaseUrl()}/api/daily-reminders`;

    const method = editingReminderId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(formData)
    });

    if (!response.ok) throw new Error('儲存失敗');

    showSuccess(editingReminderId ? '提醒已更新' : '提醒已建立');
    closeReminderModal();
    loadAllReminders();
  } catch (error) {
    console.error('儲存提醒失敗:', error);
    showError('儲存提醒失敗');
  }
}

function getCategorySpecificData(category) {
  const data = {};

  switch(category) {
    case 'water':
      const waterAmount = document.getElementById('water_amount');
      if (waterAmount) data.water_amount = parseInt(waterAmount.value);
      break;
    case 'meal':
      const mealTiming = document.getElementById('meal_timing');
      if (mealTiming) data.meal_timing = mealTiming.value;
      break;
    case 'exercise':
      const exerciseType = document.getElementById('exercise_type');
      const duration = document.getElementById('duration');
      if (exerciseType) data.exercise_type = exerciseType.value;
      if (duration) data.duration = parseInt(duration.value);
      break;
    case 'medication':
      const medicationName = document.getElementById('medication_name');
      const dosage = document.getElementById('dosage');
      if (medicationName) data.medication_name = medicationName.value;
      if (dosage) data.dosage = dosage.value;
      break;
    case 'appointment':
      const hospitalName = document.getElementById('hospital_name');
      const department = document.getElementById('department');
      const appointmentDate = document.getElementById('appointment_date');
      if (hospitalName) data.hospital_name = hospitalName.value;
      if (department) data.department = department.value;
      if (appointmentDate) data.appointment_date = appointmentDate.value;
      break;
  }

  return Object.keys(data).length > 0 ? data : null;
}

async function editReminder(reminderId) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/daily-reminders/${reminderId}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('載入失敗');

    const result = await response.json();
    const reminder = result.data;

    editingReminderId = reminderId;
    document.getElementById('reminderModalTitle').textContent = '編輯提醒';

    // 填充表單
    document.getElementById('reminderTitle').value = reminder.title;
    document.getElementById('reminderDescription').value = reminder.description || '';
    document.getElementById('reminderCategory').value = reminder.category;
    document.getElementById('reminderTime').value = reminder.reminder_time;
    document.getElementById('recurrencePattern').value = reminder.recurrence_pattern;

    // 載入類別特定欄位
    selectCategory(reminder.category);

    // 填充類別特定資料
    if (reminder.category_data) {
      setTimeout(() => fillCategoryData(reminder.category, reminder.category_data), 100);
    }

    document.getElementById('reminderModal').style.display = 'flex';
  } catch (error) {
    console.error('載入提醒失敗:', error);
    showError('載入提醒資料失敗');
  }
}

function fillCategoryData(category, data) {
  switch(category) {
    case 'water':
      const waterAmount = document.getElementById('water_amount');
      if (waterAmount && data.water_amount) waterAmount.value = data.water_amount;
      break;
    case 'meal':
      const mealTiming = document.getElementById('meal_timing');
      if (mealTiming && data.meal_timing) mealTiming.value = data.meal_timing;
      break;
    case 'exercise':
      const exerciseType = document.getElementById('exercise_type');
      const duration = document.getElementById('duration');
      if (exerciseType && data.exercise_type) exerciseType.value = data.exercise_type;
      if (duration && data.duration) duration.value = data.duration;
      break;
    case 'medication':
      const medicationName = document.getElementById('medication_name');
      const dosage = document.getElementById('dosage');
      if (medicationName && data.medication_name) medicationName.value = data.medication_name;
      if (dosage && data.dosage) dosage.value = data.dosage;
      break;
    case 'appointment':
      const hospitalName = document.getElementById('hospital_name');
      const department = document.getElementById('department');
      const appointmentDate = document.getElementById('appointment_date');
      if (hospitalName && data.hospital_name) hospitalName.value = data.hospital_name;
      if (department && data.department) department.value = data.department;
      if (appointmentDate && data.appointment_date) appointmentDate.value = data.appointment_date;
      break;
  }
}

async function toggleReminder(reminderId, pause) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/daily-reminders/${reminderId}/toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pause })
    });

    if (!response.ok) throw new Error('操作失敗');

    showSuccess(pause ? '提醒已暫停' : '提醒已恢復');
    loadAllReminders();
  } catch (error) {
    console.error('切換狀態失敗:', error);
    showError('操作失敗');
  }
}

async function deleteReminder(reminderId) {
  if (!confirm('確定要刪除此提醒嗎？')) return;

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/daily-reminders/${reminderId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('刪除失敗');

    showSuccess('提醒已刪除');
    loadAllReminders();
  } catch (error) {
    console.error('刪除提醒失敗:', error);
    showError('刪除失敗');
  }
}

// ==================== 確認完成提醒 ====================
function openConfirmModal(logId, category) {
  confirmingLog = { id: logId, category };

  const container = document.getElementById('confirmCategoryFields');
  container.innerHTML = '';

  switch(category) {
    case 'water':
      container.innerHTML = `
        <div class="form-group">
          <label>實際飲水量 (ml)</label>
          <input type="number" id="confirm_water_amount" min="0" step="50" class="form-input" required>
        </div>
      `;
      break;
    case 'exercise':
      container.innerHTML = `
        <div class="form-group">
          <label>實際運動時長 (分鐘)</label>
          <input type="number" id="confirm_duration" min="0" step="5" class="form-input" required>
        </div>
      `;
      break;
  }

  document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirmModal() {
  document.getElementById('confirmModal').style.display = 'none';
  confirmingLog = null;
}

async function handleConfirmSubmit(e) {
  e.preventDefault();

  if (!confirmingLog) return;

  const completionData = {};

  switch(confirmingLog.category) {
    case 'water':
      const waterAmount = document.getElementById('confirm_water_amount');
      if (waterAmount) completionData.water_amount = parseInt(waterAmount.value);
      break;
    case 'exercise':
      const duration = document.getElementById('confirm_duration');
      if (duration) completionData.duration = parseInt(duration.value);
      break;
  }

  const notes = document.getElementById('confirmNotes').value;
  if (notes) completionData.notes = notes;

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/daily-reminder-logs/${confirmingLog.id}/confirm`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        confirmed_by: currentUser.id,
        completion_data: Object.keys(completionData).length > 0 ? completionData : null
      })
    });

    if (!response.ok) throw new Error('確認失敗');

    showSuccess('已確認完成！');
    closeConfirmModal();
    loadTodayReminders();
  } catch (error) {
    console.error('確認失敗:', error);
    showError('確認失敗');
  }
}

async function skipReminder(logId) {
  if (!confirm('確定要跳過此提醒嗎？')) return;

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/daily-reminder-logs/${logId}/skip`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        skipped_by: currentUser.id
      })
    });

    if (!response.ok) throw new Error('操作失敗');

    showSuccess('已跳過提醒');
    loadTodayReminders();
  } catch (error) {
    console.error('跳過失敗:', error);
    showError('操作失敗');
  }
}

// ==================== 統計分析 ====================
async function loadStatistics() {
  try {
    const days = document.getElementById('statsDays')?.value || 7;
    const response = await fetch(
      `${getApiBaseUrl()}/api/daily-reminder-logs/statistics/${currentElderId}?days=${days}`,
      { headers: getAuthHeaders() }
    );

    if (!response.ok) throw new Error('載入失敗');

    const result = await response.json();
    const stats = result.data;

    // 渲染圖表
    renderCompletionChart(stats.overall);
    renderCategoryChart(stats.by_category);
    renderTrendChart(stats.daily_trend);
  } catch (error) {
    console.error('載入統計失敗:', error);
    showError('載入統計資料失敗');
  }
}

function renderCompletionChart(overallStats) {
  const ctx = document.getElementById('completionChart');
  if (!ctx) return;

  if (completionChart) {
    completionChart.destroy();
  }

  completionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['已完成', '待執行', '已錯過', '已跳過'],
      datasets: [{
        data: [
          overallStats.completed,
          overallStats.pending,
          overallStats.missed,
          overallStats.skipped
        ],
        backgroundColor: ['#38ef7d', '#667eea', '#ff6b6b', '#ffc107']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: `完成率: ${overallStats.completion_rate}%`
        }
      }
    }
  });
}

function renderCategoryChart(categoryStats) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;

  if (categoryChart) {
    categoryChart.destroy();
  }

  const categories = Object.keys(categoryStats);
  const data = categories.map(cat => categoryStats[cat].completion_rate);

  categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories.map(cat => {
        const c = reminderCategories.find(rc => rc.category_key === cat);
        return c ? `${c.icon} ${c.name_zh}` : cat;
      }),
      datasets: [{
        label: '完成率 (%)',
        data: data,
        backgroundColor: '#667eea'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

function renderTrendChart(dailyTrend) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  if (trendChart) {
    trendChart.destroy();
  }

  const dates = dailyTrend.map(d => d.date);
  const completed = dailyTrend.map(d => d.completed);
  const total = dailyTrend.map(d => d.total);

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => new Date(d).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: '完成數',
          data: completed,
          borderColor: '#38ef7d',
          backgroundColor: 'rgba(56, 239, 125, 0.1)',
          tension: 0.4
        },
        {
          label: '總提醒數',
          data: total,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// ==================== 工具函式 ====================
function getApiBaseUrl() {
  // 使用全域配置中的 API URL
  return window.APP_CONFIG?.API_BASE_URL || 'https://eldercare-backend-8o4k.onrender.com';
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': currentUser?.id || ''
  };
}

function formatTime(timeStr) {
  return timeStr?.substring(0, 5) || '';
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const dt = new Date(dateTimeStr);
  return dt.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRecurrence(pattern) {
  const patterns = {
    daily: '每日',
    weekly: '每週',
    monthly: '每月',
    custom: '自訂',
    once: '單次'
  };
  return patterns[pattern] || pattern;
}

function formatDays(days) {
  if (!days || days.length === 0) return '';
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return days.map(d => dayNames[d]).join(', ');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showSuccess(message) {
  alert('✅ ' + message);
}

function showError(message) {
  alert('❌ ' + message);
}
