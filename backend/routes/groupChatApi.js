/**
 * Group Chat API - 群組聊天路由
 *
 * 功能：
 * - 群組 CRUD（建立、查詢、更新、刪除）
 * - 成員管理（加入、移除、權限設定）
 * - 群組訊息（發送、查詢）
 * - 群組邀請
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===================================
// 群組 CRUD API
// ===================================

/**
 * GET /api/groups
 * 取得使用者的所有群組
 */
router.get('/groups', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 為必填',
      });
    }

    // 查詢使用者所屬的所有群組
    const { data: memberGroups, error } = await supabase
      .from('chat_group_members')
      .select(`
        group_id,
        role,
        is_muted,
        is_pinned,
        joined_at,
        chat_groups!inner (
          id,
          name,
          description,
          avatar_url,
          max_members,
          is_private,
          created_by,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('joined_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 格式化回應
    const groups = memberGroups.map(mg => ({
      ...mg.chat_groups,
      membership: {
        role: mg.role,
        is_muted: mg.is_muted,
        is_pinned: mg.is_pinned,
        joined_at: mg.joined_at,
      },
    }));

    // 取得每個群組的成員數量和最後訊息
    for (const group of groups) {
      // 成員數量
      const { count: memberCount } = await supabase
        .from('chat_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id)
        .eq('is_active', true);

      group.member_count = memberCount || 0;

      // 最後一則訊息
      const { data: lastMessage } = await supabase
        .from('chat_messages')
        .select('content, created_at, sender_id, user_profiles!sender_id(display_name)')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      group.last_message = lastMessage || null;
    }

    res.json({
      groups,
      total: groups.length,
    });

  } catch (error) {
    console.error('API 錯誤 (GET /groups):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

/**
 * POST /api/groups
 * 建立新群組
 */
router.post('/groups', async (req, res) => {
  try {
    const { userId, name, description, avatar_url, max_members, is_private } = req.body;

    if (!userId || !name) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId, name 為必填',
      });
    }

    // 建立群組
    const { data: group, error } = await supabase
      .from('chat_groups')
      .insert({
        name,
        description: description || null,
        avatar_url: avatar_url || null,
        max_members: max_members || 50,
        is_private: is_private || false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ 群組建立成功:', group.id);

    res.json({
      message: '群組建立成功',
      group,
    });

  } catch (error) {
    console.error('API 錯誤 (POST /groups):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

/**
 * PUT /api/groups/:groupId
 * 更新群組資訊
 */
router.put('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, name, description, avatar_url, max_members } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 為必填',
      });
    }

    // 檢查權限（必須是管理員或版主）
    const { data: member } = await supabase
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!member || !['admin', 'moderator'].includes(member.role)) {
      return res.status(403).json({
        error: '權限不足',
        message: '只有管理員和版主可以更新群組資訊',
      });
    }

    // 更新群組
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (max_members) updateData.max_members = max_members;

    const { data: group, error } = await supabase
      .from('chat_groups')
      .update(updateData)
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ 群組更新成功:', groupId);

    res.json({
      message: '群組更新成功',
      group,
    });

  } catch (error) {
    console.error('API 錯誤 (PUT /groups/:groupId):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

/**
 * DELETE /api/groups/:groupId
 * 刪除群組（軟刪除）
 */
router.delete('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 為必填',
      });
    }

    // 檢查是否為建立者
    const { data: group } = await supabase
      .from('chat_groups')
      .select('created_by')
      .eq('id', groupId)
      .single();

    if (!group || group.created_by !== userId) {
      return res.status(403).json({
        error: '權限不足',
        message: '只有建立者可以刪除群組',
      });
    }

    // 軟刪除群組
    const { error } = await supabase
      .from('chat_groups')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    if (error) {
      throw error;
    }

    console.log('✅ 群組刪除成功:', groupId);

    res.json({
      message: '群組刪除成功',
    });

  } catch (error) {
    console.error('API 錯誤 (DELETE /groups/:groupId):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

// ===================================
// 成員管理 API
// ===================================

/**
 * GET /api/groups/:groupId/members
 * 取得群組成員列表
 */
router.get('/groups/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;

    const { data: members, error } = await supabase
      .from('chat_group_members')
      .select(`
        id,
        user_id,
        role,
        nickname,
        joined_at,
        user_profiles!user_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('role', { ascending: true }) // admin first
      .order('joined_at', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({
      members,
      total: members.length,
    });

  } catch (error) {
    console.error('API 錯誤 (GET /groups/:groupId/members):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

/**
 * POST /api/groups/:groupId/members
 * 加入成員到群組
 */
router.post('/groups/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, newMemberId, role = 'member' } = req.body;

    if (!userId || !newMemberId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId, newMemberId 為必填',
      });
    }

    // 檢查權限（必須是管理員或版主）
    const { data: member } = await supabase
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!member || !['admin', 'moderator'].includes(member.role)) {
      return res.status(403).json({
        error: '權限不足',
        message: '只有管理員和版主可以新增成員',
      });
    }

    // 檢查群組是否已滿
    const { data: group } = await supabase
      .from('chat_groups')
      .select('max_members')
      .eq('id', groupId)
      .single();

    const { count: currentMembers } = await supabase
      .from('chat_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (currentMembers >= group.max_members) {
      return res.status(400).json({
        error: '群組已滿',
        message: `群組人數已達上限 ${group.max_members} 人`,
      });
    }

    // 加入成員
    const { data: newMember, error } = await supabase
      .from('chat_group_members')
      .insert({
        group_id: groupId,
        user_id: newMemberId,
        role: role,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ 成員加入成功:', newMemberId);

    res.json({
      message: '成員加入成功',
      member: newMember,
    });

  } catch (error) {
    console.error('API 錯誤 (POST /groups/:groupId/members):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

/**
 * PUT /api/groups/:groupId/members/:memberId
 * 更新成員權限或設定
 */
router.put('/groups/:groupId/members/:memberId', async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { userId, role, nickname, is_muted, is_pinned } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 為必填',
      });
    }

    // 如果是更新角色，需要檢查權限
    if (role) {
      const { data: member } = await supabase
        .from('chat_group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!member || member.role !== 'admin') {
        return res.status(403).json({
          error: '權限不足',
          message: '只有管理員可以更改成員角色',
        });
      }
    }

    // 更新成員資料
    const updateData = {};
    if (role) updateData.role = role;
    if (nickname !== undefined) updateData.nickname = nickname;
    if (is_muted !== undefined) updateData.is_muted = is_muted;
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned;

    const { data: updatedMember, error } = await supabase
      .from('chat_group_members')
      .update(updateData)
      .eq('id', memberId)
      .eq('group_id', groupId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ 成員資料更新成功:', memberId);

    res.json({
      message: '成員資料更新成功',
      member: updatedMember,
    });

  } catch (error) {
    console.error('API 錯誤 (PUT /groups/:groupId/members/:memberId):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

/**
 * DELETE /api/groups/:groupId/members/:memberId
 * 移除成員或離開群組
 */
router.delete('/groups/:groupId/members/:memberId', async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 為必填',
      });
    }

    // 檢查是自己離開還是管理員踢人
    const { data: targetMember } = await supabase
      .from('chat_group_members')
      .select('user_id')
      .eq('id', memberId)
      .single();

    const isSelfLeaving = targetMember.user_id === userId;

    if (!isSelfLeaving) {
      // 踢人需要管理員權限
      const { data: member } = await supabase
        .from('chat_group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!member || !['admin', 'moderator'].includes(member.role)) {
        return res.status(403).json({
          error: '權限不足',
          message: '只有管理員和版主可以移除成員',
        });
      }
    }

    // 更新成員狀態
    const { error } = await supabase
      .from('chat_group_members')
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (error) {
      throw error;
    }

    console.log('✅ 成員移除成功:', memberId);

    res.json({
      message: isSelfLeaving ? '已離開群組' : '成員移除成功',
    });

  } catch (error) {
    console.error('API 錯誤 (DELETE /groups/:groupId/members/:memberId):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

// ===================================
// 群組訊息 API
// ===================================

/**
 * GET /api/groups/:groupId/messages
 * 取得群組訊息
 */
router.get('/groups/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 50, before } = req.query;

    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        sender_id,
        content,
        message_type,
        media_url,
        created_at,
        user_profiles!sender_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw error;
    }

    // 反轉訊息順序（舊到新）
    messages.reverse();

    res.json({
      messages,
      total: messages.length,
    });

  } catch (error) {
    console.error('API 錯誤 (GET /groups/:groupId/messages):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

/**
 * POST /api/groups/:groupId/messages
 * 發送群組訊息
 */
router.post('/groups/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, content, message_type = 'text', media_url } = req.body;

    if (!userId || (!content && !media_url)) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 和 (content 或 media_url) 為必填',
      });
    }

    // 檢查是否為群組成員
    const { data: member } = await supabase
      .from('chat_group_members')
      .select('can_send_messages')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!member) {
      return res.status(403).json({
        error: '權限不足',
        message: '您不是此群組的成員',
      });
    }

    if (!member.can_send_messages) {
      return res.status(403).json({
        error: '權限不足',
        message: '您已被禁止發送訊息',
      });
    }

    // 發送訊息
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        group_id: groupId,
        sender_id: userId,
        content: content || '',
        message_type,
        media_url: media_url || null,
      })
      .select(`
        id,
        sender_id,
        content,
        message_type,
        media_url,
        created_at,
        user_profiles!sender_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ 群組訊息發送成功:', message.id);

    res.json({
      message: '訊息發送成功',
      data: message,
    });

  } catch (error) {
    console.error('API 錯誤 (POST /groups/:groupId/messages):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

// ===================================
// 邀請功能 API
// ===================================

/**
 * POST /api/invite/email
 * 透過 Email 邀請好友加入 App
 */
router.post('/invite/email', async (req, res) => {
  try {
    const { userId, friendEmail, message } = req.body;

    if (!userId || !friendEmail) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 和 friendEmail 為必填',
      });
    }

    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(friendEmail)) {
      return res.status(400).json({
        error: 'Email 格式不正確',
        message: '請輸入有效的 Email 地址',
      });
    }

    // 取得邀請者的資訊
    const { data: inviter, error: inviterError } = await supabase
      .from('user_profiles')
      .select('display_name, email')
      .eq('id', userId)
      .single();

    if (inviterError || !inviter) {
      console.error('無法取得邀請者資訊:', inviterError);
      return res.status(404).json({
        error: '找不到使用者',
        message: '無法取得您的個人資訊',
      });
    }

    // 動態導入 emailNotificationService
    const { sendAppInvitationEmail } = await import('../services/emailNotificationService.js');

    // 發送邀請 Email
    const emailResult = await sendAppInvitationEmail({
      to: friendEmail,
      inviterName: inviter.display_name || '您的朋友',
      inviterEmail: inviter.email,
      message: message || '',
      appUrl: 'https://08-eldercare.vercel.app',
      language: 'zh-TW'
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Email 發送失敗');
    }

    console.log(`✅ 邀請 Email 已發送給 ${friendEmail}`);

    res.json({
      message: '邀請已成功發送！',
      success: true,
      details: {
        to: friendEmail,
        from: inviter.display_name,
        sentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('API 錯誤 (POST /invite/email):', error);
    res.status(500).json({
      error: '伺服器錯誤',
      message: error.message || '發送邀請時發生錯誤'
    });
  }
});

/**
 * GET /api/test-email
 * 測試 Email 設定和發送功能
 */
router.get('/test-email', async (req, res) => {
  try {
    // 檢查環境變數
    const hasApiKey = !!process.env.RESEND_API_KEY;
    const hasFromEmail = !!process.env.RESEND_FROM_EMAIL;
    const apiKeyPrefix = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.substring(0, 10) : 'NOT_SET';

    const config = {
      RESEND_API_KEY: hasApiKey ? `${apiKeyPrefix}...` : '❌ 未設定',
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || '❌ 未設定',
      status: hasApiKey && hasFromEmail ? '✅ 設定完成' : '❌ 設定不完整'
    };

    res.json({
      message: 'Email 設定檢查',
      config,
      instructions: {
        step1: '確認 RESEND_API_KEY 已設定（格式：re_xxxxx）',
        step2: '確認 RESEND_FROM_EMAIL 已設定（建議：onboarding@resend.dev）',
        step3: '如果使用測試域名，需要在 Resend 驗證收件者 Email',
        testEndpoint: 'POST /api/test-email-send'
      }
    });

  } catch (error) {
    console.error('檢查 Email 設定失敗:', error);
    res.status(500).json({ error: '檢查失敗', message: error.message });
  }
});

/**
 * POST /api/test-email-send
 * 發送測試 Email
 */
router.post('/test-email-send', async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        error: '缺少參數',
        message: '請提供收件者 Email (to)',
      });
    }

    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        error: 'Email 格式不正確',
        message: '請輸入有效的 Email 地址',
      });
    }

    // 檢查環境變數
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        error: 'Email 服務未設定',
        message: 'RESEND_API_KEY 環境變數未設定',
        fix: '請在 Render Dashboard 設定 RESEND_API_KEY'
      });
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      return res.status(500).json({
        error: 'Email 服務未設定',
        message: 'RESEND_FROM_EMAIL 環境變數未設定',
        fix: '請在 Render Dashboard 設定 RESEND_FROM_EMAIL=onboarding@resend.dev'
      });
    }

    // 動態導入 emailNotificationService
    const { sendTestEmail } = await import('../services/emailNotificationService.js');

    console.log(`📧 發送測試 Email 到: ${to}`);

    // 發送測試 Email
    const result = await sendTestEmail(to);

    if (!result.success) {
      return res.status(500).json({
        error: 'Email 發送失敗',
        message: result.error,
        troubleshooting: {
          step1: '檢查 RESEND_API_KEY 是否正確',
          step2: '如果使用 onboarding@resend.dev，需要在 Resend 驗證收件者',
          step3: '查看 Render Logs 取得詳細錯誤訊息'
        }
      });
    }

    console.log('✅ 測試 Email 發送成功');

    res.json({
      success: true,
      message: '測試 Email 已發送！',
      details: {
        to: to,
        from: process.env.RESEND_FROM_EMAIL,
        sentAt: new Date().toISOString()
      },
      nextSteps: [
        '1. 檢查您的信箱（包含垃圾郵件資料夾）',
        '2. 如果沒收到，檢查 Render Logs',
        '3. 確認在 Resend Dashboard 已驗證收件者 Email'
      ]
    });

  } catch (error) {
    console.error('❌ 發送測試 Email 失敗:', error);
    res.status(500).json({
      error: '伺服器錯誤',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/groups/test
 * 測試路由
 */
router.get('/test', (req, res) => {
  res.json({
    message: 'Group Chat API 運行正常',
    endpoints: {
      groups: 'GET /api/groups',
      createGroup: 'POST /api/groups',
      updateGroup: 'PUT /api/groups/:groupId',
      deleteGroup: 'DELETE /api/groups/:groupId',
      members: 'GET /api/groups/:groupId/members',
      addMember: 'POST /api/groups/:groupId/members',
      updateMember: 'PUT /api/groups/:groupId/members/:memberId',
      removeMember: 'DELETE /api/groups/:groupId/members/:memberId',
      messages: 'GET /api/groups/:groupId/messages',
      sendMessage: 'POST /api/groups/:groupId/messages',
      inviteEmail: 'POST /api/invite/email',
      testEmail: 'GET /api/test-email',
      testEmailSend: 'POST /api/test-email-send',
    },
  });
});

export default router;
