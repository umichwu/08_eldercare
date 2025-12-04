/**
 * 社交功能 API 路由
 * ElderCare Companion - Social Features
 *
 * 功能：
 * - 好友管理（搜尋、邀請、接受、拒絕）
 * - 生活動態（發布、查看、按讚、留言）
 * - 聊天功能（一對一、群組）
 * - 通知系統
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { sendFriendInvitation } from '../services/notificationService.js';

dotenv.config();

const router = express.Router();

// 初始化 Supabase 客戶端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 環境變數');
  console.error('   需要: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 從請求中取得 auth user id
 */
function getAuthUserId(req) {
  // 從 Authorization header 中取得 JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  // 這裡應該驗證 JWT token 並取得 user id
  // 暫時從 header 中取得
  return req.headers['x-user-id'];
}

/**
 * 取得使用者的 profile ID
 */
async function getUserProfileId(authUserId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single();

  if (error || !data) {
    throw new Error('找不到使用者資料');
  }

  return data.id;
}

// ============================================================================
// 好友相關 API
// ============================================================================

/**
 * GET /api/social/friends
 * 取得好友列表
 */
router.get('/friends', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const profileId = await getUserProfileId(authUserId);

    const { data: friends, error } = await supabase
      .from('v_user_friends')
      .select('*')
      .eq('user_id', profileId)
      .order('friends_since', { ascending: false });

    if (error) {
      console.error('取得好友列表錯誤:', error);
      return res.status(500).json({ error: '取得好友列表失敗' });
    }

    res.json({
      success: true,
      friends: friends || [],
      count: friends?.length || 0
    });
  } catch (error) {
    console.error('取得好友列表失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/social/friends/requests
 * 取得好友邀請列表
 */
router.get('/friends/requests', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const profileId = await getUserProfileId(authUserId);

    const { data: requests, error } = await supabase
      .from('v_user_friend_requests')
      .select('*')
      .eq('receiver_id', profileId)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('取得好友邀請錯誤:', error);
      return res.status(500).json({ error: '取得好友邀請失敗' });
    }

    res.json({
      success: true,
      requests: requests || [],
      count: requests?.length || 0
    });
  } catch (error) {
    console.error('取得好友邀請失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/friends/search
 * 搜尋使用者（支援 Email/電話搜尋）
 */
router.post('/friends/search', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { searchTerm } = req.body;
    if (!searchTerm || searchTerm.length < 2) {
      return res.status(400).json({ error: '搜尋關鍵字至少需要 2 個字元' });
    }

    const profileId = await getUserProfileId(authUserId);

    // 判斷搜尋類型
    const isEmail = searchTerm.includes('@');
    const isPhone = /^[\d\s\-\+\(\)]+$/.test(searchTerm);

    // 搜尋現有使用者
    let query = supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url, email, phone')
      .neq('id', profileId);

    if (isEmail) {
      // Email 精確搜尋
      query = query.ilike('email', searchTerm);
    } else if (isPhone) {
      // 電話搜尋
      query = query.or(`phone.ilike.%${searchTerm}%`);
    } else {
      // 姓名模糊搜尋
      query = query.or(`display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data: users, error } = await query.limit(10);

    if (error) {
      console.error('搜尋使用者錯誤:', error);
      return res.status(500).json({ error: '搜尋使用者失敗' });
    }

    // 檢查已有的好友關係
    const userIds = users?.map(u => u.id) || [];
    let relationMap = {};

    if (userIds.length > 0) {
      const { data: existingRelations } = await supabase
        .from('friendships')
        .select('friend_id, status')
        .eq('user_id', profileId)
        .in('friend_id', userIds);

      if (existingRelations) {
        existingRelations.forEach(rel => {
          relationMap[rel.friend_id] = rel.status;
        });
      }
    }

    // 將關係狀態附加到使用者資料
    const usersWithStatus = users?.map(user => ({
      ...user,
      relationStatus: relationMap[user.id] || null,
      isExistingUser: true
    }));

    // 如果沒找到使用者且是 Email/電話搜尋，檢查是否有待處理的邀請
    let pendingInvitation = null;
    if (usersWithStatus.length === 0 && (isEmail || isPhone)) {
      const { data: invitation } = await supabase
        .from('pending_invitations')
        .select('*')
        .eq('inviter_id', profileId)
        .eq('status', 'pending');

      if (isEmail && invitation) {
        pendingInvitation = invitation.find(inv => inv.invitee_email?.toLowerCase() === searchTerm.toLowerCase());
      } else if (isPhone && invitation) {
        pendingInvitation = invitation.find(inv => inv.invitee_phone === searchTerm);
      }
    }

    res.json({
      success: true,
      users: usersWithStatus || [],
      count: usersWithStatus?.length || 0,
      searchType: isEmail ? 'email' : isPhone ? 'phone' : 'name',
      canInvite: usersWithStatus.length === 0 && (isEmail || isPhone),
      pendingInvitation: pendingInvitation || null
    });
  } catch (error) {
    console.error('搜尋使用者失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/friends/request
 * 發送好友邀請
 */
router.post('/friends/request', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: '缺少目標使用者 ID' });
    }

    const profileId = await getUserProfileId(authUserId);

    // 使用資料庫函數發送邀請
    const { data, error } = await supabase
      .rpc('fn_send_friend_request', { target_user_id: targetUserId });

    if (error) {
      console.error('發送好友邀請錯誤:', error);

      if (error.message && error.message.includes('已經是好友')) {
        return res.status(400).json({ error: '已經是好友或已有待處理的邀請' });
      }

      return res.status(500).json({ error: '發送好友邀請失敗' });
    }

    res.json({
      success: true,
      friendshipId: data,
      message: '好友邀請已發送'
    });
  } catch (error) {
    console.error('發送好友邀請失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/friends/accept
 * 接受好友邀請
 */
router.post('/friends/accept', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { friendshipId } = req.body;
    if (!friendshipId) {
      return res.status(400).json({ error: '缺少好友關係 ID' });
    }

    // 使用資料庫函數接受邀請
    const { data, error } = await supabase
      .rpc('fn_accept_friend_request', { friendship_id: friendshipId });

    if (error) {
      console.error('接受好友邀請錯誤:', error);
      return res.status(500).json({ error: '接受好友邀請失敗' });
    }

    res.json({
      success: true,
      message: '已接受好友邀請'
    });
  } catch (error) {
    console.error('接受好友邀請失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/friends/reject
 * 拒絕好友邀請
 */
router.post('/friends/reject', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { friendshipId } = req.body;
    if (!friendshipId) {
      return res.status(400).json({ error: '缺少好友關係 ID' });
    }

    // 使用資料庫函數拒絕邀請
    const { data, error } = await supabase
      .rpc('fn_reject_friend_request', { friendship_id: friendshipId });

    if (error) {
      console.error('拒絕好友邀請錯誤:', error);
      return res.status(500).json({ error: '拒絕好友邀請失敗' });
    }

    res.json({
      success: true,
      message: '已拒絕好友邀請'
    });
  } catch (error) {
    console.error('拒絕好友邀請失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/friends/invite
 * 邀請新使用者（透過 Email 或電話）
 */
router.post('/friends/invite', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { email, phone, name, message } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ error: '請提供 Email 或電話號碼' });
    }

    const profileId = await getUserProfileId(authUserId);

    // 檢查是否已經是註冊使用者
    let existingUserQuery = supabase
      .from('user_profiles')
      .select('id, display_name, email');

    if (email) {
      existingUserQuery = existingUserQuery.eq('email', email);
    } else if (phone) {
      existingUserQuery = existingUserQuery.eq('phone', phone);
    }

    const { data: existingUser } = await existingUserQuery.single();

    if (existingUser) {
      return res.status(400).json({
        error: '此使用者已註冊，請直接搜尋並發送好友邀請',
        existingUser: {
          id: existingUser.id,
          display_name: existingUser.display_name
        }
      });
    }

    // 檢查是否已經發送過邀請
    let invitationQuery = supabase
      .from('pending_invitations')
      .select('*')
      .eq('inviter_id', profileId)
      .eq('status', 'pending');

    if (email) {
      invitationQuery = invitationQuery.eq('invitee_email', email);
    } else if (phone) {
      invitationQuery = invitationQuery.eq('invitee_phone', phone);
    }

    const { data: existingInvitation } = await invitationQuery.single();

    if (existingInvitation) {
      return res.status(400).json({
        error: '您已經發送過邀請給此聯絡方式',
        invitation: existingInvitation
      });
    }

    // 產生邀請碼
    const { data: invitationCode, error: codeError } = await supabase
      .rpc('fn_generate_invitation_code');

    if (codeError) {
      console.error('產生邀請碼錯誤:', codeError);
      return res.status(500).json({ error: '產生邀請碼失敗' });
    }

    // 建立邀請
    const invitationType = email && phone ? 'both' : email ? 'email' : 'phone';

    const { data: invitation, error } = await supabase
      .from('pending_invitations')
      .insert({
        inviter_id: profileId,
        invitee_email: email || null,
        invitee_phone: phone || null,
        invitee_name: name || null,
        invitation_message: message || null,
        invitation_type: invitationType,
        invitation_code: invitationCode,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('建立邀請錯誤:', error);
      return res.status(500).json({ error: '建立邀請失敗' });
    }

    // 取得邀請者資訊
    const { data: inviter } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', profileId)
      .single();

    // 發送 Email 或 SMS 通知
    const notificationResults = await sendFriendInvitation({
      email: invitation.invitee_email,
      phone: invitation.invitee_phone,
      inviterName: inviter?.display_name || '使用者',
      invitationCode: invitation.invitation_code,
      message: invitation.invitation_message
    });

    console.log('📨 通知發送結果:', notificationResults);

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        invitationCode: invitation.invitation_code,
        email: invitation.invitee_email,
        phone: invitation.invitee_phone,
        name: invitation.invitee_name,
        expiresAt: invitation.expires_at
      },
      notification: notificationResults,
      message: '邀請已發送'
    });
  } catch (error) {
    console.error('邀請新使用者失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/social/friends/invitations
 * 取得自己發出的待處理邀請
 */
router.get('/friends/invitations', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const profileId = await getUserProfileId(authUserId);

    const { data: invitations, error } = await supabase
      .from('v_pending_invitations')
      .select('*')
      .eq('inviter_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('取得邀請列表錯誤:', error);
      return res.status(500).json({ error: '取得邀請列表失敗' });
    }

    res.json({
      success: true,
      invitations: invitations || [],
      count: invitations?.length || 0
    });
  } catch (error) {
    console.error('取得邀請列表失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/social/friends/invitations/:invitationId/cancel
 * 取消邀請
 */
router.put('/friends/invitations/:invitationId/cancel', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { invitationId } = req.params;
    const profileId = await getUserProfileId(authUserId);

    const { error } = await supabase
      .from('pending_invitations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', invitationId)
      .eq('inviter_id', profileId)
      .eq('status', 'pending');

    if (error) {
      console.error('取消邀請錯誤:', error);
      return res.status(500).json({ error: '取消邀請失敗' });
    }

    res.json({
      success: true,
      message: '邀請已取消'
    });
  } catch (error) {
    console.error('取消邀請失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/friends/invitations/:invitationId/resend
 * 重新發送邀請
 */
router.post('/friends/invitations/:invitationId/resend', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { invitationId } = req.params;
    const profileId = await getUserProfileId(authUserId);

    // 取得邀請資料
    const { data: invitation, error: fetchError } = await supabase
      .from('pending_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('inviter_id', profileId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !invitation) {
      console.error('取得邀請錯誤:', fetchError);
      return res.status(404).json({ error: '找不到邀請或邀請已失效' });
    }

    // 檢查邀請是否過期
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: '邀請已過期，請建立新邀請' });
    }

    // 取得邀請者資訊
    const { data: inviter } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', profileId)
      .single();

    // 重新發送 Email 或 SMS 通知
    const notificationResults = await sendFriendInvitation({
      email: invitation.invitee_email,
      phone: invitation.invitee_phone,
      inviterName: inviter?.display_name || '使用者',
      invitationCode: invitation.invitation_code,
      message: invitation.invitation_message
    });

    // 更新發送時間
    const { error: updateError } = await supabase
      .from('pending_invitations')
      .update({
        updated_at: new Date().toISOString(),
        last_sent_at: new Date().toISOString()
      })
      .eq('id', invitationId);

    if (updateError) {
      console.warn('更新發送時間失敗:', updateError);
      // 不阻斷執行，因為通知已經發送
    }

    console.log('📨 重新發送邀請結果:', notificationResults);

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        invitationCode: invitation.invitation_code,
        email: invitation.invitee_email,
        phone: invitation.invitee_phone,
        name: invitation.invitee_name
      },
      notification: notificationResults,
      message: '邀請已重新發送'
    });
  } catch (error) {
    console.error('重新發送邀請失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/social/friends/:friendshipId
 * 刪除好友
 */
router.delete('/friends/:friendshipId', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { friendshipId } = req.params;
    const profileId = await getUserProfileId(authUserId);

    // 刪除好友關係（包括雙向）
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .eq('user_id', profileId);

    if (error) {
      console.error('刪除好友錯誤:', error);
      return res.status(500).json({ error: '刪除好友失敗' });
    }

    res.json({
      success: true,
      message: '已刪除好友'
    });
  } catch (error) {
    console.error('刪除好友失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 動態相關 API
// ============================================================================

/**
 * GET /api/social/posts/timeline
 * 取得動態時間軸
 */
router.get('/posts/timeline', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { limit = 20, offset = 0 } = req.query;
    const profileId = await getUserProfileId(authUserId);

    // 取得自己和好友的公開/好友可見動態
    const { data: posts, error } = await supabase
      .from('v_post_timeline')
      .select('*')
      .or(`author_id.eq.${profileId},visibility.eq.public`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('取得動態時間軸錯誤:', error);
      return res.status(500).json({ error: '取得動態時間軸失敗' });
    }

    res.json({
      success: true,
      posts: posts || [],
      count: posts?.length || 0,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('取得動態時間軸失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/posts
 * 發布動態
 */
router.post('/posts', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { content, mood, visibility = 'friends', mediaUrls = [] } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '動態內容不能為空' });
    }

    const profileId = await getUserProfileId(authUserId);

    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
        user_profile_id: profileId,
        content: content.trim(),
        mood,
        visibility,
        media_url: mediaUrls.length > 0 ? mediaUrls[0] : null,
        media_type: mediaUrls.length > 0 ? 'image' : null
      })
      .select()
      .single();

    if (error) {
      console.error('發布動態錯誤:', error);
      return res.status(500).json({ error: '發布動態失敗' });
    }

    res.json({
      success: true,
      post,
      message: '動態發布成功'
    });
  } catch (error) {
    console.error('發布動態失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/social/posts/:postId
 * 取得單一動態
 */
router.get('/posts/:postId', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { postId } = req.params;

    const { data: post, error } = await supabase
      .from('v_post_timeline')
      .select('*')
      .eq('post_id', postId)
      .single();

    if (error) {
      console.error('取得動態錯誤:', error);
      return res.status(404).json({ error: '找不到動態' });
    }

    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error('取得動態失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/posts/:postId/like
 * 按讚動態
 */
router.post('/posts/:postId/like', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { postId } = req.params;
    const { reactionType = 'like' } = req.body;
    const profileId = await getUserProfileId(authUserId);

    // 檢查是否已按讚
    const { data: existing } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_profile_id', profileId)
      .single();

    if (existing) {
      return res.status(400).json({ error: '已經按過讚了' });
    }

    const { data: like, error } = await supabase
      .from('post_likes')
      .insert({
        post_id: postId,
        user_profile_id: profileId
      })
      .select()
      .single();

    if (error) {
      console.error('按讚動態錯誤:', error);
      return res.status(500).json({ error: '按讚失敗' });
    }

    res.json({
      success: true,
      like,
      message: '按讚成功'
    });
  } catch (error) {
    console.error('按讚動態失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/social/posts/:postId/like
 * 取消按讚
 */
router.delete('/posts/:postId/like', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { postId } = req.params;
    const profileId = await getUserProfileId(authUserId);

    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_profile_id', profileId);

    if (error) {
      console.error('取消按讚錯誤:', error);
      return res.status(500).json({ error: '取消按讚失敗' });
    }

    res.json({
      success: true,
      message: '取消按讚成功'
    });
  } catch (error) {
    console.error('取消按讚失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/social/posts/:postId/comments
 * 取得動態留言
 */
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { postId } = req.params;

    const { data: comments, error } = await supabase
      .from('post_comments')
      .select(`
        *,
        user_profiles:user_profile_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('取得留言錯誤:', error);
      return res.status(500).json({ error: '取得留言失敗' });
    }

    res.json({
      success: true,
      comments: comments || [],
      count: comments?.length || 0
    });
  } catch (error) {
    console.error('取得留言失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/posts/:postId/comments
 * 留言動態
 */
router.post('/posts/:postId/comments', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { postId } = req.params;
    const { content, parentCommentId = null } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '留言內容不能為空' });
    }

    const profileId = await getUserProfileId(authUserId);

    const { data: comment, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_profile_id: profileId,
        content: content.trim(),
        parent_comment_id: parentCommentId
      })
      .select(`
        *,
        user_profiles:user_profile_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      console.error('留言動態錯誤:', error);
      return res.status(500).json({ error: '留言失敗' });
    }

    res.json({
      success: true,
      comment,
      message: '留言成功'
    });
  } catch (error) {
    console.error('留言動態失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 通知相關 API
// ============================================================================

/**
 * GET /api/social/notifications
 * 取得通知列表
 */
router.get('/notifications', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { limit = 20, unreadOnly = false } = req.query;
    const profileId = await getUserProfileId(authUserId);

    let query = supabase
      .from('social_notifications')
      .select('*')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (unreadOnly === 'true') {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('取得通知錯誤:', error);
      return res.status(500).json({ error: '取得通知失敗' });
    }

    res.json({
      success: true,
      notifications: notifications || [],
      count: notifications?.length || 0
    });
  } catch (error) {
    console.error('取得通知失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/social/notifications/:notificationId/read
 * 標記通知為已讀
 */
router.put('/notifications/:notificationId/read', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { notificationId } = req.params;
    const profileId = await getUserProfileId(authUserId);

    const { error } = await supabase
      .from('social_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', profileId);

    if (error) {
      console.error('標記通知已讀錯誤:', error);
      return res.status(500).json({ error: '標記已讀失敗' });
    }

    res.json({
      success: true,
      message: '已標記為已讀'
    });
  } catch (error) {
    console.error('標記通知已讀失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/social/notifications/read-all
 * 標記所有通知為已讀
 */
router.put('/notifications/read-all', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const profileId = await getUserProfileId(authUserId);

    const { error } = await supabase
      .from('social_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', profileId)
      .eq('is_read', false);

    if (error) {
      console.error('標記所有通知已讀錯誤:', error);
      return res.status(500).json({ error: '標記所有已讀失敗' });
    }

    res.json({
      success: true,
      message: '已標記所有通知為已讀'
    });
  } catch (error) {
    console.error('標記所有通知已讀失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 聊天訊息相關 API
// ============================================================================

/**
 * GET /api/social/messages/:friendUserId
 * 取得與某個好友的聊天記錄
 */
router.get('/messages/:friendUserId', async (req, res) => {
  try {
    const { friendUserId } = req.params;
    const { userId, limit = 50, before } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId 參數' });
    }

    console.log(`📥 取得聊天記錄: userId=${userId}, friendUserId=${friendUserId}`);

    // 取得使用者的 profile ID
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: '找不到使用者資料' });
    }

    // 取得好友的 profile ID
    const { data: friendProfile, error: friendError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', friendUserId)
      .single();

    if (friendError || !friendProfile) {
      return res.status(404).json({ error: '找不到好友資料' });
    }

    // 建立查詢
    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        sender_id,
        receiver_id,
        content,
        message_type,
        media_url,
        media_thumbnail_url,
        file_name,
        file_size,
        is_read,
        read_at,
        created_at
      `)
      .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${friendProfile.id}),and(sender_id.eq.${friendProfile.id},receiver_id.eq.${userProfile.id})`)
      .eq('is_deleted_by_sender', false)
      .eq('is_deleted_by_receiver', false)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // 如果有 before 參數，用於分頁
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('取得聊天記錄錯誤:', error);
      return res.status(500).json({ error: '取得聊天記錄失敗' });
    }

    // 反轉順序（最舊的在前）
    const sortedMessages = (messages || []).reverse();

    res.json({
      success: true,
      messages: sortedMessages,
      count: sortedMessages.length,
      hasMore: sortedMessages.length === parseInt(limit)
    });

  } catch (error) {
    console.error('聊天記錄 API 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/social/messages
 * 發送聊天訊息
 */
router.post('/messages', async (req, res) => {
  try {
    const { userId, receiverUserId, messageText, messageType = 'text', mediaUrl = null } = req.body;

    if (!userId || !receiverUserId) {
      return res.status(400).json({ error: '缺少必要參數' });
    }

    // 文字訊息需要內容，其他類型可能只有 mediaUrl
    if (messageType === 'text' && !messageText) {
      return res.status(400).json({ error: '文字訊息不能為空' });
    }

    console.log(`📤 發送訊息: from=${userId} to=${receiverUserId}`);

    // 取得發送者的 profile ID
    const { data: senderProfile, error: senderError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (senderError || !senderProfile) {
      return res.status(404).json({ error: '找不到發送者資料' });
    }

    // 取得接收者的 profile ID
    const { data: receiverProfile, error: receiverError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', receiverUserId)
      .single();

    if (receiverError || !receiverProfile) {
      return res.status(404).json({ error: '找不到接收者資料' });
    }

    // 插入訊息
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          sender_id: senderProfile.id,
          receiver_id: receiverProfile.id,
          content: messageText || null,
          message_type: messageType,
          media_url: mediaUrl
        }
      ])
      .select(`
        id,
        sender_id,
        receiver_id,
        content,
        message_type,
        media_url,
        is_read,
        read_at,
        created_at
      `)
      .single();

    if (error) {
      console.error('發送訊息錯誤:', error);
      return res.status(500).json({ error: '發送訊息失敗' });
    }

    console.log('✅ 訊息已發送:', message.id);

    res.status(201).json({
      success: true,
      message: message
    });

  } catch (error) {
    console.error('發送訊息 API 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/social/messages/:messageId/read
 * 標記訊息為已讀
 */
router.put('/messages/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId 參數' });
    }

    console.log(`✓ 標記訊息為已讀: messageId=${messageId}, userId=${userId}`);

    // 取得使用者的 profile ID
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: '找不到使用者資料' });
    }

    // 更新訊息為已讀（只有接收者可以標記）
    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('receiver_id', userProfile.id)
      .select();

    if (error) {
      console.error('標記已讀錯誤:', error);
      return res.status(500).json({ error: '標記已讀失敗' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: '訊息不存在或無權限' });
    }

    res.json({
      success: true,
      message: '訊息已標記為已讀'
    });

  } catch (error) {
    console.error('標記已讀 API 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/social/messages/batch-read
 * 批次標記多則訊息為已讀
 */
router.put('/messages/batch-read', async (req, res) => {
  try {
    const { userId, friendUserId } = req.body;

    if (!userId || !friendUserId) {
      return res.status(400).json({ error: '缺少必要參數' });
    }

    console.log(`✓ 批次標記已讀: userId=${userId}, friendUserId=${friendUserId}`);

    // 取得使用者的 profile ID
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: '找不到使用者資料' });
    }

    // 取得好友的 profile ID
    const { data: friendProfile, error: friendError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', friendUserId)
      .single();

    if (friendError || !friendProfile) {
      return res.status(404).json({ error: '找不到好友資料' });
    }

    // 批次更新所有未讀訊息
    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('sender_id', friendProfile.id)
      .eq('receiver_id', userProfile.id)
      .eq('is_read', false)
      .select();

    if (error) {
      console.error('批次標記已讀錯誤:', error);
      return res.status(500).json({ error: '批次標記已讀失敗' });
    }

    console.log(`✅ 已標記 ${data?.length || 0} 則訊息為已讀`);

    res.json({
      success: true,
      count: data?.length || 0,
      message: `已標記 ${data?.length || 0} 則訊息為已讀`
    });

  } catch (error) {
    console.error('批次標記已讀 API 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/social/conversations
 * 取得對話列表（所有有聊天記錄的好友）
 */
router.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId 參數' });
    }

    console.log(`📋 取得對話列表: userId=${userId}`);

    // 取得使用者的 profile ID
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: '找不到使用者資料' });
    }

    // 使用視圖取得對話列表
    const { data: conversations, error } = await supabase
      .from('v_conversation_list')
      .select('*')
      .or(`sender_id.eq.${userProfile.id},receiver_id.eq.${userProfile.id}`)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('取得對話列表錯誤:', error);
      return res.status(500).json({ error: '取得對話列表失敗' });
    }

    // 處理對話列表，確保每個對話只顯示對方的資訊
    const processedConversations = (conversations || []).map(conv => {
      const isUserSender = conv.sender_id === userProfile.id;
      return {
        ...conv,
        friend_user_id: isUserSender ? conv.receiver_id : conv.sender_id,
        friend_name: isUserSender ? conv.receiver_name : conv.sender_name,
        friend_avatar: isUserSender ? conv.receiver_avatar : conv.sender_avatar,
        unread_count: isUserSender ? 0 : conv.unread_count
      };
    });

    res.json({
      success: true,
      conversations: processedConversations,
      count: processedConversations.length
    });

  } catch (error) {
    console.error('對話列表 API 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/social/messages/:messageId
 * 刪除訊息（軟刪除）
 */
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId 參數' });
    }

    console.log(`🗑️  刪除訊息: messageId=${messageId}, userId=${userId}`);

    // 取得使用者的 profile ID
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: '找不到使用者資料' });
    }

    // 先取得訊息以確認權限
    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select('sender_id, receiver_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return res.status(404).json({ error: '訊息不存在' });
    }

    // 判斷是發送者還是接收者
    const isSender = message.sender_id === userProfile.id;
    const isReceiver = message.receiver_id === userProfile.id;

    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: '無權限刪除此訊息' });
    }

    // 軟刪除訊息
    const updateData = isSender
      ? { is_deleted_by_sender: true }
      : { is_deleted_by_receiver: true };

    const { error } = await supabase
      .from('chat_messages')
      .update(updateData)
      .eq('id', messageId);

    if (error) {
      console.error('刪除訊息錯誤:', error);
      return res.status(500).json({ error: '刪除訊息失敗' });
    }

    console.log('✅ 訊息已刪除');

    res.json({
      success: true,
      message: '訊息已刪除'
    });

  } catch (error) {
    console.error('刪除訊息 API 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 健康檢查
// ============================================================================

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'social-api',
    timestamp: new Date().toISOString()
  });
});

export default router;
