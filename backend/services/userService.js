import { supabase, supabaseAdmin } from '../config/supabase.js';

/**
 * 使用者設定服務
 */
class UserService {
  /**
   * 取得使用者檔案
   */
  async getUserProfile(authUserId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('❌ 取得使用者檔案失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新使用者個人資料
   */
  async updateUserProfile(authUserId, updates) {
    try {
      // 允許更新的欄位
      const allowedFields = [
        'display_name',
        'email',
        'phone',
        'avatar_url',
        'bio',
        'birth_date',
        'gender',
        'language',
        'theme',
        'font_size'
      ];

      const validUpdates = {};

      // 過濾只允許的欄位
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          validUpdates[key] = value;
        }
      }

      if (Object.keys(validUpdates).length === 0) {
        throw new Error('沒有有效的更新欄位');
      }

      validUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('user_profiles')
        .update(validUpdates)
        .eq('auth_user_id', authUserId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 使用者資料已更新:', authUserId);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 更新使用者資料失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新頭像
   */
  async updateAvatar(authUserId, avatarUrl) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', authUserId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 頭像已更新:', authUserId);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 更新頭像失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取得其他使用者的公開資料
   */
  async getPublicProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, bio, created_at')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('❌ 取得公開資料失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新使用者語言設定
   */
  async updateLanguage(authUserId, language) {
    try {
      // 驗證語言代碼
      const validLanguages = ['zh-TW', 'zh-CN', 'en-US', 'ja-JP', 'ko-KR'];
      if (!validLanguages.includes(language)) {
        throw new Error(`不支援的語言: ${language}`);
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          language,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', authUserId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 語言設定已更新:', authUserId, language);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 更新語言設定失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新使用者偏好設定
   */
  async updatePreferences(authUserId, preferences) {
    try {
      const allowedFields = ['language', 'theme', 'font_size'];
      const updates = {};

      // 只允許更新特定欄位
      for (const [key, value] of Object.entries(preferences)) {
        if (allowedFields.includes(key)) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('沒有有效的更新欄位');
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('auth_user_id', authUserId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 使用者偏好設定已更新:', authUserId);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 更新偏好設定失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取得支援的語言列表
   */
  getSupportedLanguages() {
    return {
      success: true,
      data: [
        { code: 'zh-TW', name: '繁體中文', nativeName: '繁體中文' },
        { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
        { code: 'en-US', name: 'English', nativeName: 'English' },
        { code: 'ja-JP', name: '日本語', nativeName: '日本語' },
        { code: 'ko-KR', name: '한국어', nativeName: '한국어' }
      ]
    };
  }

  /**
   * 更新長輩檔案的語言設定
   */
  async updateElderLanguage(authUserId, language) {
    try {
      const { data, error } = await supabase
        .from('elders')
        .update({
          language,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', authUserId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 長輩語言設定已更新:', authUserId, language);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 更新長輩語言設定失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 同步更新所有相關的語言設定（user_profiles 和 elders）
   */
  async updateAllLanguageSettings(authUserId, language) {
    try {
      // 更新 user_profiles
      const profileResult = await this.updateLanguage(authUserId, language);
      if (!profileResult.success) {
        throw new Error(profileResult.error);
      }

      // 檢查是否有長輩檔案
      const { data: elder } = await supabase
        .from('elders')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();

      // 如果有長輩檔案，也更新它
      if (elder) {
        await this.updateElderLanguage(authUserId, language);
      }

      console.log('✅ 所有語言設定已同步更新');
      return {
        success: true,
        data: profileResult.data,
        elderUpdated: !!elder
      };
    } catch (error) {
      console.error('❌ 同步語言設定失敗:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new UserService();
