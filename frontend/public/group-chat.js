/**
 * 群組聊天頁面主要邏輯
 * ElderCare Group Chat Module
 */

// ===================================
// 全域變數
// ===================================
const SUPABASE_URL = 'https://oatdjdelzybcacwqafkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGRqZGVsenliY2Fjd3FhZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM5ODUsImV4cCI6MjA3Njc3OTk4NX0.Flk-9yHREG7gWr1etG-TEc2ufPjP-zvW2Ejd2gCqG4w';

// API 基礎 URL - 使用全域配置
// 注意：API_BASE_URL 在 config.js 中定義

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let userProfile = null;
let currentGroup = null;
let groups = [];
let currentGroupMessages = [];
let messagesChannel = null;

// ===================================
// 初始化
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 初始化群組聊天頁面...');

    try {
        // 檢查認證
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            console.log('⚠️ 未登入，重定向到登入頁面');
            window.location.href = '/login.html';
            return;
        }

        console.log('✅ 認證通過，載入頁面內容');

        // 載入群組列表
        await loadGroups();

        console.log('✅ 群組聊天頁面初始化完成');
    } catch (error) {
        console.error('❌ 初始化失敗:', error);
        showError('初始化失敗，請重新整理頁面');
    }
});

// ===================================
// 認證檢查
// ===================================
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('❌ 認證檢查錯誤:', error);
            return false;
        }

        if (!session) {
            console.log('⚠️ 無有效 session');
            return false;
        }

        currentUser = session.user;
        console.log('✅ 使用者已認證:', currentUser.email);

        // 載入使用者資料
        const { data, error: profileError } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', currentUser.id)
            .single();

        if (profileError) {
            console.error('❌ 載入使用者資料失敗:', profileError);
            return false;
        }

        userProfile = data;
        console.log('✅ 使用者資料載入完成:', userProfile.display_name);

        return true;
    } catch (error) {
        console.error('❌ 認證檢查失敗:', error);
        return false;
    }
}

// ===================================
// 載入群組列表
// ===================================
async function loadGroups() {
    const groupsList = document.getElementById('groupsList');
    const noGroupsPlaceholder = document.getElementById('noGroupsPlaceholder');

    try {
        console.log('📋 載入群組列表...');

        // 顯示載入中狀態
        groupsList.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>載入群組列表中...</p>
            </div>
        `;
        noGroupsPlaceholder.style.display = 'none';

        const response = await fetch(`${API_BASE_URL}/api/groups?userId=${userProfile.id}`);

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || '載入群組列表失敗');
        }

        const data = await response.json();
        groups = data.groups || [];
        console.log(`✅ 載入了 ${groups.length} 個群組`);

        renderGroups();
    } catch (error) {
        console.error('❌ 載入群組列表失敗:', error);
        console.error('錯誤詳情:', error.message);

        // 清除載入狀態
        groupsList.innerHTML = '';

        // 顯示錯誤訊息和空狀態
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            // 網路錯誤
            groupsList.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <div class="empty-icon">📡</div>
                    <h3>無法連線到伺服器</h3>
                    <p style="color: #666; margin-bottom: 20px;">請檢查網路連線</p>
                    <button class="btn-primary" onclick="loadGroups()">
                        🔄 重新載入
                    </button>
                </div>
            `;
        } else {
            // 其他錯誤或沒有群組
            noGroupsPlaceholder.style.display = 'flex';
        }
    }
}

// ===================================
// 渲染群組列表
// ===================================
function renderGroups(filteredGroups = null) {
    const groupsList = document.getElementById('groupsList');
    const noGroupsPlaceholder = document.getElementById('noGroupsPlaceholder');

    const groupsToRender = filteredGroups || groups;

    if (groupsToRender.length === 0) {
        groupsList.innerHTML = '';
        noGroupsPlaceholder.style.display = 'flex';
        return;
    }

    noGroupsPlaceholder.style.display = 'none';

    groupsList.innerHTML = groupsToRender.map(group => `
        <div class="friend-item ${currentGroup && currentGroup.id === group.id ? 'active' : ''}"
             onclick="selectGroup('${group.id}')">
            <div class="group-avatar">
                ${group.avatar_url
                    ? `<img src="${group.avatar_url}" alt="${group.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`
                    : group.name.charAt(0).toUpperCase()
                }
            </div>
            <div class="friend-info">
                <div class="friend-name">
                    ${escapeHtml(group.name)}
                    ${group.membership.is_pinned ? '📌' : ''}
                </div>
                <div class="friend-status">
                    ${group.member_count || 0} 位成員
                    ${group.last_message ? `・${escapeHtml(group.last_message.content.substring(0, 30))}${group.last_message.content.length > 30 ? '...' : ''}` : ''}
                </div>
            </div>
            ${group.membership.is_muted ? '<span style="opacity: 0.5;">🔕</span>' : ''}
        </div>
    `).join('');
}

// ===================================
// 選擇群組
// ===================================
async function selectGroup(groupId) {
    try {
        console.log(`📱 選擇群組: ${groupId}`);

        // 找到選擇的群組
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            throw new Error('找不到群組');
        }

        currentGroup = group;

        // 更新 UI
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('groupChatArea').style.display = 'flex';

        // 更新群組資訊
        const avatarDiv = document.getElementById('currentGroupAvatar');
        if (group.avatar_url) {
            avatarDiv.innerHTML = `<img src="${group.avatar_url}" alt="${group.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
        } else {
            avatarDiv.textContent = group.name.charAt(0).toUpperCase();
        }
        document.getElementById('currentGroupName').textContent = group.name;
        document.getElementById('currentGroupMemberCount').textContent = group.member_count || 0;

        // 載入群組訊息
        await loadGroupMessages(groupId);

        // 訂閱即時訊息
        subscribeToGroupMessages(groupId);

        // 更新群組列表的選中狀態
        renderGroups();
    } catch (error) {
        console.error('❌ 選擇群組失敗:', error);
        showError('載入群組失敗');
    }
}

// ===================================
// 載入群組訊息
// ===================================
async function loadGroupMessages(groupId) {
    try {
        console.log(`💬 載入群組訊息: ${groupId}`);

        const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/messages?limit=50`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '載入訊息失敗');
        }

        currentGroupMessages = data.messages || [];
        console.log(`✅ 載入了 ${currentGroupMessages.length} 則訊息`);

        renderMessages();
    } catch (error) {
        console.error('❌ 載入群組訊息失敗:', error);
        showError('載入訊息失敗');
    }
}

// ===================================
// 渲染訊息
// ===================================
function renderMessages() {
    const messagesContainer = document.getElementById('messagesContainer');

    if (currentGroupMessages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">💬</div>
                    <p style="color: #666;">還沒有訊息，開始聊天吧！</p>
                </div>
            </div>
        `;
        return;
    }

    messagesContainer.innerHTML = currentGroupMessages.map(msg => {
        const isOwnMessage = msg.sender_id === userProfile.id;
        const senderName = msg.user_profiles?.display_name || '未知使用者';

        return `
            <div class="message ${isOwnMessage ? 'message-sent' : 'message-received'}">
                ${!isOwnMessage ? `<div class="message-sender-name">${escapeHtml(senderName)}</div>` : ''}
                <div class="message-bubble">
                    ${msg.message_type === 'image'
                        ? `<img src="${msg.media_url}" alt="圖片" class="message-image" style="max-width: 300px; border-radius: 8px;">`
                        : `<div class="message-text">${escapeHtml(msg.content)}</div>`
                    }
                    <div class="message-time">${formatTime(msg.created_at)}</div>
                </div>
            </div>
        `;
    }).join('');

    // 滾動到底部
    scrollToBottom();
}

// ===================================
// 訂閱即時訊息
// ===================================
function subscribeToGroupMessages(groupId) {
    // 取消訂閱舊的頻道
    if (messagesChannel) {
        supabaseClient.removeChannel(messagesChannel);
    }

    // 訂閱新的頻道
    messagesChannel = supabaseClient
        .channel(`group-${groupId}`)
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `group_id=eq.${groupId}`
            },
            async (payload) => {
                console.log('📨 收到新訊息:', payload);

                // 載入訊息的發送者資訊
                const { data: senderData } = await supabaseClient
                    .from('user_profiles')
                    .select('id, display_name, avatar_url')
                    .eq('id', payload.new.sender_id)
                    .single();

                const newMessage = {
                    ...payload.new,
                    user_profiles: senderData
                };

                currentGroupMessages.push(newMessage);
                renderMessages();
            }
        )
        .subscribe();

    console.log(`✅ 已訂閱群組訊息: ${groupId}`);
}

// ===================================
// 發送訊息
// ===================================
async function sendGroupMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();

    if (!content) {
        return;
    }

    if (!currentGroup) {
        showError('請先選擇一個群組');
        return;
    }

    try {
        console.log('📤 發送訊息...');

        const response = await fetch(`${API_BASE_URL}/api/groups/${currentGroup.id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userProfile.id,
                content,
                message_type: 'text'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '發送訊息失敗');
        }

        console.log('✅ 訊息發送成功');

        // 清空輸入框
        messageInput.value = '';
        messageInput.style.height = 'auto';

    } catch (error) {
        console.error('❌ 發送訊息失敗:', error);
        showError('發送訊息失敗');
    }
}

// ===================================
// 處理鍵盤事件
// ===================================
function handleMessageKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendGroupMessage();
    }
}

// ===================================
// 搜尋群組
// ===================================
function filterGroups(event) {
    const searchTerm = event.target.value.toLowerCase().trim();

    if (!searchTerm) {
        renderGroups();
        return;
    }

    const filtered = groups.filter(group =>
        group.name.toLowerCase().includes(searchTerm) ||
        (group.description && group.description.toLowerCase().includes(searchTerm))
    );

    renderGroups(filtered);
}

// ===================================
// 建立群組對話框
// ===================================
function showCreateGroupModal() {
    document.getElementById('createGroupModal').style.display = 'flex';
}

function hideCreateGroupModal() {
    document.getElementById('createGroupModal').style.display = 'none';
    document.getElementById('createGroupForm').reset();
}

// ===================================
// 建立群組
// ===================================
async function createGroup(event) {
    event.preventDefault();

    const name = document.getElementById('groupName').value.trim();
    const description = document.getElementById('groupDescription').value.trim();
    const avatarUrl = document.getElementById('groupAvatarUrl').value.trim();
    const maxMembers = parseInt(document.getElementById('maxMembers').value);
    const isPrivate = document.getElementById('isPrivate').checked;

    if (!name) {
        showError('請輸入群組名稱');
        return;
    }

    try {
        console.log('➕ 建立新群組...');

        const response = await fetch(`${API_BASE_URL}/api/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userProfile.id,
                name,
                description: description || null,
                avatar_url: avatarUrl || null,
                max_members: maxMembers,
                is_private: isPrivate
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '建立群組失敗');
        }

        console.log('✅ 群組建立成功:', data.group);

        // 關閉對話框
        hideCreateGroupModal();

        // 重新載入群組列表
        await loadGroups();

        // 自動選擇新建的群組
        await selectGroup(data.group.id);

        showSuccess('群組建立成功！');

    } catch (error) {
        console.error('❌ 建立群組失敗:', error);
        showError('建立群組失敗：' + error.message);
    }
}

// ===================================
// 群組成員對話框
// ===================================
function showGroupMembers() {
    if (!currentGroup) {
        showError('請先選擇一個群組');
        return;
    }

    document.getElementById('groupMembersModal').style.display = 'flex';
    loadGroupMembers();
}

function hideGroupMembersModal() {
    document.getElementById('groupMembersModal').style.display = 'none';
}

async function loadGroupMembers() {
    try {
        console.log('👥 載入群組成員...');

        const response = await fetch(`${API_BASE_URL}/api/groups/${currentGroup.id}/members`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '載入成員失敗');
        }

        const members = data.members || [];
        console.log(`✅ 載入了 ${members.length} 位成員`);

        renderGroupMembers(members);

    } catch (error) {
        console.error('❌ 載入群組成員失敗:', error);
        showError('載入成員失敗');
    }
}

function renderGroupMembers(members) {
    const membersList = document.getElementById('membersList');

    if (members.length === 0) {
        membersList.innerHTML = '<p style="text-align: center; color: #666;">沒有成員</p>';
        return;
    }

    membersList.innerHTML = members.map(member => {
        const profile = member.user_profiles;
        const roleBadgeClass = member.role === 'admin' ? 'admin' : member.role === 'moderator' ? 'moderator' : 'member';
        const roleText = member.role === 'admin' ? '管理員' : member.role === 'moderator' ? '版主' : '成員';

        return `
            <div class="member-list-item">
                <div class="friend-avatar" style="width: 40px; height: 40px;">
                    ${profile.avatar_url
                        ? `<img src="${profile.avatar_url}" alt="${profile.display_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                        : profile.display_name.charAt(0).toUpperCase()
                    }
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${escapeHtml(profile.display_name)}</div>
                    <div style="font-size: 0.85rem; color: #666;">
                        加入於 ${formatDate(member.joined_at)}
                    </div>
                </div>
                <span class="member-role-badge ${roleBadgeClass}">${roleText}</span>
            </div>
        `;
    }).join('');
}

// ===================================
// 群組設定對話框
// ===================================
function showGroupSettings() {
    if (!currentGroup) {
        showError('請先選擇一個群組');
        return;
    }

    document.getElementById('groupSettingsModal').style.display = 'flex';

    // 填充當前群組資訊
    document.getElementById('editGroupName').value = currentGroup.name || '';
    document.getElementById('editGroupDescription').value = currentGroup.description || '';
    document.getElementById('editGroupAvatarUrl').value = currentGroup.avatar_url || '';
}

function hideGroupSettingsModal() {
    document.getElementById('groupSettingsModal').style.display = 'none';
}

async function updateGroupSettings(event) {
    event.preventDefault();

    const name = document.getElementById('editGroupName').value.trim();
    const description = document.getElementById('editGroupDescription').value.trim();
    const avatarUrl = document.getElementById('editGroupAvatarUrl').value.trim();

    try {
        console.log('💾 更新群組設定...');

        const response = await fetch(`${API_BASE_URL}/api/groups/${currentGroup.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userProfile.id,
                name,
                description,
                avatar_url: avatarUrl
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '更新群組失敗');
        }

        console.log('✅ 群組設定更新成功');

        hideGroupSettingsModal();
        await loadGroups();
        await selectGroup(currentGroup.id);

        showSuccess('群組設定已更新！');

    } catch (error) {
        console.error('❌ 更新群組設定失敗:', error);
        showError('更新失敗：' + error.message);
    }
}

// ===================================
// 離開群組
// ===================================
async function leaveGroup() {
    if (!currentGroup) {
        return;
    }

    if (!confirm(`確定要離開「${currentGroup.name}」嗎？`)) {
        return;
    }

    try {
        console.log('👋 離開群組...');

        // 需要先取得當前使用者的 membership id
        const membersResponse = await fetch(`${API_BASE_URL}/api/groups/${currentGroup.id}/members`);
        const membersData = await membersResponse.json();
        const myMembership = membersData.members.find(m => m.user_id === userProfile.id);

        if (!myMembership) {
            throw new Error('找不到成員資訊');
        }

        const response = await fetch(`${API_BASE_URL}/api/groups/${currentGroup.id}/members/${myMembership.id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userProfile.id
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '離開群組失敗');
        }

        console.log('✅ 已離開群組');

        hideGroupSettingsModal();
        currentGroup = null;

        // 重新載入群組列表
        await loadGroups();

        // 顯示歡迎畫面
        document.getElementById('welcomeScreen').style.display = 'flex';
        document.getElementById('groupChatArea').style.display = 'none';

        showSuccess('已離開群組');

    } catch (error) {
        console.error('❌ 離開群組失敗:', error);
        showError('離開群組失敗：' + error.message);
    }
}

// ===================================
// 新增成員對話框
// ===================================
function showAddMemberModal() {
    document.getElementById('addMemberModal').style.display = 'flex';
}

function hideAddMemberModal() {
    document.getElementById('addMemberModal').style.display = 'none';
    document.getElementById('searchUserInput').value = '';
    document.getElementById('userSearchResults').innerHTML = '';
}

async function searchUsers(event) {
    const searchTerm = event.target.value.trim();

    if (searchTerm.length < 2) {
        document.getElementById('userSearchResults').innerHTML = '';
        return;
    }

    try {
        // 搜尋使用者
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('id, display_name, avatar_url')
            .or(`display_name.ilike.%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        const resultsDiv = document.getElementById('userSearchResults');

        if (data.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">找不到使用者</p>';
            return;
        }

        resultsDiv.innerHTML = data.map(user => `
            <div class="member-list-item" style="cursor: pointer;" onclick="addMemberToGroup('${user.id}', '${escapeHtml(user.display_name)}')">
                <div class="friend-avatar" style="width: 40px; height: 40px;">
                    ${user.avatar_url
                        ? `<img src="${user.avatar_url}" alt="${user.display_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                        : user.display_name.charAt(0).toUpperCase()
                    }
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${escapeHtml(user.display_name)}</div>
                </div>
                <button class="btn-primary" style="padding: 4px 12px; font-size: 0.85rem;">
                    新增
                </button>
            </div>
        `).join('');

    } catch (error) {
        console.error('❌ 搜尋使用者失敗:', error);
        showError('搜尋失敗');
    }
}

async function addMemberToGroup(userId, userName) {
    if (!currentGroup) {
        showError('請先選擇一個群組');
        return;
    }

    try {
        console.log(`➕ 新增成員: ${userName}`);

        const response = await fetch(`${API_BASE_URL}/api/groups/${currentGroup.id}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userProfile.id,
                newMemberId: userId,
                role: 'member'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '新增成員失敗');
        }

        console.log('✅ 成員新增成功');

        hideAddMemberModal();
        showSuccess(`已將 ${userName} 加入群組！`);

        // 重新載入成員列表
        if (document.getElementById('groupMembersModal').style.display === 'flex') {
            await loadGroupMembers();
        }

    } catch (error) {
        console.error('❌ 新增成員失敗:', error);
        showError('新增成員失敗：' + error.message);
    }
}

// ===================================
// 圖片上傳
// ===================================
function selectImage() {
    document.getElementById('imageInput').click();
}

async function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showError('請選擇圖片檔案');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showError('圖片大小不能超過 5MB');
        return;
    }

    try {
        console.log('📤 上傳圖片...');

        const formData = new FormData();
        formData.append('image', file);
        formData.append('userId', userProfile.id);

        const response = await fetch(`${API_BASE_URL}/api/upload/image`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '上傳圖片失敗');
        }

        console.log('✅ 圖片上傳成功:', data.url);

        // 發送圖片訊息
        const messageResponse = await fetch(`${API_BASE_URL}/api/groups/${currentGroup.id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userProfile.id,
                content: '',
                message_type: 'image',
                media_url: data.url
            })
        });

        if (!messageResponse.ok) {
            throw new Error('發送圖片訊息失敗');
        }

        console.log('✅ 圖片訊息發送成功');

        // 清空檔案輸入
        event.target.value = '';

    } catch (error) {
        console.error('❌ 上傳圖片失敗:', error);
        showError('上傳圖片失敗：' + error.message);
    }
}

// ===================================
// 通知相關（placeholder）
// ===================================
function showNotifications() {
    showError('通知功能開發中...');
}

// ===================================
// 工具函數
// ===================================
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '剛剛';
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    if (diffHours < 24) return `${diffHours} 小時前`;
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-TW', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    alert('❌ ' + message);
}

function showSuccess(message) {
    alert('✅ ' + message);
}
