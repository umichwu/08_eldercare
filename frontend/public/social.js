/**
 * 好友聊天頁面主要邏輯
 * ElderCare Social Module
 */

// ===================================
// 全域變數
// ===================================
const SUPABASE_URL = 'https://oatdjdelzybcacwqafkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGRqZGVsenliY2Fjd3FhZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM5ODUsImV4cCI6MjA3Njc3OTk4NX0.Flk-9yHREG7gWr1etG-TEc2ufPjP-zvW2Ejd2gCqG4w';

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://eldercare-backend-8o4k.onrender.com';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let userProfile = null;
let currentTab = 'timeline';

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

        // TODO: 從資料庫載入動態
        // 目前顯示空白狀態（因為資料庫表格還未建立）

        timelineList.innerHTML = '';
        noPostsPlaceholder.style.display = 'block';

        console.log('✅ 動態時間軸載入完成（目前為空）');
    } catch (error) {
        console.error('❌ 載入動態時間軸失敗:', error);
        timelineList.innerHTML = '<p style="text-align: center; color: #999;">載入失敗，請重試</p>';
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
            <button class="btn-icon" style="background: rgba(255,255,255,0.2); color: white;" onclick="openChatWithSelf()" title="速記">
                💬
            </button>
        </div>
    `;

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
            <button class="btn-icon" onclick="openChatWithFriend('${friend.friend_user_id}')" title="聊天">
                💬
            </button>
            <button class="btn-icon" onclick="viewFriendProfile('${friend.friend_user_id}')" title="查看資料">
                👤
            </button>
        </div>
    `;

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

        // TODO: 儲存動態到資料庫
        // 目前只是模擬
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('✅ 動態發布成功');
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

        // TODO: 實作重新發送邀請 API
        // 目前先使用簡單的成功訊息

        hideLoading();
        showSuccess('邀請已重新發送！');
    } catch (error) {
        console.error('❌ 重新發送邀請失敗:', error);
        hideLoading();
        showError('重新發送失敗，請重試');
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

        // TODO: 從資料庫載入通知
        notificationsList.innerHTML = '<p style="text-align: center; color: #999;">目前沒有通知</p>';
    } catch (error) {
        console.error('❌ 載入通知失敗:', error);
        notificationsList.innerHTML = '<p style="text-align: center; color: #999;">載入失敗，請重試</p>';
    }
}

async function markAllNotificationsRead() {
    try {
        console.log('✅ 標記所有通知為已讀');

        // TODO: 更新資料庫
        showSuccess('已標記所有通知為已讀');
        await loadNotifications();
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

    // TODO: 從資料庫載入與自己的聊天記錄
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
function openChatWithFriend(friendUserId) {
    console.log(`💬 開啟與好友的聊天: ${friendUserId}`);
    // TODO: 實作聊天功能
    showError('聊天功能開發中...');
}

// 查看好友資料
function viewFriendProfile(friendUserId) {
    console.log(`👤 查看好友資料: ${friendUserId}`);
    // TODO: 實作個人資料頁面
    showError('個人資料頁面開發中...');
}

// 開始視訊通話
function startVideoCall() {
    console.log('📹 開始視訊通話');
    showError('視訊通話功能開發中...');
}

// 開始語音通話
function startVoiceCall() {
    console.log('📞 開始語音通話');
    showError('語音通話功能開發中...');
}

// 顯示表情符號選擇器
function showEmojiPicker() {
    console.log('😊 顯示表情符號選擇器');
    // TODO: 實作表情符號選擇器
    showError('表情符號選擇器開發中...');
}

// 選擇圖片
function selectImage() {
    console.log('📷 選擇圖片');
    // TODO: 實作圖片選擇功能
    showError('圖片選擇功能開發中...');
}

// 發送訊息
function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    const message = chatInput.value.trim();
    if (!message) {
        return;
    }

    console.log('📤 發送訊息:', message);

    // TODO: 實作發送訊息功能
    // 目前只是清空輸入框
    chatInput.value = '';

    // 顯示訊息在聊天室中（暫時的模擬）
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message sent';
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${escapeHtml(message)}</p>
            </div>
            <div class="message-time">${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
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

console.log('✅ social.js 載入完成');
