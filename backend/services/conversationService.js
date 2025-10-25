import { supabase, supabaseAdmin } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 對話管理服務
 */
class ConversationService {
  /**
   * 建立新對話
   * @param {string} authUserId - auth.users 的 ID
   * @param {string} userProfileId - user_profiles 的 ID
   * @param {string} elderId - elders 的 ID（如果角色是 elder）
   * @param {string} familyMemberId - family_members 的 ID（如果角色是 family）
   * @param {string} title - 對話標題
   */
  async createConversation(authUserId, userProfileId, options = {}) {
    try {
      const {
        elderId = null,
        familyMemberId = null,
        title = '新對話'
      } = options;

      // 如果 userProfileId 和 authUserId 相同，表示需要查詢 user_profile_id
      let actualUserProfileId = userProfileId;
      let actualElderId = elderId;
      let actualFamilyMemberId = familyMemberId;

      if (userProfileId === authUserId) {
        // 查詢 user_profiles 取得實際的 profile ID
        // 使用 supabaseAdmin 以繞過 RLS（因為後端沒有 auth context）
        console.log('🔍 查詢 user_profile:', authUserId);

        const { data: profiles, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('id, elder_id, family_member_id')
          .eq('auth_user_id', authUserId);

        if (profileError) {
          console.error('❌ 查詢 user_profile 失敗:', profileError);
          throw new Error('查詢使用者檔案失敗: ' + profileError.message);
        }

        if (!profiles || profiles.length === 0) {
          console.error('❌ 找不到 user_profile');
          throw new Error('找不到使用者檔案，請確認使用者已完成註冊');
        }

        // 如果有多筆記錄，取第一筆（應該不會發生，但做個防護）
        const profile = profiles[0];
        console.log('✅ 找到 user_profile:', profile.id);

        actualUserProfileId = profile.id;
        actualElderId = profile.elder_id || elderId;
        actualFamilyMemberId = profile.family_member_id || familyMemberId;

        if (profiles.length > 1) {
          console.warn('⚠️ 警告：找到多筆 user_profile 記錄:', profiles.length);
        }
      }

      // 使用 supabaseAdmin 來建立對話（繞過 RLS）
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .insert([
          {
            auth_user_id: authUserId,
            user_profile_id: actualUserProfileId,
            elder_id: actualElderId,
            family_member_id: actualFamilyMemberId,
            title: title,
            status: 'active',
            message_count: 0,
            user_message_count: 0,
            ai_message_count: 0
          }
        ])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 對話已建立:', data.id, '(User:', authUserId, ')');
      return { success: true, data };
    } catch (error) {
      console.error('❌ 建立對話失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取得使用者的所有對話
   * @param {string} authUserId - auth.users 的 ID
   * @param {number} limit - 限制返回數量
   */
  async getUserConversations(authUserId, limit = 50) {
    try {
      // 使用 supabaseAdmin 來查詢對話（繞過 RLS）
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // 空結果也是正常的（例如新使用者第一次登入）
      const conversations = data || [];
      console.log(`✅ 取得 ${conversations.length} 個對話 (User: ${authUserId})`);
      return { success: true, data: conversations };
    } catch (error) {
      console.error('❌ 取得對話列表失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取得單一對話詳情
   * @param {string} conversationId - 對話 ID
   * @param {string} authUserId - auth.users 的 ID（用於權限檢查）
   */
  async getConversation(conversationId, authUserId) {
    try {
      // 使用 supabaseAdmin 來查詢對話（繞過 RLS）
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('auth_user_id', authUserId)
        .single();

      if (error) throw error;

      console.log('✅ 取得對話:', conversationId);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 取得對話失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新對話標題
   * @param {string} conversationId - 對話 ID
   * @param {string} authUserId - auth.users 的 ID（用於權限檢查）
   * @param {string} newTitle - 新標題
   */
  async updateConversationTitle(conversationId, authUserId, newTitle) {
    try {
      // 使用 supabaseAdmin 來更新對話（繞過 RLS）
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .update({ title: newTitle })
        .eq('id', conversationId)
        .eq('auth_user_id', authUserId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 對話標題已更新:', conversationId);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 更新標題失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 刪除（歸檔）對話
   * @param {string} conversationId - 對話 ID
   * @param {string} authUserId - auth.users 的 ID（用於權限檢查）
   */
  async deleteConversation(conversationId, authUserId) {
    try {
      // 使用 supabaseAdmin 來更新對話（繞過 RLS）
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .update({ status: 'archived' })
        .eq('id', conversationId)
        .eq('auth_user_id', authUserId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 對話已歸檔:', conversationId);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 刪除對話失敗:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new ConversationService();
