/**
 * 家屬設定 API 路由
 * ElderCare Companion - Family Settings Management
 *
 * 功能：
 * - 查看家屬設定
 * - 更新家屬設定
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// 初始化 Supabase 客戶端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 環境變數');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 從請求中取得 auth user id
 */
async function getAuthUserId(req) {
  // 從 Authorization header 中取得 JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // 使用 Supabase 驗證 JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('JWT 驗證失敗:', error);
      return null;
    }

    return user.id; // 返回 auth_user_id
  } catch (error) {
    console.error('驗證 token 時發生錯誤:', error);
    return null;
  }
}

// ============================================================================
// 家屬設定相關 API
// ============================================================================

/**
 * GET /api/settings/family/:familyId
 * 取得家屬設定
 */
router.get('/family/:familyId', async (req, res) => {
  try {
    const authUserId = await getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { familyId } = req.params;

    // 驗證該家屬成員是否屬於當前登入的使用者
    const { data: familyMember, error: familyError } = await supabase
      .from('family_members')
      .select('id')
      .eq('id', familyId)
      .eq('auth_user_id', authUserId)
      .single();

    if (familyError || !familyMember) {
      return res.status(403).json({ error: '無權限存取此設定' });
    }

    // 查詢家屬設定
    const { data: settings, error: settingsError } = await supabase
      .from('family_settings')
      .select('*')
      .eq('family_member_id', familyId)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      // PGRST116 = 找不到資料
      console.error('查詢設定失敗:', settingsError);
      return res.status(500).json({ error: '查詢設定失敗' });
    }

    // 如果沒有設定，返回預設值
    if (!settings) {
      const defaultSettings = {
        notification_preferences: {
          email: true,
          sms: false,
          push: true
        },
        alert_thresholds: {
          medication_compliance: 70,
          missed_medication: 2,
          safe_zone_alert: true
        },
        language_preference: 'zh-TW'
      };

      return res.json({
        success: true,
        data: defaultSettings
      });
    }

    res.json({
      success: true,
      data: {
        notification_preferences: settings.notification_preferences,
        alert_thresholds: settings.alert_thresholds,
        language_preference: settings.language_preference
      }
    });
  } catch (error) {
    console.error('取得家屬設定失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/settings/family/:familyId
 * 更新家屬設定
 */
router.put('/family/:familyId', async (req, res) => {
  try {
    const authUserId = await getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { familyId } = req.params;
    const { notification_preferences, alert_thresholds, language_preference } = req.body;

    // 驗證該家屬成員是否屬於當前登入的使用者
    const { data: familyMember, error: familyError } = await supabase
      .from('family_members')
      .select('id')
      .eq('id', familyId)
      .eq('auth_user_id', authUserId)
      .single();

    if (familyError || !familyMember) {
      return res.status(403).json({ error: '無權限修改此設定' });
    }

    // 驗證輸入資料
    if (notification_preferences) {
      if (typeof notification_preferences.email !== 'boolean' ||
          typeof notification_preferences.sms !== 'boolean' ||
          typeof notification_preferences.push !== 'boolean') {
        return res.status(400).json({ error: '通知偏好格式錯誤' });
      }
    }

    if (alert_thresholds) {
      if (typeof alert_thresholds.medication_compliance !== 'number' ||
          alert_thresholds.medication_compliance < 0 ||
          alert_thresholds.medication_compliance > 100) {
        return res.status(400).json({ error: '用藥遵從率閾值必須在 0-100 之間' });
      }
      if (typeof alert_thresholds.missed_medication !== 'number' ||
          alert_thresholds.missed_medication < 1) {
        return res.status(400).json({ error: '錯過用藥次數閾值必須大於 0' });
      }
      if (typeof alert_thresholds.safe_zone_alert !== 'boolean') {
        return res.status(400).json({ error: '安全區域警示必須是布林值' });
      }
    }

    if (language_preference) {
      const allowedLanguages = ['zh-TW', 'zh-CN', 'en-US'];
      if (!allowedLanguages.includes(language_preference)) {
        return res.status(400).json({ error: '不支援的語言' });
      }
    }

    // 準備更新資料
    const updateData = {
      family_member_id: familyId,
      updated_at: new Date().toISOString()
    };

    if (notification_preferences) {
      updateData.notification_preferences = notification_preferences;
    }
    if (alert_thresholds) {
      updateData.alert_thresholds = alert_thresholds;
    }
    if (language_preference) {
      updateData.language_preference = language_preference;
    }

    // 使用 upsert 來新增或更新設定
    const { data, error } = await supabase
      .from('family_settings')
      .upsert(updateData, {
        onConflict: 'family_member_id'
      })
      .select()
      .single();

    if (error) {
      console.error('更新設定失敗:', error);
      return res.status(500).json({ error: '更新設定失敗' });
    }

    res.json({
      success: true,
      data: {
        notification_preferences: data.notification_preferences,
        alert_thresholds: data.alert_thresholds,
        language_preference: data.language_preference
      }
    });
  } catch (error) {
    console.error('更新家屬設定失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
