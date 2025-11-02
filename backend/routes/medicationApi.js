/**
 * Medication API Routes - 用藥管理 API 路由
 *
 * 提供完整的用藥管理 REST API 端點
 */

import express from 'express';
import {
  createMedication,
  updateMedication,
  deleteMedication,
  getMedicationsByElder,
  createMedicationReminder,
  updateMedicationReminder,
  getRemindersByElder,
  confirmMedication,
  getPendingMedicationLogs,
  getMedicationStatistics,
} from '../services/medicationService.js';
import {
  registerFCMToken,
  removeFCMToken,
} from '../services/fcmService.js';
import {
  sendTestEmail,
} from '../services/emailNotificationService.js';
import {
  manualCheckReminders,
  generateTodayMedicationLogs,
} from '../services/medicationScheduler.js';

const router = express.Router();

// ==================== 藥物管理 API ====================

/**
 * POST /api/medications
 * 建立新的藥物記錄
 */
router.post('/medications', async (req, res) => {
  try {
    const result = await createMedication(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: '建立藥物失敗',
        message: result.error,
      });
    }

    res.status(201).json({
      message: '藥物建立成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /medications):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * GET /api/medications/elder/:elderId
 * 取得長輩的所有藥物
 */
router.get('/medications/elder/:elderId', async (req, res) => {
  try {
    const { elderId } = req.params;
    const { status } = req.query; // 可選：篩選狀態

    const result = await getMedicationsByElder(elderId, status);

    if (!result.success) {
      return res.status(400).json({
        error: '查詢藥物失敗',
        message: result.error,
      });
    }

    res.json({
      message: '查詢成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (GET /medications/elder/:elderId):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * PUT /api/medications/:id
 * 更新藥物資料
 */
router.put('/medications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateMedication(id, req.body);

    if (!result.success) {
      return res.status(400).json({
        error: '更新藥物失敗',
        message: result.error,
      });
    }

    res.json({
      message: '藥物更新成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (PUT /medications/:id):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * DELETE /api/medications/:id
 * 刪除藥物（軟刪除）
 */
router.delete('/medications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteMedication(id);

    if (!result.success) {
      return res.status(400).json({
        error: '刪除藥物失敗',
        message: result.error,
      });
    }

    res.json({
      message: '藥物刪除成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (DELETE /medications/:id):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 用藥提醒排程 API ====================

/**
 * POST /api/medication-reminders
 * 建立用藥提醒排程
 */
router.post('/medication-reminders', async (req, res) => {
  try {
    const result = await createMedicationReminder(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: '建立提醒排程失敗',
        message: result.error,
      });
    }

    res.status(201).json({
      message: '提醒排程建立成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /medication-reminders):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * GET /api/medication-reminders/elder/:elderId
 * 取得長輩的所有提醒排程
 */
router.get('/medication-reminders/elder/:elderId', async (req, res) => {
  try {
    const { elderId } = req.params;
    const result = await getRemindersByElder(elderId);

    if (!result.success) {
      return res.status(400).json({
        error: '查詢提醒排程失敗',
        message: result.error,
      });
    }

    res.json({
      message: '查詢成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (GET /medication-reminders/elder/:elderId):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * PUT /api/medication-reminders/:id
 * 更新提醒排程
 */
router.put('/medication-reminders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateMedicationReminder(id, req.body);

    if (!result.success) {
      return res.status(400).json({
        error: '更新提醒排程失敗',
        message: result.error,
      });
    }

    res.json({
      message: '提醒排程更新成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (PUT /medication-reminders/:id):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 用藥記錄 API ====================

/**
 * POST /api/medication-logs/:id/confirm
 * 確認服藥
 */
router.post('/medication-logs/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await confirmMedication(id, req.body);

    if (!result.success) {
      return res.status(400).json({
        error: '確認服藥失敗',
        message: result.error,
      });
    }

    res.json({
      message: '服藥確認成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /medication-logs/:id/confirm):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * GET /api/medication-logs/pending
 * 取得待處理的用藥記錄
 */
router.get('/medication-logs/pending', async (req, res) => {
  try {
    const { elderId } = req.query;
    const result = await getPendingMedicationLogs(elderId);

    if (!result.success) {
      return res.status(400).json({
        error: '查詢待處理記錄失敗',
        message: result.error,
      });
    }

    res.json({
      message: '查詢成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (GET /medication-logs/pending):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * GET /api/medication-logs/statistics/:elderId
 * 取得用藥統計
 */
router.get('/medication-logs/statistics/:elderId', async (req, res) => {
  try {
    const { elderId } = req.params;
    const { days } = req.query; // 預設 7 天
    const result = await getMedicationStatistics(elderId, days ? parseInt(days) : 7);

    if (!result.success) {
      return res.status(400).json({
        error: '查詢統計失敗',
        message: result.error,
      });
    }

    res.json({
      message: '查詢成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (GET /medication-logs/statistics/:elderId):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== FCM Token 管理 API ====================

/**
 * POST /api/fcm/register
 * 註冊或更新 FCM Token
 */
router.post('/fcm/register', async (req, res) => {
  try {
    const { userId, userType, fcmToken, deviceInfo } = req.body;

    if (!userId || !userType || !fcmToken) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId, userType, fcmToken 為必填',
      });
    }

    if (!['elder', 'family_member'].includes(userType)) {
      return res.status(400).json({
        error: '無效的使用者類型',
        message: 'userType 必須是 elder 或 family_member',
      });
    }

    const result = await registerFCMToken(userId, userType, fcmToken, deviceInfo);

    if (!result.success) {
      return res.status(400).json({
        error: 'FCM Token 註冊失敗',
        message: result.error,
      });
    }

    res.json({
      message: 'FCM Token 註冊成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /fcm/register):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * DELETE /api/fcm/remove
 * 移除 FCM Token
 */
router.delete('/fcm/remove', async (req, res) => {
  try {
    const { userId, userType } = req.body;

    if (!userId || !userType) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId, userType 為必填',
      });
    }

    const result = await removeFCMToken(userId, userType);

    if (!result.success) {
      return res.status(400).json({
        error: 'FCM Token 移除失敗',
        message: result.error,
      });
    }

    res.json({
      message: 'FCM Token 移除成功',
    });
  } catch (error) {
    console.error('API 錯誤 (DELETE /fcm/remove):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 排程控制 API ====================

/**
 * POST /api/scheduler/check-reminders
 * 手動觸發提醒檢查
 *
 * 用途：
 * - 測試用
 * - 外部 cron 服務觸發 (如 cron-job.org)
 * - 防止 Render 免費版休眠
 */
router.post('/scheduler/check-reminders', async (req, res) => {
  try {
    await manualCheckReminders();

    res.json({
      message: '提醒檢查已執行',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('API 錯誤 (POST /scheduler/check-reminders):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * POST /api/scheduler/generate-today-logs
 * 生成今日用藥記錄
 */
router.post('/scheduler/generate-today-logs', async (req, res) => {
  try {
    const { elderId } = req.body;
    const result = await generateTodayMedicationLogs(elderId);

    if (!result.success) {
      return res.status(400).json({
        error: '生成記錄失敗',
        message: result.error,
      });
    }

    res.json({
      message: '今日用藥記錄生成成功',
      count: result.count,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /scheduler/generate-today-logs):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== Email 通知管理 API ====================

/**
 * POST /api/email/test
 * 發送測試 Email
 */
router.post('/email/test', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: '缺少 Email 參數',
        message: 'email 為必填',
      });
    }

    const result = await sendTestEmail(email);

    if (!result.success) {
      return res.status(400).json({
        error: '測試 Email 發送失敗',
        message: result.error,
      });
    }

    res.json({
      message: '測試 Email 已發送',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /email/test):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * PUT /api/elders/:id/email
 * 更新長輩的 Email 設定
 */
router.put('/elders/:id/email', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        error: '無效的 Email 格式',
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('elders')
      .update({ email: email || null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: '更新 Email 失敗',
        message: error.message,
      });
    }

    res.json({
      message: 'Email 更新成功',
      data: data,
    });
  } catch (error) {
    console.error('API 錯誤 (PUT /elders/:id/email):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * PUT /api/family-members/:id/email
 * 更新家屬的 Email 設定
 */
router.put('/family-members/:id/email', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        error: '無效的 Email 格式',
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('family_members')
      .update({ email: email || null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: '更新 Email 失敗',
        message: error.message,
      });
    }

    res.json({
      message: 'Email 更新成功',
      data: data,
    });
  } catch (error) {
    console.error('API 錯誤 (PUT /family-members/:id/email):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 健康檢查 ====================

/**
 * GET /api/medications/health
 * 健康檢查
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'medication-api',
    timestamp: new Date().toISOString(),
  });
});

export default router;
