/**
 * 警示系統 API 路由
 * 提供家屬監控面板的警示功能
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
  console.error('   需要: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 輔助函數：從請求中取得使用者 ID
 */
function getAuthUserId(req) {
  return req.headers['x-user-id'] || req.query.userId || req.body.userId;
}

/**
 * 輔助函數：取得使用者 Profile ID
 */
async function getUserProfileId(authUserId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single();

  if (error || !data) {
    throw new Error('無法取得使用者資料');
  }

  return data.id;
}

/**
 * 輔助函數：驗證家屬與長者的關係
 */
async function verifyFamilyRelationship(familyMemberId, elderId) {
  const { data, error } = await supabase
    .from('family_elder_relationships')
    .select('id, status')
    .eq('family_member_id', familyMemberId)
    .eq('elder_id', elderId)
    .eq('status', 'active')
    .single();

  return !!data && !error;
}

// ============================================================================
// 警示相關 API
// ============================================================================

/**
 * GET /api/alerts/elder/:elderId
 * 取得指定長者的警示列表
 */
router.get('/elder/:elderId', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { elderId } = req.params;
    const { status, severity, type, limit = 50, offset = 0 } = req.query;

    const familyMemberId = await getUserProfileId(authUserId);

    // 驗證家屬關係
    const hasAccess = await verifyFamilyRelationship(familyMemberId, elderId);
    if (!hasAccess) {
      return res.status(403).json({ error: '無權限存取此長者的警示' });
    }

    // 建立查詢
    let query = supabase
      .from('v_alert_details')
      .select('*')
      .eq('elder_id', elderId);

    // 應用篩選條件
    if (status) {
      query = query.eq('status', status);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (type) {
      query = query.eq('alert_type', type);
    }

    // 排序和分頁
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: alerts, error } = await query;

    if (error) {
      console.error('取得警示列表錯誤:', error);
      return res.status(500).json({ error: '取得警示列表失敗' });
    }

    res.json({
      success: true,
      alerts: alerts || [],
      count: alerts?.length || 0,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('取得警示列表失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/alerts/statistics/:elderId
 * 取得指定長者的警示統計
 */
router.get('/statistics/:elderId', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { elderId } = req.params;
    const familyMemberId = await getUserProfileId(authUserId);

    // 驗證家屬關係
    const hasAccess = await verifyFamilyRelationship(familyMemberId, elderId);
    if (!hasAccess) {
      return res.status(403).json({ error: '無權限存取此長者的警示統計' });
    }

    const { data: stats, error } = await supabase
      .from('v_alert_statistics')
      .select('*')
      .eq('elder_id', elderId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('取得警示統計錯誤:', error);
      return res.status(500).json({ error: '取得警示統計失敗' });
    }

    // 如果沒有資料，返回預設值
    const statistics = stats || {
      elder_id: elderId,
      total_alerts: 0,
      pending_count: 0,
      acknowledged_count: 0,
      resolved_count: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      medication_count: 0,
      health_count: 0,
      activity_count: 0,
      emergency_count: 0,
      latest_pending_at: null
    };

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('取得警示統計失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/alerts
 * 建立新警示
 */
router.post('/', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const {
      elderId,
      alertType,
      severity = 'medium',
      title,
      description,
      metadata = {}
    } = req.body;

    // 驗證必要欄位
    if (!elderId || !alertType || !title) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }

    // 驗證警示類型
    const validTypes = ['medication', 'health', 'activity', 'emergency', 'vital_signs'];
    if (!validTypes.includes(alertType)) {
      return res.status(400).json({ error: '無效的警示類型' });
    }

    // 驗證嚴重程度
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({ error: '無效的嚴重程度' });
    }

    const familyMemberId = await getUserProfileId(authUserId);

    // 驗證家屬關係（或管理員權限）
    const hasAccess = await verifyFamilyRelationship(familyMemberId, elderId);
    if (!hasAccess) {
      // 檢查是否為管理員
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', familyMemberId)
        .single();

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ error: '無權限為此長者建立警示' });
      }
    }

    // 建立警示
    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        elder_id: elderId,
        alert_type: alertType,
        severity: severity,
        title: title,
        description: description,
        metadata: metadata,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('建立警示錯誤:', error);
      return res.status(500).json({ error: '建立警示失敗' });
    }

    res.json({
      success: true,
      alert,
      message: '警示建立成功'
    });
  } catch (error) {
    console.error('建立警示失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/alerts/:alertId/acknowledge
 * 確認警示（標記為已確認）
 */
router.put('/:alertId/acknowledge', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { alertId } = req.params;
    const familyMemberId = await getUserProfileId(authUserId);

    // 取得警示資訊
    const { data: alert, error: fetchError } = await supabase
      .from('alerts')
      .select('elder_id, status')
      .eq('id', alertId)
      .single();

    if (fetchError || !alert) {
      return res.status(404).json({ error: '找不到警示' });
    }

    // 驗證權限
    const hasAccess = await verifyFamilyRelationship(familyMemberId, alert.elder_id);
    if (!hasAccess) {
      return res.status(403).json({ error: '無權限操作此警示' });
    }

    // 更新為已確認
    const { error: updateError } = await supabase
      .from('alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (updateError) {
      console.error('確認警示錯誤:', updateError);
      return res.status(500).json({ error: '確認警示失敗' });
    }

    res.json({
      success: true,
      message: '警示已確認'
    });
  } catch (error) {
    console.error('確認警示失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/alerts/:alertId/resolve
 * 解決警示（標記為已解決）
 */
router.put('/:alertId/resolve', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { alertId } = req.params;
    const { resolutionNote } = req.body;

    const familyMemberId = await getUserProfileId(authUserId);

    // 取得警示資訊
    const { data: alert, error: fetchError } = await supabase
      .from('alerts')
      .select('elder_id, status')
      .eq('id', alertId)
      .single();

    if (fetchError || !alert) {
      return res.status(404).json({ error: '找不到警示' });
    }

    // 驗證權限
    const hasAccess = await verifyFamilyRelationship(familyMemberId, alert.elder_id);
    if (!hasAccess) {
      return res.status(403).json({ error: '無權限操作此警示' });
    }

    // 更新為已解決
    const { error: updateError } = await supabase
      .from('alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: familyMemberId,
        resolution_note: resolutionNote || null
      })
      .eq('id', alertId);

    if (updateError) {
      console.error('解決警示錯誤:', updateError);
      return res.status(500).json({ error: '解決警示失敗' });
    }

    res.json({
      success: true,
      message: '警示已解決'
    });
  } catch (error) {
    console.error('解決警示失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/alerts/:alertId/dismiss
 * 忽略警示（標記為已忽略）
 */
router.put('/:alertId/dismiss', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { alertId } = req.params;
    const { resolutionNote } = req.body;

    const familyMemberId = await getUserProfileId(authUserId);

    // 取得警示資訊
    const { data: alert, error: fetchError } = await supabase
      .from('alerts')
      .select('elder_id, status')
      .eq('id', alertId)
      .single();

    if (fetchError || !alert) {
      return res.status(404).json({ error: '找不到警示' });
    }

    // 驗證權限
    const hasAccess = await verifyFamilyRelationship(familyMemberId, alert.elder_id);
    if (!hasAccess) {
      return res.status(403).json({ error: '無權限操作此警示' });
    }

    // 更新為已忽略
    const { error: updateError } = await supabase
      .from('alerts')
      .update({
        status: 'dismissed',
        resolved_at: new Date().toISOString(),
        resolved_by: familyMemberId,
        resolution_note: resolutionNote || null
      })
      .eq('id', alertId);

    if (updateError) {
      console.error('忽略警示錯誤:', updateError);
      return res.status(500).json({ error: '忽略警示失敗' });
    }

    res.json({
      success: true,
      message: '警示已忽略'
    });
  } catch (error) {
    console.error('忽略警示失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/alerts/:alertId
 * 刪除警示（僅管理員）
 */
router.delete('/:alertId', async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { alertId } = req.params;
    const familyMemberId = await getUserProfileId(authUserId);

    // 檢查是否為管理員
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', familyMemberId)
      .single();

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: '只有管理員可以刪除警示' });
    }

    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', alertId);

    if (error) {
      console.error('刪除警示錯誤:', error);
      return res.status(500).json({ error: '刪除警示失敗' });
    }

    res.json({
      success: true,
      message: '警示已刪除'
    });
  } catch (error) {
    console.error('刪除警示失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/alerts/health
 * 健康檢查端點
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'alerts-api',
    timestamp: new Date().toISOString()
  });
});

export default router;
