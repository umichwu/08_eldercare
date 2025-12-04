/**
 * 好友聊天頁面主要邏輯
 * ElderCare Social Module
 */

// ===================================
// 全域變數
// ===================================
const SUPABASE_URL = 'https://oatdjdelzybcacwqafkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGRqZGVsenliY2Fjd3FhZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM5ODUsImV4cCI6MjA3Njc3OTk4NX0.Flk-9yHREG7gWr1etG-TEc2ufPjP-zvW2Ejd2gCqG4w';

// API 基礎 URL - 從全域配置讀取 (config.js)
// 注意：API_BASE_URL 已在 config.js 中定義為全域變數，這裡不需要重新宣告

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let userProfile = null;
let currentTab = 'timeline';

// WebRTC 相關變數
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentCallType = null; // 'video' 或 'audio'
let currentCallPeer = null; // 當前通話對象
let callChannel = null; // Supabase Realtime 頻道

// WebRTC 配置
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// ===================================
// 初始化
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 初始化好友聊天頁面...');

    try {
        // 檢查認證
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            console.log('⚠️ 未登入，重定向到登入頁面');
            window.location.href = '/login.html';
            return;
        }

        console.log('✅ 認證通過，載入頁面內容');

        // 載入頁面內容
        await loadPageContent();

        // 訂閱通話信令頻道
        await setupCallSignaling();

        console.log('✅ 好友聊天頁面初始化完成');
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
// 載入頁面內容
// ===================================
async function loadPageContent() {
    // 設定使用者頭像
    const userAvatarPost = document.getElementById('userAvatarPost');
    if (userAvatarPost && userProfile) {
        if (userProfile.avatar_url) {
            userAvatarPost.src = userProfile.avatar_url;
        } else {
            const initial = (userProfile.display_name || currentUser.email).charAt(0).toUpperCase();
            userAvatarPost.src = `https://ui-avatars.com/api/?name=${initial}&background=667eea&color=fff&size=80`;
        }
    }

    // 載入好友列表（預設顯示，不需要切換標籤）
    await loadFriendsList();
}

// ===================================
// 標籤切換
// ===================================
function switchTab(tabName) {
    console.log(`🔄 切換到標籤: ${tabName}`);

    currentTab = tabName;

    // 更新標籤按鈕狀態
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // 更新標籤內容顯示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // 載入標籤內容
    loadTabContent(tabName);
}

// ===================================
// 載入標籤內容
// ===================================
async function loadTabContent(tabName) {
    console.log(`📥 載入標籤內容: ${tabName}`);

    switch (tabName) {
        case 'timeline':
            await loadTimeline();
            break;
        case 'friends':
            await loadFriends();
            break;
        case 'chats':
            await loadChats();
            break;
        default:
            console.warn('⚠️ 未知的標籤:', tabName);
    }
}

// ===================================
// 動態時間軸
// ===================================
async function loadTimeline() {
    const timelineList = document.getElementById('timelineList');
    const noPostsPlaceholder = document.getElementById('noPostsPlaceholder');

    try {
        console.log('📰 載入動態時間軸...');

        // 取得當前使用者
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.error('❌ 未登入');
            return;
        }

        // 取得 session 以獲取 access token
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            console.error('❌ 未找到 session');
            return;
        }

        // 從資料庫載入動態
        const response = await fetch(`${API_BASE_URL}/api/social/posts/timeline?userId=${user.id}&limit=20`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'x-user-id': user.id
            }
        });

        if (!response.ok) {
            throw new Error('載入動態時間軸失敗');
        }

        const result = await response.json();
        const posts = result.posts || [];

        console.log(`✅ 載入了 ${posts.length} 則動態`);

        // 清空現有內容
        timelineList.innerHTML = '';

        if (posts.length === 0) {
            noPostsPlaceholder.style.display = 'block';
        } else {
            noPostsPlaceholder.style.display = 'none';

            // 渲染每則動態
            posts.forEach(post => {
                const postElement = createPostElement(post, user.id);
                timelineList.appendChild(postElement);
            });
        }

        console.log('✅ 動態時間軸載入完成');
    } catch (error) {
        console.error('❌ 載入動態時間軸失敗:', error);
        timelineList.innerHTML = '<p style="text-align: center; color: #999;">載入失敗，請重試</p>';
        showError('載入動態失敗');
    }
}

// ===================================
// 好友列表
// ===================================
async function loadFriendsList() {
    const friendsList = document.getElementById('friendsList');
    const noFriendsPlaceholder = document.getElementById('noFriendsPlaceholder');

    try {
        console.log('👥 載入好友列表...');

        // 載入好友列表
        const { data: friends, error: friendsError } = await supabaseClient
            .from('v_user_friends')
            .select('*')
            .eq('user_id', userProfile.id)
            .order('friends_since', { ascending: false });

        if (friendsError) {
            console.error('❌ 載入好友列表錯誤:', friendsError);
            // 不要拋出錯誤，繼續顯示自己
        }

        console.log('📊 載入好友數量:', friends?.length || 0);

        // 清空列表
        friendsList.innerHTML = '';

        // 首先加入「自己」作為第一個好友（用於速記/自我提醒）
        const selfItem = createSelfItem();
        friendsList.appendChild(selfItem);

        // 然後加入其他好友
        if (friends && friends.length > 0) {
            noFriendsPlaceholder.style.display = 'none';

            friends.forEach(friend => {
                const friendItem = createFriendItem(friend);
                friendsList.appendChild(friendItem);
            });
        } else {
            // 即使沒有其他好友，也不顯示空狀態提示（因為至少有自己）
            noFriendsPlaceholder.style.display = 'none';
        }

        console.log('✅ 好友列表載入完成');
    } catch (error) {
        console.error('❌ 載入好友列表失敗:', error);
        friendsList.innerHTML = '<p style="text-align: center; color: #999;">載入失敗，請重試</p>';
    }
}

// 建立「自己」的列表項目
function createSelfItem() {
    const div = document.createElement('div');
    div.className = 'friend-item self-item';
    div.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    div.style.color = 'white';
    div.style.cursor = 'pointer';

    const avatarUrl = userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.display_name || currentUser.email)}&background=FFB74D&color=fff&size=80`;

    div.innerHTML = `
        <img class="friend-avatar" src="${avatarUrl}" alt="${userProfile.display_name}" style="border: 2px solid white;">
        <div class="friend-info">
            <div class="friend-name" style="color: white; font-weight: 600;">${userProfile.display_name || '我'} (自己)</div>
            <div class="friend-meta" style="color: rgba(255,255,255,0.9);">
                <span>📝 速記/自我提醒</span>
            </div>
        </div>
        <div class="friend-actions">
            <button class="btn-icon" style="background: rgba(255,255,255,0.2); color: white;" onclick="event.stopPropagation(); openChatWithSelf()" title="速記">
                💬
            </button>
        </div>
    `;

    // 點擊整個好友項目就開啟聊天
    div.addEventListener('click', () => {
        // 高亮選中的好友項目
        document.querySelectorAll('.friend-item').forEach(item => {
            item.classList.remove('active');
        });
        div.classList.add('active');

        openChatWithSelf();
    });

    return div;
}

async function loadFriends() {
    const friendsList = document.getElementById('friendsList');
    const noFriendsPlaceholder = document.getElementById('noFriendsPlaceholder');
    const friendRequestsSection = document.getElementById('friendRequestsSection');

    try {
        console.log('👥 載入好友列表...');

        // 載入好友列表
        const { data: friends, error: friendsError } = await supabaseClient
            .from('v_user_friends')
            .select('*')
            .eq('user_id', userProfile.id)
            .order('friends_since', { ascending: false });

        if (friendsError) {
            console.error('❌ 載入好友列表錯誤:', friendsError);
            throw friendsError;
        }

        console.log('📊 載入好友數量:', friends?.length || 0);

        // 載入待處理的好友邀請
        await loadFriendRequests();

        // 渲染好友列表
        if (friends && friends.length > 0) {
            friendsList.innerHTML = '';
            noFriendsPlaceholder.style.display = 'none';

            friends.forEach(friend => {
                const friendItem = createFriendItem(friend);
                friendsList.appendChild(friendItem);
            });
        } else {
            friendsList.innerHTML = '';
            noFriendsPlaceholder.style.display = 'block';
        }

        console.log('✅ 好友列表載入完成');
    } catch (error) {
        console.error('❌ 載入好友列表失敗:', error);
        friendsList.innerHTML = '<p style="text-align: center; color: #999;">載入失敗，請重試</p>';
    }
}

// 建立好友列表項目
function createFriendItem(friend) {
    const div = document.createElement('div');
    div.className = 'friend-item';
    div.style.cursor = 'pointer';

    const avatarUrl = friend.friend_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.friend_name)}&background=667eea&color=fff&size=80`;

    // 計算成為好友的時間
    const friendsSince = formatTimeSince(friend.friends_since);

    div.innerHTML = `
        <img class="friend-avatar" src="${avatarUrl}" alt="${friend.friend_name}">
        <div class="friend-info">
            <div class="friend-name">${friend.friend_name}</div>
            <div class="friend-meta">
                <span>成為好友 ${friendsSince}</span>
                ${friend.relationship_type ? `<span class="relationship-tag">${getRelationshipLabel(friend.relationship_type)}</span>` : ''}
            </div>
        </div>
        <div class="friend-actions">
            <button class="btn-icon" onclick="event.stopPropagation(); openChatWithFriend('${friend.friend_user_id}', '${escapeHtml(friend.friend_name)}', '${avatarUrl}')" title="聊天">
                💬
            </button>
            <button class="btn-icon" onclick="event.stopPropagation(); viewFriendProfile('${friend.friend_user_id}')" title="查看資料">
                👤
            </button>
        </div>
    `;

    // 點擊整個好友項目就開啟聊天
    div.addEventListener('click', (e) => {
        // 高亮選中的好友項目
        document.querySelectorAll('.friend-item').forEach(item => {
            item.classList.remove('active');
        });
        div.classList.add('active');

        openChatWithFriend(friend.friend_user_id, friend.friend_name, avatarUrl);
    });

    return div;
}

// 載入好友邀請
async function loadFriendRequests() {
    const friendRequestsSection = document.getElementById('friendRequestsSection');
    const friendRequestsList = document.getElementById('friendRequestsList');

    try {
        console.log('📬 載入好友邀請...');

        const { data: requests, error } = await supabaseClient
            .from('v_user_friend_requests')
            .select('*')
            .eq('receiver_id', userProfile.id)
            .order('requested_at', { ascending: false });

        if (error) {
            console.error('❌ 載入好友邀請錯誤:', error);
            throw error;
        }

        console.log('📊 待處理邀請數量:', requests?.length || 0);

        if (requests && requests.length > 0) {
            friendRequestsSection.style.display = 'block';
            friendRequestsList.innerHTML = '';

            requests.forEach(request => {
                const requestItem = createFriendRequestItem(request);
                friendRequestsList.appendChild(requestItem);
            });
        } else {
            friendRequestsSection.style.display = 'none';
        }

        console.log('✅ 好友邀請載入完成');
    } catch (error) {
        console.error('❌ 載入好友邀請失敗:', error);
        friendRequestsSection.style.display = 'none';
    }
}

// 建立好友邀請項目
function createFriendRequestItem(request) {
    const div = document.createElement('div');
    div.className = 'friend-request-item';

    const avatarUrl = request.sender_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.sender_name)}&background=667eea&color=fff&size=80`;
    const requestTime = formatTimeSince(request.requested_at);

    div.innerHTML = `
        <img class="friend-avatar" src="${avatarUrl}" alt="${request.sender_name}">
        <div class="friend-info">
            <div class="friend-name">${request.sender_name}</div>
            <div class="friend-meta">想要加你為好友 · ${requestTime}</div>
            ${request.notes ? `<div class="request-notes">${request.notes}</div>` : ''}
        </div>
        <div class="friend-actions">
            <button class="btn-primary btn-sm" onclick="acceptFriendRequest('${request.friendship_id}')">
                接受
            </button>
            <button class="btn-secondary btn-sm" onclick="rejectFriendRequest('${request.friendship_id}')">
                拒絕
            </button>
        </div>
    `;

    return div;
}

// ===================================
// 聊天室列表
// ===================================
async function loadChats() {
    const chatsList = document.getElementById('chatsList');
    const noChatsPlaceholder = document.getElementById('noChatsPlaceholder');

    try {
        console.log('💬 載入聊天室列表...');

        // TODO: 從資料庫載入聊天室列表
        // 目前顯示空白狀態（因為資料庫表格還未建立）

        chatsList.innerHTML = '';
        noChatsPlaceholder.style.display = 'block';

        console.log('✅ 聊天室列表載入完成（目前為空）');
    } catch (error) {
        console.error('❌ 載入聊天室列表失敗:', error);
        chatsList.innerHTML = '<p style="text-align: center; color: #999;">載入失敗，請重試</p>';
    }
}

// ===================================
// 發文模態框
// ===================================
function openPostModal(type = 'text') {
    console.log(`✍️ 開啟發文模態框: ${type}`);
    const modal = document.getElementById('postModal');
    modal.style.display = 'flex';

    // 根據類型調整焦點
    if (type === 'photo') {
        document.getElementById('postImage').click();
    }
}

function closePostModal() {
    console.log('❌ 關閉發文模態框');
    const modal = document.getElementById('postModal');
    modal.style.display = 'none';

    // 清空內容
    document.getElementById('postContent').value = '';
    document.getElementById('postMood').value = '';
    document.getElementById('postVisibility').value = 'friends';
    document.getElementById('imagePreview').innerHTML = '';
}

async function submitPost() {
    const content = document.getElementById('postContent').value.trim();
    const mood = document.getElementById('postMood').value;
    const visibility = document.getElementById('postVisibility').value;

    if (!content) {
        showError('請輸入動態內容');
        return;
    }

    try {
        console.log('📤 發布動態...');
        showLoading();

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            hideLoading();
            showError('請先登入');
            return;
        }

        // 取得 session
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            hideLoading();
            showError('無法取得認證資訊');
            return;
        }

        // 處理圖片（如果有）
        const imagePreview = document.getElementById('imagePreview');
        const mediaUrls = [];
        const images = imagePreview.querySelectorAll('img');
        images.forEach(img => {
            if (img.src) {
                mediaUrls.push(img.src);
            }
        });

        // 發送到後端
        const response = await fetch(`${API_BASE_URL}/api/social/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'x-user-id': user.id
            },
            body: JSON.stringify({
                content: content,
                mood: mood || undefined,
                visibility: visibility,
                mediaUrls: mediaUrls
            })
        });

        if (!response.ok) {
            throw new Error('發布動態失敗');
        }

        const result = await response.json();

        console.log('✅ 動態發布成功:', result);
        closePostModal();
        hideLoading();
        showSuccess('動態發布成功！');

        // 重新載入動態時間軸
        await loadTimeline();
    } catch (error) {
        console.error('❌ 發布動態失敗:', error);
        hideLoading();
        showError('發布失敗，請重試');
    }
}

// publishPost 的別名（用於 HTML 中）
function publishPost() {
    submitPost();
}

// ===================================
// 新增好友模態框
// ===================================
function showAddFriendModal() {
    console.log('➕ 開啟新增好友模態框');
    const modal = document.getElementById('addFriendModal');
    modal.style.display = 'flex';
}

function closeAddFriendModal() {
    console.log('❌ 關閉新增好友模態框');
    const modal = document.getElementById('addFriendModal');
    modal.style.display = 'none';
    document.getElementById('friendSearchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

async function searchUsers(event) {
    const searchTerm = event.target.value.trim();
    const searchResults = document.getElementById('searchResults');

    if (searchTerm.length < 2) {
        searchResults.innerHTML = '';
        return;
    }

    try {
        console.log(`🔍 搜尋使用者: ${searchTerm}`);
        searchResults.innerHTML = '<div class="loading-spinner"></div><p style="text-align: center;">搜尋中...</p>';

        // 使用後端 API 搜尋（支援 email/phone）
        const response = await fetch(`${API_BASE_URL}/api/social/friends/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabaseClient.auth.getSession()).data.session?.access_token}`,
                'X-User-Id': userProfile.id
            },
            body: JSON.stringify({ searchTerm })
        });

        if (!response.ok) {
            throw new Error('搜尋失敗');
        }

        const result = await response.json();
        console.log('📊 搜尋結果:', result);

        searchResults.innerHTML = '';

        if (result.users && result.users.length > 0) {
            // 顯示找到的使用者
            result.users.forEach(user => {
                const userItem = createSearchResultItem(user, user.relationStatus);
                searchResults.appendChild(userItem);
            });
        } else if (result.canInvite) {
            // 沒有找到使用者，但可以邀請新使用者
            const inviteItem = createInviteNewUserItem(searchTerm, result.searchType, result.pendingInvitation);
            searchResults.appendChild(inviteItem);
        } else {
            searchResults.innerHTML = '<p style="text-align: center; color: #999;">找不到符合的使用者</p>';
        }
    } catch (error) {
        console.error('❌ 搜尋失敗:', error);
        searchResults.innerHTML = '<p style="text-align: center; color: #999;">搜尋失敗，請重試</p>';
    }
}

// 建立搜尋結果項目
function createSearchResultItem(user, relationStatus) {
    const div = document.createElement('div');
    div.className = 'search-result-item';

    const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=667eea&color=fff&size=80`;

    let actionButton = '';
    if (!relationStatus) {
        actionButton = `<button class="btn-primary btn-sm" onclick="sendFriendRequest('${user.id}')">➕ 加好友</button>`;
    } else if (relationStatus === 'pending') {
        actionButton = `<button class="btn-secondary btn-sm" disabled>⏳ 待處理</button>`;
    } else if (relationStatus === 'accepted') {
        actionButton = `<button class="btn-secondary btn-sm" disabled>✅ 已是好友</button>`;
    } else if (relationStatus === 'rejected') {
        actionButton = `<button class="btn-secondary btn-sm" onclick="sendFriendRequest('${user.id}')">重新邀請</button>`;
    }

    div.innerHTML = `
        <img class="friend-avatar" src="${avatarUrl}" alt="${user.display_name}">
        <div class="friend-info">
            <div class="friend-name">${user.display_name}</div>
            <div class="friend-meta">${user.email}</div>
        </div>
        <div class="friend-actions">
            ${actionButton}
        </div>
    `;

    return div;
}

// 建立邀請新使用者的項目
function createInviteNewUserItem(searchTerm, searchType, pendingInvitation) {
    const div = document.createElement('div');
    div.className = 'search-result-item invite-new-user';

    const icon = searchType === 'email' ? '📧' : '📱';
    const label = searchType === 'email' ? 'Email' : '電話';

    if (pendingInvitation) {
        // 已經發送過邀請
        div.innerHTML = `
            <div class="invite-icon">${icon}</div>
            <div class="friend-info">
                <div class="friend-name">已發送邀請</div>
                <div class="friend-meta">${searchTerm}</div>
                <div class="friend-meta" style="color: #999; font-size: 12px;">
                    邀請碼: ${pendingInvitation.invitation_code} ·
                    有效期至 ${new Date(pendingInvitation.expires_at).toLocaleDateString()}
                </div>
            </div>
            <div class="friend-actions">
                <button class="btn-secondary btn-sm" onclick="resendInvitation('${pendingInvitation.id}')">
                    📤 重新發送
                </button>
                <button class="btn-secondary btn-sm" onclick="cancelInvitation('${pendingInvitation.id}')">
                    ❌ 取消
                </button>
            </div>
        `;
    } else {
        // 尚未發送邀請
        div.innerHTML = `
            <div class="invite-icon">${icon}</div>
            <div class="friend-info">
                <div class="friend-name">找不到此使用者</div>
                <div class="friend-meta">${searchTerm}</div>
                <div class="friend-meta" style="color: #667eea; font-size: 13px;">
                    💡 您可以邀請此${label}的朋友加入 ElderCare
                </div>
            </div>
            <div class="friend-actions">
                <button class="btn-primary btn-sm" onclick="showInviteNewUserDialog('${searchTerm}', '${searchType}')">
                    📨 發送邀請
                </button>
            </div>
        `;
    }

    return div;
}

// 顯示邀請新使用者對話框
function showInviteNewUserDialog(searchTerm, searchType) {
    const label = searchType === 'email' ? 'Email' : '電話';
    const placeholder = searchType === 'email' ? '輸入對方的姓名（選填）' : '輸入對方的姓名（選填）';

    const dialogHtml = `
        <div class="modal-overlay" id="inviteNewUserModal" onclick="closeInviteNewUserDialog(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>📨 邀請新朋友加入 ElderCare</h3>
                    <button class="modal-close" onclick="closeInviteNewUserDialog()">✕</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 20px; padding: 15px; background: #f0f4ff; border-radius: 8px;">
                        <p style="margin: 0; color: #667eea; font-size: 14px;">
                            📧 ${label}: <strong>${searchTerm}</strong>
                        </p>
                        <p style="margin: 8px 0 0 0; color: #666; font-size: 13px;">
                            此聯絡方式尚未註冊 ElderCare，您可以發送邀請給對方
                        </p>
                    </div>

                    <div class="form-group">
                        <label>對方的姓名（選填）</label>
                        <input type="text" id="inviteeName" class="form-control" placeholder="${placeholder}">
                    </div>

                    <div class="form-group">
                        <label>邀請訊息（選填）</label>
                        <textarea id="inviteMessage" class="form-control" rows="3" placeholder="我覺得這個 App 很適合我們保持聯繫，一起來用吧！"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeInviteNewUserDialog()">取消</button>
                    <button class="btn-primary" onclick="sendInviteToNewUser('${searchTerm}', '${searchType}')">
                        📨 發送邀請
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', dialogHtml);
}

// 關閉邀請對話框
function closeInviteNewUserDialog(event) {
    if (event && event.target.className !== 'modal-overlay') return;
    const modal = document.getElementById('inviteNewUserModal');
    if (modal) {
        modal.remove();
    }
}

// 發送邀請給新使用者
async function sendInviteToNewUser(searchTerm, searchType) {
    try {
        const name = document.getElementById('inviteeName')?.value.trim();
        const message = document.getElementById('inviteMessage')?.value.trim();

        console.log(`📨 發送邀請給新使用者: ${searchTerm} (${searchType})`);
        showLoading();

        const payload = {
            name: name || null,
            message: message || null
        };

        if (searchType === 'email') {
            payload.email = searchTerm;
        } else if (searchType === 'phone') {
            payload.phone = searchTerm;
        }

        const response = await fetch(`${API_BASE_URL}/api/social/friends/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabaseClient.auth.getSession()).data.session?.access_token}`,
                'X-User-Id': userProfile.id
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '發送邀請失敗');
        }

        const result = await response.json();
        console.log('✅ 邀請已發送:', result);

        hideLoading();
        closeInviteNewUserDialog();
        showSuccess('邀請已發送！對方註冊後會自動成為您的好友');

        // 重新搜尋以顯示邀請狀態
        const searchInput = document.getElementById('friendSearchInput');
        if (searchInput && searchInput.value) {
            await searchUsers({ target: searchInput });
        }
    } catch (error) {
        console.error('❌ 發送邀請失敗:', error);
        hideLoading();
        showError(error.message || '發送邀請失敗，請重試');
    }
}

// 重新發送邀請
async function resendInvitation(invitationId) {
    try {
        console.log(`📤 重新發送邀請: ${invitationId}`);
        showLoading();

        // 取得當前使用者的 JWT token
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            throw new Error('請先登入');
        }

        const response = await fetch(`${API_BASE_URL}/api/social/friends/invitations/${invitationId}/resend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'x-user-id': session.user.id
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '重新發送邀請失敗');
        }

        hideLoading();

        // 顯示成功訊息，包含發送結果
        let message = '邀請已重新發送！';
        if (result.notification) {
            const sentMethods = [];
            if (result.notification.emailSent) sentMethods.push('Email');
            if (result.notification.smsSent) sentMethods.push('SMS');
            if (sentMethods.length > 0) {
                message += ` (已透過 ${sentMethods.join(' 和 ')} 發送)`;
            }
        }

        showSuccess(message);

        // 重新載入搜尋結果（如果在搜尋頁面）
        const searchInput = document.getElementById('searchFriends');
        if (searchInput && searchInput.value) {
            await searchFriends();
        }
    } catch (error) {
        console.error('❌ 重新發送邀請失敗:', error);
        hideLoading();
        showError(error.message || '重新發送失敗，請重試');
    }
}

// 取消邀請
async function cancelInvitation(invitationId) {
    if (!confirm('確定要取消此邀請嗎？')) {
        return;
    }

    try {
        console.log(`❌ 取消邀請: ${invitationId}`);
        showLoading();

        const response = await fetch(`${API_BASE_URL}/api/social/friends/invitations/${invitationId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabaseClient.auth.getSession()).data.session?.access_token}`,
                'X-User-Id': userProfile.id
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '取消邀請失敗');
        }

        const result = await response.json();
        console.log('✅ 邀請已取消:', result);

        hideLoading();
        showSuccess('邀請已取消');

        // 重新搜尋以更新狀態
        const searchInput = document.getElementById('friendSearchInput');
        if (searchInput && searchInput.value) {
            await searchUsers({ target: searchInput });
        }
    } catch (error) {
        console.error('❌ 取消邀請失敗:', error);
        hideLoading();
        showError(error.message || '取消邀請失敗，請重試');
    }
}

// 發送好友邀請
async function sendFriendRequest(targetUserId) {
    try {
        console.log(`📤 發送好友邀請給: ${targetUserId}`);
        showLoading();

        // 使用資料庫函數發送邀請
        const { data, error } = await supabaseClient
            .rpc('fn_send_friend_request', { target_user_id: targetUserId });

        if (error) {
            console.error('❌ 發送邀請失敗:', error);
            throw error;
        }

        console.log('✅ 好友邀請已發送');
        hideLoading();
        showSuccess('好友邀請已發送！');

        // 重新觸發搜尋以更新按鈕狀態
        const searchInput = document.getElementById('friendSearchInput');
        if (searchInput && searchInput.value) {
            await searchUsers({ target: searchInput });
        }
    } catch (error) {
        console.error('❌ 發送好友邀請失敗:', error);
        hideLoading();

        if (error.message && error.message.includes('已經是好友')) {
            showError('已經是好友或已有待處理的邀請');
        } else {
            showError('發送邀請失敗，請重試');
        }
    }
}

// 接受好友邀請
async function acceptFriendRequest(friendshipId) {
    try {
        console.log(`✅ 接受好友邀請: ${friendshipId}`);
        showLoading();

        // 使用資料庫函數接受邀請
        const { data, error } = await supabaseClient
            .rpc('fn_accept_friend_request', { friendship_id: friendshipId });

        if (error) {
            console.error('❌ 接受邀請失敗:', error);
            throw error;
        }

        console.log('✅ 已接受好友邀請');
        hideLoading();
        showSuccess('已接受好友邀請！');

        // 重新載入好友列表
        await loadFriends();
    } catch (error) {
        console.error('❌ 接受好友邀請失敗:', error);
        hideLoading();
        showError('接受邀請失敗，請重試');
    }
}

// 拒絕好友邀請
async function rejectFriendRequest(friendshipId) {
    try {
        console.log(`❌ 拒絕好友邀請: ${friendshipId}`);
        showLoading();

        // 使用資料庫函數拒絕邀請
        const { data, error } = await supabaseClient
            .rpc('fn_reject_friend_request', { friendship_id: friendshipId });

        if (error) {
            console.error('❌ 拒絕邀請失敗:', error);
            throw error;
        }

        console.log('✅ 已拒絕好友邀請');
        hideLoading();
        showSuccess('已拒絕好友邀請');

        // 重新載入好友列表
        await loadFriends();
    } catch (error) {
        console.error('❌ 拒絕好友邀請失敗:', error);
        hideLoading();
        showError('拒絕邀請失敗，請重試');
    }
}

// ===================================
// 通知相關
// ===================================
function showNotifications() {
    console.log('🔔 開啟通知列表');
    const modal = document.getElementById('notificationsModal');
    modal.style.display = 'flex';
    loadNotifications();
}

function closeNotificationsModal() {
    console.log('❌ 關閉通知列表');
    const modal = document.getElementById('notificationsModal');
    modal.style.display = 'none';
}

async function loadNotifications() {
    const notificationsList = document.getElementById('notificationsList');

    try {
        console.log('📥 載入通知...');

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            notificationsList.innerHTML = '<p style="text-align: center; color: #999;">請先登入</p>';
            return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            notificationsList.innerHTML = '<p style="text-align: center; color: #999;">無法取得認證資訊</p>';
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/social/notifications?userId=${user.id}&limit=20`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'x-user-id': user.id
            }
        });

        if (!response.ok) {
            throw new Error('載入通知失敗');
        }

        const result = await response.json();
        const notifications = result.notifications || [];

        notificationsList.innerHTML = '';

        if (notifications.length === 0) {
            notificationsList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">目前沒有通知</p>';
            return;
        }

        notifications.forEach(notification => {
            const notifElement = createNotificationElement(notification);
            notificationsList.appendChild(notifElement);
        });

        console.log(`✅ 已載入 ${notifications.length} 則通知`);
    } catch (error) {
        console.error('❌ 載入通知失敗:', error);
        notificationsList.innerHTML = '<p style="text-align: center; color: #999;">載入失敗，請重試</p>';
    }
}

/**
 * 建立通知元素
 */
function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = `notification-item ${notification.is_read ? '' : 'unread'}`;
    div.dataset.notificationId = notification.id;

    const avatarUrl = notification.actor_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.actor_name || 'User')}&background=667eea&color=fff&size=60`;
    const actorName = notification.actor_name || '某位用戶';
    const timeAgo = formatTimeAgo(notification.created_at);

    // 根據通知類型顯示不同圖示和文字
    let icon = '🔔';
    let actionText = '';

    switch (notification.notification_type) {
        case 'like':
            icon = '❤️';
            actionText = '按讚了你的動態';
            break;
        case 'comment':
            icon = '💬';
            actionText = '留言了你的動態';
            break;
        case 'friend_request':
            icon = '👋';
            actionText = '向你發送好友邀請';
            break;
        case 'friend_accepted':
            icon = '✅';
            actionText = '接受了你的好友邀請';
            break;
        case 'mention':
            icon = '📢';
            actionText = '在動態中提到你';
            break;
        default:
            actionText = notification.message || '有新的通知';
    }

    div.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <img class="notification-avatar" src="${avatarUrl}" alt="${actorName}">
        <div class="notification-content">
            <div class="notification-text">
                <strong>${actorName}</strong> ${actionText}
            </div>
            <div class="notification-time">${timeAgo}</div>
        </div>
        ${!notification.is_read ? '<div class="notification-badge"></div>' : ''}
    `;

    // 點擊通知時標記為已讀並跳轉
    div.addEventListener('click', async () => {
        if (!notification.is_read) {
            await markNotificationAsRead(notification.id);
        }

        // 根據通知類型跳轉
        if (notification.target_type === 'post' && notification.target_id) {
            // 跳轉到動態（可以實作滾動到該動態）
            closeNotificationsModal();
            showTab('timeline');
        } else if (notification.target_type === 'friend_request') {
            closeNotificationsModal();
            // 可以打開好友邀請列表
        }
    });

    return div;
}

/**
 * 標記單一通知為已讀
 */
async function markNotificationAsRead(notificationId) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;

        const response = await fetch(`${API_BASE_URL}/api/social/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'x-user-id': user.id
            }
        });

        if (response.ok) {
            // 更新 UI
            const notifElement = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (notifElement) {
                notifElement.classList.remove('unread');
                const badge = notifElement.querySelector('.notification-badge');
                if (badge) badge.remove();
            }
        }
    } catch (error) {
        console.error('標記通知失敗:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        console.log('✅ 標記所有通知為已讀');

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            showError('請先登入');
            return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            showError('無法取得認證資訊');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/social/notifications/mark-all-read`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'x-user-id': user.id
            }
        });

        if (response.ok) {
            showSuccess('已標記所有通知為已讀');
            await loadNotifications();
        } else {
            throw new Error('標記失敗');
        }
    } catch (error) {
        console.error('❌ 標記失敗:', error);
        showError('操作失敗，請重試');
    }
}

// ===================================
// 搜尋好友
// ===================================
function showSearch() {
    console.log('🔍 開啟搜尋功能');
    showAddFriendModal();
}

function filterFriends(event) {
    const searchTerm = event.target.value.toLowerCase();
    const friendItems = document.querySelectorAll('.friend-item');

    friendItems.forEach(item => {
        const name = item.querySelector('.friend-name').textContent.toLowerCase();
        if (name.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ===================================
// 新聊天
// ===================================
function showNewChatModal() {
    console.log('💬 開啟新聊天');
    showAddFriendModal(); // 暫時使用新增好友模態框
}

// ===================================
// UI 輔助函數
// ===================================
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showSuccess(message) {
    alert(`✅ ${message}`);
}

function showError(message) {
    alert(`❌ ${message}`);
}

// ===================================
// 圖片預覽
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    const postImageInput = document.getElementById('postImage');
    if (postImageInput) {
        postImageInput.addEventListener('change', (event) => {
            const files = event.target.files;
            const preview = document.getElementById('imagePreview');
            preview.innerHTML = '';

            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = document.createElement('img');
                        img.src = e.target.result;
                        preview.appendChild(img);
                    };
                    reader.readAsDataURL(file);
                }
            });
        });
    }
});

// ===================================
// 輔助函數
// ===================================

// 格式化時間（多久前）
function formatTimeSince(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) {
        return '剛剛';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} 分鐘前`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} 小時前`;
    }

    const days = Math.floor(hours / 24);
    if (days < 30) {
        return `${days} 天前`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
        return `${months} 個月前`;
    }

    const years = Math.floor(months / 12);
    return `${years} 年前`;
}

// 取得關係類型標籤
function getRelationshipLabel(type) {
    const labels = {
        'family': '👨‍👩‍👧 家人',
        'friend': '👫 朋友',
        'close_friend': '💖 摯友',
        'acquaintance': '👋 認識'
    };
    return labels[type] || type;
}

// 開啟與自己的聊天（速記功能）
function openChatWithSelf() {
    console.log('📝 開啟速記功能（與自己聊天）');

    // 隱藏歡迎畫面和動態時間軸
    const welcomeScreen = document.getElementById('welcomeScreen');
    const timelineArea = document.getElementById('timelineArea');
    const friendContentArea = document.getElementById('friendContentArea');

    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (timelineArea) timelineArea.style.display = 'none';
    if (friendContentArea) friendContentArea.style.display = 'block';

    // 設定選中好友的資訊為自己
    const selectedFriendAvatar = document.getElementById('selectedFriendAvatar');
    const selectedFriendName = document.getElementById('selectedFriendName');
    const selectedFriendStatus = document.getElementById('selectedFriendStatus');

    const avatarUrl = userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.display_name || currentUser.email)}&background=FFB74D&color=fff&size=80`;

    if (selectedFriendAvatar) selectedFriendAvatar.src = avatarUrl;
    if (selectedFriendName) selectedFriendName.textContent = `${userProfile.display_name || '我'} (速記)`;
    if (selectedFriendStatus) selectedFriendStatus.textContent = '📝 給自己的提醒與速記';

    // 切換到聊天標籤
    switchContentTab('chat');

    // 載入與自己的聊天記錄
    loadChatWithSelf();
}

// 載入與自己的聊天記錄
async function loadChatWithSelf() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    try {
        console.log('📝 載入私人速記...');

        // 從資料庫載入與自己的聊天記錄
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.error('❌ 未登入');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/social/messages/${user.id}?userId=${user.id}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('載入私人速記失敗');
        }

        const result = await response.json();
        const messages = result.messages || [];

        // 儲存當前聊天對象為自己
        window.currentChatFriend = {
            userId: user.id,
            name: '私人速記',
            isSelf: true
        };

        // 渲染訊息
        renderChatMessages(messages, user.id, '私人速記');

        // 如果沒有訊息，顯示歡迎訊息
        if (messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="chat-date-divider">
                    <span>今天</span>
                </div>
                <div style="text-align: center; padding: 40px 20px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                    <p>這是您的私人速記空間</p>
                    <p style="font-size: 14px; margin-top: 8px;">在這裡記錄想法、待辦事項或重要提醒</p>
                </div>
            `;
        }

        // 批次標記已讀（對自己的訊息）
        await markMessagesAsRead(user.id);

    } catch (error) {
        console.error('載入私人速記失敗:', error);
        showError('載入私人速記失敗');
    }
}

// 載入與好友的聊天記錄
async function loadChatWithFriend(friendUserId, friendName) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    try {
        console.log(`📥 載入與 ${friendName} 的聊天記錄...`);

        // 取得當前使用者
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.error('❌ 未登入');
            return;
        }

        // 從資料庫載入聊天記錄
        const response = await fetch(`${API_BASE_URL}/api/social/messages/${friendUserId}?userId=${user.id}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('載入聊天記錄失敗');
        }

        const result = await response.json();
        const messages = result.messages || [];

        // 儲存當前聊天對象（用於發送訊息）
        window.currentChatFriend = {
            userId: friendUserId,
            name: friendName,
            isSelf: false
        };

        // 渲染訊息
        renderChatMessages(messages, user.id, friendName);

        // 如果沒有訊息，顯示歡迎訊息
        if (messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="chat-date-divider">
                    <span>今天</span>
                </div>
                <div style="text-align: center; padding: 40px 20px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
                    <p>開始與 ${friendName} 聊天吧！</p>
                    <p style="font-size: 14px; margin-top: 8px;">這是您和 ${friendName} 的對話空間</p>
                </div>
            `;
        }

        // 批次標記已讀
        await markMessagesAsRead(friendUserId);

    } catch (error) {
        console.error('載入聊天記錄失敗:', error);
        showError('載入聊天記錄失敗');
    }
}

// 切換內容標籤（聊天/動態）
function switchContentTab(tabName) {
    console.log(`🔄 切換內容標籤: ${tabName}`);

    // 更新標籤按鈕狀態
    document.querySelectorAll('.content-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // 更新標籤內容顯示
    const chatContent = document.getElementById('chatContent');
    const postsContent = document.getElementById('postsContent');

    if (tabName === 'chat') {
        if (chatContent) chatContent.style.display = 'flex';
        if (postsContent) postsContent.style.display = 'none';
    } else if (tabName === 'posts') {
        if (chatContent) chatContent.style.display = 'none';
        if (postsContent) postsContent.style.display = 'block';
    }
}

// 切換到動態時間軸
function switchToTimeline() {
    console.log('📰 切換到動態時間軸');

    // 隱藏其他區域
    const welcomeScreen = document.getElementById('welcomeScreen');
    const friendContentArea = document.getElementById('friendContentArea');
    const timelineArea = document.getElementById('timelineArea');

    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (friendContentArea) friendContentArea.style.display = 'none';
    if (timelineArea) timelineArea.style.display = 'block';

    // 載入動態時間軸
    loadTimeline();
}

// 開啟與好友聊天
function openChatWithFriend(friendUserId, friendName, friendAvatar) {
    console.log(`💬 開啟與好友的聊天: ${friendUserId} - ${friendName}`);

    // 隱藏歡迎畫面和動態時間軸
    const welcomeScreen = document.getElementById('welcomeScreen');
    const timelineArea = document.getElementById('timelineArea');
    const friendContentArea = document.getElementById('friendContentArea');

    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (timelineArea) timelineArea.style.display = 'none';
    if (friendContentArea) friendContentArea.style.display = 'block';

    // 設定選中好友的資訊
    const selectedFriendAvatar = document.getElementById('selectedFriendAvatar');
    const selectedFriendName = document.getElementById('selectedFriendName');
    const selectedFriendStatus = document.getElementById('selectedFriendStatus');

    if (selectedFriendAvatar) selectedFriendAvatar.src = friendAvatar;
    if (selectedFriendName) selectedFriendName.textContent = friendName;
    if (selectedFriendStatus) selectedFriendStatus.textContent = '線上';

    // 切換到聊天標籤
    switchContentTab('chat');

    // 載入與好友的聊天記錄
    loadChatWithFriend(friendUserId, friendName);
}

// 查看好友資料
function viewFriendProfile(friendUserId) {
    console.log(`👤 查看好友資料: ${friendUserId}`);
    // TODO: 實作個人資料頁面
    showError('個人資料頁面開發中...');
}

// ===================================
// WebRTC 通話功能
// ===================================

// 開始視訊通話
async function startVideoCall() {
    console.log('📹 開始視訊通話');

    if (!window.currentChatFriend) {
        showError('請先選擇要通話的好友');
        return;
    }

    await initiateCall('video', window.currentChatFriend.userId, window.currentChatFriend.name);
}

// 開始語音通話
async function startVoiceCall() {
    console.log('📞 開始語音通話');

    if (!window.currentChatFriend) {
        showError('請先選擇要通話的好友');
        return;
    }

    await initiateCall('audio', window.currentChatFriend.userId, window.currentChatFriend.name);
}

// 發起通話
async function initiateCall(type, targetUserId, targetUserName) {
    try {
        console.log(`📞 發起${type === 'video' ? '視訊' : '語音'}通話給:`, targetUserName);

        currentCallType = type;
        currentCallPeer = {
            userId: targetUserId,
            name: targetUserName
        };

        // 請求媒體權限
        const constraints = {
            audio: true,
            video: type === 'video' ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } : false
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);

        // 顯示通話視窗
        showCallModal(type);

        // 顯示本地視訊/頭像
        if (type === 'video') {
            document.getElementById('localVideo').srcObject = localStream;
            document.getElementById('localVideo').style.display = 'block';
            document.getElementById('localAvatar').style.display = 'none';
            document.getElementById('toggleVideoBtn').style.display = 'block';
            document.getElementById('switchCameraBtn').style.display = 'block';
        } else {
            document.getElementById('localVideo').style.display = 'none';
            document.getElementById('localAvatar').style.display = 'flex';
            const avatarUrl = userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.display_name)}&background=FFB74D&color=fff&size=80`;
            document.getElementById('localAvatarImg').src = avatarUrl;
        }

        // 設定對方頭像（尚未連線前顯示）
        const remoteAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(targetUserName)}&background=667eea&color=fff&size=200`;
        document.getElementById('remoteAvatarImg').src = remoteAvatarUrl;
        document.getElementById('remoteName').textContent = targetUserName;
        document.getElementById('remoteAvatar').style.display = 'flex';
        document.getElementById('remoteVideo').style.display = 'none';

        // 更新狀態
        document.getElementById('callStatus').textContent = `撥打中...`;

        // 建立 PeerConnection
        await createPeerConnection();

        // 添加本地流到 PeerConnection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // 創建 offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // 透過 Supabase Realtime 發送通話邀請
        await sendCallSignal({
            type: 'call-offer',
            from: userProfile.id,
            fromName: userProfile.display_name,
            to: targetUserId,
            toName: targetUserName,
            callType: type,
            offer: offer
        });

        console.log('✅ 通話邀請已發送');

    } catch (error) {
        console.error('❌ 發起通話失敗:', error);

        if (error.name === 'NotAllowedError') {
            showError('請允許使用攝影機和麥克風權限');
        } else if (error.name === 'NotFoundError') {
            showError('找不到攝影機或麥克風設備');
        } else {
            showError('無法發起通話: ' + error.message);
        }

        endCall();
    }
}

// 建立 PeerConnection
async function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    // 監聽 ICE 候選
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('🧊 發送 ICE candidate');
            sendCallSignal({
                type: 'ice-candidate',
                from: userProfile.id,
                to: currentCallPeer.userId,
                candidate: event.candidate
            });
        }
    };

    // 監聽遠端流
    peerConnection.ontrack = (event) => {
        console.log('📥 接收到遠端媒體流');
        remoteStream = event.streams[0];

        const remoteVideo = document.getElementById('remoteVideo');
        remoteVideo.srcObject = remoteStream;

        // 如果是視訊通話，顯示視訊
        if (currentCallType === 'video') {
            remoteVideo.style.display = 'block';
            document.getElementById('remoteAvatar').style.display = 'none';
        }

        // 更新狀態為通話中
        document.getElementById('callStatus').textContent = `通話中 - ${currentCallPeer.name}`;
        startCallTimer();
    };

    // 監聽連線狀態
    peerConnection.onconnectionstatechange = () => {
        console.log('🔗 連線狀態:', peerConnection.connectionState);

        if (peerConnection.connectionState === 'connected') {
            console.log('✅ WebRTC 連線成功');
        } else if (peerConnection.connectionState === 'disconnected' ||
                   peerConnection.connectionState === 'failed') {
            console.log('❌ WebRTC 連線中斷');
            endCall();
        }
    };
}

// 發送信令訊息
async function sendCallSignal(signal) {
    try {
        // 使用 Supabase Realtime broadcast
        if (!callChannel) {
            const channelName = `call:${userProfile.id}`;
            callChannel = supabaseClient.channel(channelName);
            await callChannel.subscribe();
        }

        await callChannel.send({
            type: 'broadcast',
            event: 'call-signal',
            payload: signal
        });

        console.log('📤 信令已發送:', signal.type);
    } catch (error) {
        console.error('❌ 發送信令失敗:', error);
    }
}

// 接收來電
function showIncomingCall(callData) {
    console.log('📞 收到來電:', callData);

    // 儲存來電資訊
    window.incomingCallData = callData;

    // 顯示來電通知
    const incomingCallAlert = document.getElementById('incomingCallAlert');
    const callerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(callData.fromName)}&background=667eea&color=fff&size=100`;

    document.getElementById('incomingCallerAvatar').src = callerAvatar;
    document.getElementById('incomingCallerName').textContent = callData.fromName;
    document.getElementById('incomingCallType').textContent = callData.callType === 'video' ? '📹 視訊通話' : '📞 語音通話';

    incomingCallAlert.style.display = 'block';

    // 播放鈴聲（可選）
    // const ringtone = new Audio('/sounds/ringtone.mp3');
    // ringtone.loop = true;
    // ringtone.play();
}

// 接聽來電
async function acceptCall() {
    try {
        console.log('✅ 接聽來電');

        const callData = window.incomingCallData;
        if (!callData) return;

        // 隱藏來電通知
        document.getElementById('incomingCallAlert').style.display = 'none';

        currentCallType = callData.callType;
        currentCallPeer = {
            userId: callData.from,
            name: callData.fromName
        };

        // 請求媒體權限
        const constraints = {
            audio: true,
            video: callData.callType === 'video' ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } : false
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);

        // 顯示通話視窗
        showCallModal(callData.callType);

        // 顯示本地視訊/頭像
        if (callData.callType === 'video') {
            document.getElementById('localVideo').srcObject = localStream;
            document.getElementById('localVideo').style.display = 'block';
            document.getElementById('localAvatar').style.display = 'none';
            document.getElementById('toggleVideoBtn').style.display = 'block';
        } else {
            document.getElementById('localVideo').style.display = 'none';
            document.getElementById('localAvatar').style.display = 'flex';
            const avatarUrl = userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.display_name)}&background=FFB74D&color=fff&size=80`;
            document.getElementById('localAvatarImg').src = avatarUrl;
        }

        // 建立 PeerConnection
        await createPeerConnection();

        // 添加本地流
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // 設定遠端 offer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));

        // 創建 answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // 發送 answer
        await sendCallSignal({
            type: 'call-answer',
            from: userProfile.id,
            to: callData.from,
            answer: answer
        });

        document.getElementById('callStatus').textContent = `通話中 - ${callData.fromName}`;

        console.log('✅ 已接聽來電');

    } catch (error) {
        console.error('❌ 接聽來電失敗:', error);
        showError('無法接聽通話: ' + error.message);
        endCall();
    }
}

// 拒絕來電
function rejectCall() {
    console.log('❌ 拒絕來電');

    const callData = window.incomingCallData;
    if (callData) {
        // 發送拒絕信令
        sendCallSignal({
            type: 'call-rejected',
            from: userProfile.id,
            to: callData.from
        });
    }

    document.getElementById('incomingCallAlert').style.display = 'none';
    window.incomingCallData = null;
}

// 顯示通話視窗
function showCallModal(type) {
    const callModal = document.getElementById('callModal');
    callModal.style.display = 'flex';
}

// 結束通話
function endCall() {
    console.log('📴 結束通話');

    // 停止所有媒體軌道
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }

    // 關閉 PeerConnection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // 關閉 Realtime 頻道
    if (callChannel) {
        callChannel.unsubscribe();
        callChannel = null;
    }

    // 發送結束通話信令
    if (currentCallPeer) {
        sendCallSignal({
            type: 'call-ended',
            from: userProfile.id,
            to: currentCallPeer.userId
        });
    }

    // 停止計時器
    stopCallTimer();

    // 隱藏通話視窗
    document.getElementById('callModal').style.display = 'none';
    document.getElementById('incomingCallAlert').style.display = 'none';

    // 重置狀態
    currentCallType = null;
    currentCallPeer = null;
    window.incomingCallData = null;
}

// 切換麥克風
function toggleMic() {
    if (!localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const micIcon = document.getElementById('micIcon');
        const micBtn = document.getElementById('toggleMicBtn');

        if (audioTrack.enabled) {
            micIcon.textContent = '🎤';
            micBtn.classList.remove('muted');
        } else {
            micIcon.textContent = '🔇';
            micBtn.classList.add('muted');
        }

        console.log('🎤 麥克風:', audioTrack.enabled ? '開啟' : '關閉');
    }
}

// 切換視訊
function toggleVideo() {
    if (!localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const videoIcon = document.getElementById('videoIcon');
        const videoBtn = document.getElementById('toggleVideoBtn');

        if (videoTrack.enabled) {
            videoIcon.textContent = '📹';
            videoBtn.classList.remove('muted');
            document.getElementById('localVideo').style.display = 'block';
            document.getElementById('localAvatar').style.display = 'none';
        } else {
            videoIcon.textContent = '🚫';
            videoBtn.classList.add('muted');
            document.getElementById('localVideo').style.display = 'none';
            document.getElementById('localAvatar').style.display = 'flex';
        }

        console.log('📹 視訊:', videoTrack.enabled ? '開啟' : '關閉');
    }
}

// 切換鏡頭（前/後）
async function switchCamera() {
    if (!localStream) return;

    try {
        const videoTrack = localStream.getVideoTracks()[0];
        const currentFacingMode = videoTrack.getSettings().facingMode;
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

        // 停止當前視訊軌道
        videoTrack.stop();

        // 獲取新的視訊流
        const newStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: newFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        const newVideoTrack = newStream.getVideoTracks()[0];

        // 替換 PeerConnection 中的視訊軌道
        if (peerConnection) {
            const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }
        }

        // 更新本地流
        localStream.removeTrack(videoTrack);
        localStream.addTrack(newVideoTrack);
        document.getElementById('localVideo').srcObject = localStream;

        console.log('🔄 已切換鏡頭:', newFacingMode);

    } catch (error) {
        console.error('❌ 切換鏡頭失敗:', error);
        showError('無法切換鏡頭');
    }
}

// 通話計時器
let callTimerInterval = null;
let callStartTime = null;

function startCallTimer() {
    callStartTime = Date.now();
    callTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        document.getElementById('callTimer').textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callStartTime = null;
    document.getElementById('callTimer').textContent = '00:00';
}

// 設定通話信令監聽
async function setupCallSignaling() {
    try {
        console.log('🔔 設定通話信令監聽...');

        // 訂閱用戶專屬的通話頻道
        const channelName = `call:${userProfile.id}`;
        const channel = supabaseClient.channel(channelName);

        // 監聽來自其他用戶的通話信令
        channel.on('broadcast', { event: 'call-signal' }, async (payload) => {
            const signal = payload.payload;
            console.log('📨 收到信令:', signal.type, 'from:', signal.from);

            // 確認是發給自己的信令
            if (signal.to !== userProfile.id) {
                return;
            }

            switch (signal.type) {
                case 'call-offer':
                    // 收到通話邀請
                    showIncomingCall(signal);
                    break;

                case 'call-answer':
                    // 對方接聽了通話
                    if (peerConnection && signal.answer) {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
                        console.log('✅ 對方已接聽');
                    }
                    break;

                case 'ice-candidate':
                    // 收到 ICE 候選
                    if (peerConnection && signal.candidate) {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        console.log('🧊 已添加 ICE candidate');
                    }
                    break;

                case 'call-rejected':
                    // 對方拒絕了通話
                    console.log('❌ 對方拒絕了通話');
                    showError('對方拒絕了通話');
                    endCall();
                    break;

                case 'call-ended':
                    // 對方結束了通話
                    console.log('📴 對方結束了通話');
                    endCall();
                    break;
            }
        });

        await channel.subscribe();
        console.log('✅ 通話信令監聽已設定');

    } catch (error) {
        console.error('❌ 設定通話信令監聽失敗:', error);
    }
}

// 全域變數：當前選擇的圖片
let currentChatImage = null;

// 顯示表情符號選擇器
function showEmojiPicker() {
    console.log('😊 顯示表情符號選擇器');

    if (!window.UploadUtils) {
        console.error('❌ UploadUtils 未載入');
        showError('表情符號功能尚未載入');
        return;
    }

    window.UploadUtils.showEmojiPicker((emoji) => {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value += emoji;
            chatInput.focus();
        }
    });
}

// 選擇圖片（聊天訊息）
async function selectImage() {
    console.log('📷 選擇圖片');

    if (!window.UploadUtils) {
        console.error('❌ UploadUtils 未載入');
        showError('圖片上傳功能尚未載入');
        return;
    }

    try {
        const files = await window.UploadUtils.selectImageFile({ multiple: false });
        const file = files[0];

        console.log(`✅ 已選擇圖片: ${file.name}`);

        // 預覽圖片
        const previewUrl = await window.UploadUtils.previewImage(file);

        // 儲存選擇的檔案
        currentChatImage = file;

        // 顯示預覽（可以在聊天輸入框上方）
        showImagePreview(previewUrl);

    } catch (error) {
        console.error('❌ 選擇圖片失敗:', error);
        if (error.message !== '使用者取消選擇') {
            showError('選擇圖片失敗: ' + error.message);
        }
    }
}

// 顯示圖片預覽（聊天）
function showImagePreview(previewUrl) {
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

    // 移除舊的預覽
    const oldPreview = document.querySelector('.chat-image-preview');
    if (oldPreview) {
        oldPreview.remove();
    }

    // 建立新的預覽
    const preview = document.createElement('div');
    preview.className = 'chat-image-preview';
    preview.innerHTML = `
        <div class="preview-wrapper">
            <img src="${previewUrl}" alt="預覽圖片">
            <button class="remove-preview-btn" onclick="removeChatImagePreview()">✕</button>
        </div>
    `;

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.parentElement.insertBefore(preview, chatInput);
    }
}

// 移除聊天圖片預覽
function removeChatImagePreview() {
    currentChatImage = null;
    const preview = document.querySelector('.chat-image-preview');
    if (preview) {
        preview.remove();
    }
}

// 暴露給全域
window.removeChatImagePreview = removeChatImagePreview;

// 發送訊息（支援文字和圖片）
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    const message = chatInput.value.trim();

    // 檢查是否有訊息或圖片
    if (!message && !currentChatImage) {
        return;
    }

    console.log('📤 發送訊息:', message, currentChatImage ? '(含圖片)' : '');

    try {
        // 取得當前使用者
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.error('❌ 未登入');
            showError('請先登入');
            return;
        }

        // 檢查是否有選擇聊天對象
        if (!window.currentChatFriend) {
            console.error('❌ 沒有選擇聊天對象');
            showError('請先選擇聊天對象');
            return;
        }

        let mediaUrl = null;
        let messageType = 'text';

        // 如果有圖片，先上傳
        if (currentChatImage) {
            try {
                console.log('📤 上傳圖片中...');
                showError('上傳圖片中...', 'info');

                mediaUrl = await window.UploadUtils.uploadImage(
                    currentChatImage,
                    userProfile.id,
                    'chat',
                    true
                );

                messageType = 'image';
                console.log('✅ 圖片上傳成功:', mediaUrl);

            } catch (error) {
                console.error('❌ 圖片上傳失敗:', error);
                showError('圖片上傳失敗: ' + error.message);
                return;
            }
        }

        // 發送訊息到資料庫
        const response = await fetch(`${API_BASE_URL}/api/social/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userProfile.id,
                receiverUserId: window.currentChatFriend.id,
                messageText: message || '',
                messageType: messageType,
                mediaUrl: mediaUrl
            })
        });

        if (!response.ok) {
            throw new Error('發送訊息失敗');
        }

        const result = await response.json();
        const savedMessage = result.message;

        console.log('✅ 訊息已發送:', savedMessage.id);

        // 清空輸入框和圖片
        chatInput.value = '';
        removeChatImagePreview();

        // 顯示訊息在聊天室中
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            // 移除歡迎訊息（如果存在）
            const welcomeMessage = chatMessages.querySelector('div[style*="text-align: center"]');
            if (welcomeMessage && welcomeMessage.parentElement) {
                welcomeMessage.parentElement.remove();
            }

            // 添加新訊息
            const messageDiv = createMessageElement(savedMessage, userProfile.id);
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

    } catch (error) {
        console.error('❌ 發送訊息失敗:', error);
        showError('發送訊息失敗: ' + error.message);
    }
}

// 處理聊天輸入框的鍵盤事件
function handleChatKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// HTML 轉義函數
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// 聊天訊息相關輔助函數
// ============================================================================

/**
 * 渲染聊天訊息列表
 */
function renderChatMessages(messages, currentUserId, friendName) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    // 清空現有訊息
    chatMessages.innerHTML = '';

    // 依日期分組訊息
    const messagesByDate = groupMessagesByDate(messages);

    // 渲染每個日期的訊息
    Object.keys(messagesByDate).forEach(date => {
        // 添加日期分隔線
        const dateDivider = document.createElement('div');
        dateDivider.className = 'chat-date-divider';
        dateDivider.innerHTML = `<span>${formatDateDivider(date)}</span>`;
        chatMessages.appendChild(dateDivider);

        // 渲染該日期的所有訊息
        messagesByDate[date].forEach(msg => {
            const messageDiv = createMessageElement(msg, currentUserId);
            chatMessages.appendChild(messageDiv);
        });
    });

    // 滾動到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 創建單一訊息元素
 */
function createMessageElement(message, currentUserId) {
    const messageDiv = document.createElement('div');

    // 判斷是自己還是對方的訊息
    const isSender = message.sender?.auth_user_id === currentUserId;
    messageDiv.className = `chat-message ${isSender ? 'me' : 'friend'}`;

    const messageTime = new Date(message.created_at).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(message.message_text)}</div>
            <div class="message-time">${messageTime}</div>
        </div>
    `;

    return messageDiv;
}

/**
 * 依日期分組訊息
 */
function groupMessagesByDate(messages) {
    const groups = {};

    messages.forEach(msg => {
        const date = new Date(msg.created_at).toLocaleDateString('zh-TW');
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(msg);
    });

    return groups;
}

/**
 * 格式化日期分隔線
 */
function formatDateDivider(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = date.toLocaleDateString('zh-TW');
    const todayStr = today.toLocaleDateString('zh-TW');
    const yesterdayStr = yesterday.toLocaleDateString('zh-TW');

    if (dateStr === todayStr) {
        return '今天';
    } else if (dateStr === yesterdayStr) {
        return '昨天';
    } else {
        return date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' });
    }
}

/**
 * 批次標記訊息為已讀
 */
async function markMessagesAsRead(friendUserId) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const response = await fetch(`${API_BASE_URL}/api/social/messages/batch-read`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.id,
                friendUserId: friendUserId
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`✅ 已標記 ${result.count} 則訊息為已讀`);
        }
    } catch (error) {
        console.error('標記已讀失敗:', error);
    }
}

// ===================================
// 動態貼文相關函數
// ===================================

/**
 * 建立動態貼文元素
 */
function createPostElement(post, currentUserId) {
    const div = document.createElement('div');
    div.className = 'timeline-post';
    div.dataset.postId = post.post_id || post.id;

    const authorAvatar = post.author_avatar || post.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || post.display_name || 'User')}&background=667eea&color=fff&size=80`;
    const authorName = post.author_name || post.display_name || '未知用戶';
    const postTime = formatTimeAgo(post.created_at);
    const content = escapeHtml(post.content || '');
    const mood = post.mood ? getMoodEmoji(post.mood) : '';
    const isLiked = post.user_liked || false;
    const likeCount = post.like_count || 0;
    const commentCount = post.comment_count || 0;

    // 建立動態內容
    let mediaHtml = '';
    if (post.media_urls && post.media_urls.length > 0) {
        mediaHtml = '<div class="post-media">';
        post.media_urls.forEach(url => {
            mediaHtml += `<img src="${escapeHtml(url)}" alt="動態圖片" class="post-image">`;
        });
        mediaHtml += '</div>';
    }

    div.innerHTML = `
        <div class="post-header">
            <img class="post-avatar" src="${authorAvatar}" alt="${authorName}">
            <div class="post-author-info">
                <div class="post-author-name">${authorName}</div>
                <div class="post-time">
                    ${postTime}
                    ${mood ? `<span class="post-mood">${mood}</span>` : ''}
                </div>
            </div>
        </div>
        <div class="post-content">${content}</div>
        ${mediaHtml}
        <div class="post-stats">
            <span class="post-stat">${likeCount > 0 ? `❤️ ${likeCount}` : ''}</span>
            <span class="post-stat">${commentCount > 0 ? `💬 ${commentCount}` : ''}</span>
        </div>
        <div class="post-actions">
            <button class="post-action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLikePost('${post.post_id || post.id}', this)">
                <span class="action-icon">${isLiked ? '❤️' : '🤍'}</span>
                <span class="action-text">讚</span>
            </button>
            <button class="post-action-btn" onclick="showPostComments('${post.post_id || post.id}')">
                <span class="action-icon">💬</span>
                <span class="action-text">留言</span>
            </button>
            <button class="post-action-btn" onclick="sharePost('${post.post_id || post.id}')">
                <span class="action-icon">📤</span>
                <span class="action-text">分享</span>
            </button>
        </div>
        <div id="comments-${post.post_id || post.id}" class="post-comments" style="display: none;">
            <div class="comments-list"></div>
            <div class="comment-input-area">
                <input type="text" class="comment-input" placeholder="留言..." onkeypress="if(event.key==='Enter') postComment('${post.post_id || post.id}', this.value, this)">
                <button class="btn-send-comment" onclick="postComment('${post.post_id || post.id}', this.previousElementSibling.value, this.previousElementSibling)">發送</button>
            </div>
        </div>
    `;

    return div;
}

/**
 * 格式化時間為「X分鐘前」、「X小時前」等
 */
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '剛剛';
    if (diffMins < 60) return `${diffMins}分鐘前`;
    if (diffHours < 24) return `${diffHours}小時前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' });
}

/**
 * 取得心情表情符號
 */
function getMoodEmoji(mood) {
    const moodMap = {
        'happy': '😊',
        'excited': '🎉',
        'relaxed': '😌',
        'grateful': '🙏',
        'thoughtful': '🤔',
        'sad': '😢',
        'tired': '😴',
        'angry': '😠'
    };
    return moodMap[mood] || '';
}

/**
 * 按讚/取消按讚動態
 */
async function toggleLikePost(postId, buttonElement) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            showError('請先登入');
            return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            showError('無法取得認證資訊');
            return;
        }

        const isLiked = buttonElement.classList.contains('liked');
        const method = isLiked ? 'DELETE' : 'POST';

        const response = await fetch(`${API_BASE_URL}/api/social/posts/${postId}/like`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'x-user-id': user.id
            }
        });

        if (response.ok) {
            const result = await response.json();

            // 更新按鈕狀態
            if (isLiked) {
                buttonElement.classList.remove('liked');
                buttonElement.querySelector('.action-icon').textContent = '🤍';
            } else {
                buttonElement.classList.add('liked');
                buttonElement.querySelector('.action-icon').textContent = '❤️';
            }

            // 更新按讚數量
            const statsElement = buttonElement.closest('.timeline-post').querySelector('.post-stats');
            const likeCountElement = statsElement.querySelector('.post-stat');
            const newCount = result.likeCount || 0;
            likeCountElement.textContent = newCount > 0 ? `❤️ ${newCount}` : '';
        }
    } catch (error) {
        console.error('按讚失敗:', error);
        showError('操作失敗，請重試');
    }
}

/**
 * 顯示動態留言
 */
async function showPostComments(postId) {
    try {
        const commentsSection = document.getElementById(`comments-${postId}`);

        // 切換顯示/隱藏
        if (commentsSection.style.display === 'none') {
            commentsSection.style.display = 'block';

            // 載入留言
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return;

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) return;

            const response = await fetch(`${API_BASE_URL}/api/social/posts/${postId}/comments`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'x-user-id': user.id
                }
            });

            if (response.ok) {
                const result = await response.json();
                const comments = result.comments || [];
                const commentsList = commentsSection.querySelector('.comments-list');

                commentsList.innerHTML = '';
                comments.forEach(comment => {
                    const commentEl = createCommentElement(comment);
                    commentsList.appendChild(commentEl);
                });

                if (comments.length === 0) {
                    commentsList.innerHTML = '<p class="no-comments">還沒有留言，來留下第一則吧！</p>';
                }
            }
        } else {
            commentsSection.style.display = 'none';
        }
    } catch (error) {
        console.error('載入留言失敗:', error);
    }
}

/**
 * 建立留言元素
 */
function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';

    const avatarUrl = comment.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author_name || 'User')}&background=667eea&color=fff&size=60`;
    const authorName = comment.author_name || '未知用戶';
    const commentText = escapeHtml(comment.comment_text || '');
    const timeAgo = formatTimeAgo(comment.created_at);

    div.innerHTML = `
        <img class="comment-avatar" src="${avatarUrl}" alt="${authorName}">
        <div class="comment-content">
            <div class="comment-author">${authorName}</div>
            <div class="comment-text">${commentText}</div>
            <div class="comment-time">${timeAgo}</div>
        </div>
    `;

    return div;
}

/**
 * 發送留言
 */
async function postComment(postId, commentText, inputElement) {
    if (!commentText || !commentText.trim()) return;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            showError('請先登入');
            return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            showError('無法取得認證資訊');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/social/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'x-user-id': user.id
            },
            body: JSON.stringify({
                content: commentText.trim()
            })
        });

        if (response.ok) {
            const result = await response.json();

            // 清空輸入框
            inputElement.value = '';

            // 重新載入留言
            await showPostComments(postId);
            // 再次顯示（因為 showPostComments 會切換）
            document.getElementById(`comments-${postId}`).style.display = 'block';

            showSuccess('留言成功！');
        }
    } catch (error) {
        console.error('留言失敗:', error);
        showError('留言失敗，請重試');
    }
}

/**
 * 分享動態（預留功能）
 */
function sharePost(postId) {
    showError('分享功能即將推出');
}

// ===================================
// 個人資料
// ===================================

/**
 * 前往個人資料頁面
 */
function goToProfile() {
    console.log('🔍 前往個人資料頁面');
    window.location.href = 'profile.html';
}

/**
 * 查看其他使用者的個人資料
 */
function viewUserProfile(userId) {
    console.log('🔍 查看使用者資料:', userId);
    window.location.href = `profile.html?userId=${userId}`;
}

console.log('✅ social.js 載入完成');
