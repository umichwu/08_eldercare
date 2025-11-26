/**
 * 心情日記功能 JavaScript
 */

// Supabase 設定
const SUPABASE_URL = 'https://rxquczgjsgkeqemhngnb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cXVjemdqc2drZXFlbWhuZ25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MzU2ODIsImV4cCI6MjA1MzAxMTY4Mn0.DsULEgz4hzs0lY2PHQhP3nQyggwsI2_BcZttxPLobYw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// API 基礎 URL - 從全域配置讀取 (config.js)
// 注意：API_BASE_URL 已在 config.js 中定義為全域變數，這裡不需要重新宣告

// 全域變數
let currentUser = null;
let currentElder = null;

// ================================================
// 初始化
// ================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 檢查登入狀態
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = session.user;

        // 取得長輩資料
        await loadElderProfile();

        // 初始化圖片上傳器
        imageUploader = new ImageUploader({
            containerId: 'imageUploader',
            maxFiles: 5,
            maxSizeMB: 5,
            uploadUrl: `${API_BASE_URL}/api/images/upload`,
            onUploadSuccess: (images) => {
                console.log('圖片上傳成功:', images);
            },
            onUploadError: (error) => {
                showToast('圖片上傳失敗', 'error');
            }
        });

        // 載入日記列表
        loadDiaries();

    } catch (error) {
        console.error('初始化錯誤:', error);
        showToast('初始化失敗', 'error');
    }
});

// ================================================
// 載入長輩資料
// ================================================

async function loadElderProfile() {
    try {
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', currentUser.id)
            .single();

        if (!profile || profile.role !== 'elder') {
            showToast('此功能僅供長輩使用', 'warning');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }

        const { data: elder } = await supabase
            .from('elders')
            .select('*')
            .eq('user_profile_id', profile.id)
            .single();

        currentElder = elder;

    } catch (error) {
        console.error('載入長輩資料失敗:', error);
    }
}

// ================================================
// 標籤切換
// ================================================

function switchTab(tabName) {
    // 更新按鈕
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // 更新內容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // 載入對應資料
    if (tabName === 'list') {
        loadDiaries();
    }
}

// ================================================
// 心情選擇
// ================================================

function selectMood(level, emoji) {
    // 移除所有選中狀態
    document.querySelectorAll('.mood-option').forEach(option => {
        option.classList.remove('selected');
    });

    // 選中當前
    event.currentTarget.classList.add('selected');

    // 設定值
    document.getElementById('moodLevel').value = level;
    document.getElementById('moodEmoji').value = emoji;
}

// ================================================
// 提交日記
// ================================================

async function submitDiary(event) {
    event.preventDefault();

    if (!currentElder) {
        showToast('無法取得長輩資料', 'error');
        return;
    }

    const form = document.getElementById('diaryForm');
    const formData = new FormData();

    // 基本資料
    formData.append('elder_id', currentElder.id);
    formData.append('title', document.getElementById('diaryTitle').value);
    formData.append('content', document.getElementById('diaryContent').value);
    formData.append('mood_level', document.getElementById('moodLevel').value);
    formData.append('mood_emoji', document.getElementById('moodEmoji').value);

    // 標籤
    const tagsInput = document.getElementById('diaryTags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];
    formData.append('tags', JSON.stringify(tags));

    // 圖片
    const selectedFiles = imageUploader.getSelectedFiles();
    if (selectedFiles.length > 0) {
        for (let file of selectedFiles) {
            formData.append('images', file);
        }
    }

    try {
        // 顯示載入中
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = '儲存中...';
        submitBtn.disabled = true;

        // 發送請求
        const response = await fetch(`${API_BASE_URL}/api/images/mood-diary`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showToast('日記儲存成功！', 'success');

            // 重置表單
            form.reset();
            imageUploader.reset();
            document.querySelectorAll('.mood-option').forEach(option => {
                option.classList.remove('selected');
            });

            // 切換到列表
            switchTab('list');
            loadDiaries();

        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        console.error('儲存日記失敗:', error);
        showToast('儲存失敗：' + error.message, 'error');
    } finally {
        const submitBtn = document.querySelector('#diaryForm button[type="submit"]');
        submitBtn.textContent = '💾 儲存日記';
        submitBtn.disabled = false;
    }
}

// ================================================
// 載入日記列表
// ================================================

async function loadDiaries() {
    if (!currentElder) return;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/images/mood-diary/elder/${currentElder.id}?limit=50&include_private=true`
        );
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        renderDiaries(result.diaries || []);

    } catch (error) {
        console.error('載入日記失敗:', error);
        showToast('載入失敗', 'error');
    }
}

// ================================================
// 渲染日記列表
// ================================================

function renderDiaries(diaries) {
    const container = document.getElementById('diaryList');

    if (diaries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📔</div>
                <p>還沒有日記</p>
                <p style="font-size: 14px; color: #999;">點擊「新增日記」開始記錄心情吧！</p>
            </div>
        `;
        return;
    }

    container.innerHTML = diaries.map(diary => `
        <div class="diary-item">
            <div class="diary-header">
                <div class="diary-mood">${diary.mood_emoji || '📝'}</div>
                <div class="diary-date">${formatDateTime(diary.created_at)}</div>
            </div>

            ${diary.title ? `<div class="diary-title">${diary.title}</div>` : ''}

            <div class="diary-content">${diary.content}</div>

            ${diary.images && diary.images.length > 0 ? `
                <div class="diary-images">
                    ${diary.images.map(img => `
                        <div class="diary-image" onclick="showImageModal('${img.storage_url}')">
                            <img src="${img.storage_url}" alt="日記照片">
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${diary.tags && diary.tags.length > 0 ? `
                <div class="diary-tags">
                    ${diary.tags.map(tag => `
                        <span class="diary-tag">${tag}</span>
                    `).join('')}
                </div>
            ` : ''}

            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn-secondary" onclick="deleteDiary('${diary.id}')" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    🗑️ 刪除
                </button>
            </div>
        </div>
    `).join('');
}

// ================================================
// 刪除日記
// ================================================

async function deleteDiary(diaryId) {
    if (!confirm('確定要刪除這篇日記嗎？')) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/images/mood-diary/${diaryId}`,
            { method: 'DELETE' }
        );

        const result = await response.json();

        if (result.success) {
            showToast('日記已刪除', 'success');
            loadDiaries();
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        console.error('刪除日記失敗:', error);
        showToast('刪除失敗', 'error');
    }
}

// ================================================
// 圖片預覽
// ================================================

function showImageModal(url) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    modalImage.src = url;
    modal.classList.add('show');
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('show');
}

// 點擊 modal 背景關閉
document.getElementById('imageModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'imageModal') {
        closeImageModal();
    }
});

// ================================================
// 輔助函數
// ================================================

function formatDateTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // 今天
    if (date.toDateString() === now.toDateString()) {
        return `今天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `昨天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // 7 天內
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days} 天前`;
    }

    // 其他
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';

    if (type === 'error') {
        toast.style.background = '#f44336';
    } else if (type === 'success') {
        toast.style.background = '#4caf50';
    } else if (type === 'warning') {
        toast.style.background = '#ff9800';
    } else {
        toast.style.background = '#2196f3';
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
