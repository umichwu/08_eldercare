/**
 * Daily Reminder API Routes - 生活提醒 API 路由
 *
 * 提供完整的生活提醒 REST API 端點
 */

import express from 'express';
import {
  createDailyReminder,
  updateDailyReminder,
  deleteDailyReminder,
  toggleDailyReminder,
  getRemindersByElder,
  getReminderById,
  confirmReminderLog,
  getTodayReminderLogs,
  getReminderStatistics,
} from '../services/dailyReminderService.js';

import {
  manualCheckReminders,
} from '../services/dailyReminderScheduler.js';

import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// ==================== 提醒管理 API ====================

/**
 * POST /api/daily-reminders
 * 建立新的生活提醒
 */
router.post('/daily-reminders', async (req, res) => {
  try {
    const result = await createDailyReminder(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: '建立提醒失敗',
        message: result.error,
      });
    }

    res.status(201).json({
      message: '提醒建立成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /daily-reminders):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * GET /api/daily-reminders/elder/:elderId
 * 取得長輩的所有提醒
 *
 * Query Parameters:
 * - category: 篩選類別 (water, meal, exercise, etc.)
 * - status: 篩選狀態 (active, paused, completed, cancelled)
 */
router.get('/daily-reminders/elder/:elderId', async (req, res) => {
  try {
    const { elderId } = req.params;
    const { category, status } = req.query;

    const result = await getRemindersByElder(elderId, category, status);

    if (!result.success) {
      return res.status(400).json({
        error: '查詢提醒失敗',
        message: result.error,
      });
    }

    res.json({
      message: '查詢成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (GET /daily-reminders/elder/:elderId):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * GET /api/daily-reminders/:id
 * 取得單一提醒詳情
 */
router.get('/daily-reminders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await getReminderById(id);

    if (!result.success) {
      return res.status(404).json({
        error: '找不到提醒',
        message: result.error,
      });
    }

    res.json({
      message: '查詢成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (GET /daily-reminders/:id):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * PUT /api/daily-reminders/:id
 * 更新提醒設定
 */
router.put('/daily-reminders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await updateDailyReminder(id, updates);

    if (!result.success) {
      return res.status(400).json({
        error: '更新提醒失敗',
        message: result.error,
      });
    }

    res.json({
      message: '提醒更新成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (PUT /daily-reminders/:id):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * DELETE /api/daily-reminders/:id
 * 刪除提醒（軟刪除：設定為 cancelled）
 */
router.delete('/daily-reminders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await deleteDailyReminder(id);

    if (!result.success) {
      return res.status(400).json({
        error: '刪除提醒失敗',
        message: result.error,
      });
    }

    res.json({
      message: '提醒刪除成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (DELETE /daily-reminders/:id):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * POST /api/daily-reminders/:id/toggle
 * 暫停/恢復提醒
 *
 * Body: { pause: true/false }
 */
router.post('/daily-reminders/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { pause } = req.body;

    if (typeof pause !== 'boolean') {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'pause 必須是 boolean',
      });
    }

    const result = await toggleDailyReminder(id, pause);

    if (!result.success) {
      return res.status(400).json({
        error: `${pause ? '暫停' : '恢復'}提醒失敗`,
        message: result.error,
      });
    }

    res.json({
      message: `提醒已${pause ? '暫停' : '恢復'}`,
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /daily-reminders/:id/toggle):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 提醒記錄 API ====================

/**
 * GET /api/daily-reminder-logs/today/:elderId
 * 取得今日提醒記錄
 *
 * Query Parameters:
 * - category: 篩選類別（可選）
 */
router.get('/daily-reminder-logs/today/:elderId', async (req, res) => {
  try {
    const { elderId } = req.params;
    const { category } = req.query;

    const result = await getTodayReminderLogs(elderId, category);

    if (!result.success) {
      return res.status(400).json({
        error: '查詢今日提醒失敗',
        message: result.error,
      });
    }

    res.json({
      message: '查詢成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (GET /daily-reminder-logs/today/:elderId):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * GET /api/daily-reminder-logs/elder/:elderId
 * 取得長輩的歷史提醒記錄
 *
 * Query Parameters:
 * - days: 查詢天數（預設 7 天）
 * - category: 篩選類別（可選）
 * - status: 篩選狀態（可選）
 */
router.get('/daily-reminder-logs/elder/:elderId', async (req, res) => {
  try {
    const { elderId } = req.params;
    const { days, category, status } = req.query;

    const daysFilter = days ? parseInt(days) : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysFilter);

    let query = supabaseAdmin
      .from('daily_reminder_logs')
      .select(`
        *,
        daily_reminders (
          title,
          description,
          category_specific_data
        ),
        reminder_categories (
          name_zh,
          icon,
          color
        )
      `)
      .eq('elder_id', elderId)
      .gte('scheduled_time', startDate.toISOString())
      .order('scheduled_time', { ascending: false });

    // 篩選類別
    if (category) {
      query = query.eq('category', category);
    }

    // 篩選狀態
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('查詢歷史提醒記錄失敗:', error);
      return res.status(400).json({
        error: '查詢失敗',
        message: error.message,
      });
    }

    res.json({
      success: true,
      message: '查詢成功',
      data: data || [],
    });
  } catch (error) {
    console.error('API 錯誤 (GET /daily-reminder-logs/elder/:elderId):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * POST /api/daily-reminder-logs/:id/confirm
 * 確認完成提醒
 *
 * Body: {
 *   confirmedBy: 'elder' | 'family_member',
 *   confirmedByUserId: 'uuid' (optional),
 *   confirmationMethod: 'app' | 'voice' | 'manual',
 *   responseData: { ... } (optional, 例如飲水量、運動時長),
 *   notes: 'string' (optional)
 * }
 */
router.post('/daily-reminder-logs/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      confirmedBy,
      confirmedByUserId,
      confirmationMethod = 'app',
      responseData,
      notes,
    } = req.body;

    if (!confirmedBy) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'confirmedBy 為必填',
      });
    }

    const result = await confirmReminderLog(
      id,
      confirmedBy,
      confirmedByUserId,
      confirmationMethod,
      responseData,
      notes
    );

    if (!result.success) {
      return res.status(400).json({
        error: '確認提醒失敗',
        message: result.error,
      });
    }

    res.json({
      message: '提醒已確認完成',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /daily-reminder-logs/:id/confirm):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * POST /api/daily-reminder-logs/:id/skip
 * 跳過提醒
 *
 * Body: {
 *   reason: 'string' (optional)
 * }
 */
router.post('/daily-reminder-logs/:id/skip', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data, error } = await supabaseAdmin
      .from('daily_reminder_logs')
      .update({
        status: 'skipped',
        notes: reason || '使用者選擇跳過',
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('跳過提醒失敗:', error);
      return res.status(400).json({
        error: '跳過提醒失敗',
        message: error.message,
      });
    }

    res.json({
      message: '提醒已跳過',
      data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /daily-reminder-logs/:id/skip):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 統計資料 API ====================

/**
 * GET /api/daily-reminder-logs/statistics/:elderId
 * 取得提醒統計資料
 *
 * Query Parameters:
 * - days: 統計天數（預設 7 天）
 * - category: 特定類別（可選）
 */
router.get('/daily-reminder-logs/statistics/:elderId', async (req, res) => {
  try {
    const { elderId } = req.params;
    const { days, category } = req.query;

    const daysFilter = days ? parseInt(days) : 7;

    const result = await getReminderStatistics(elderId, daysFilter, category);

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
    console.error('API 錯誤 (GET /daily-reminder-logs/statistics/:elderId):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 提醒類別 API ====================

/**
 * GET /api/reminder-categories
 * 取得所有提醒類別
 */
router.get('/reminder-categories', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('reminder_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('查詢提醒類別失敗:', error);
      return res.status(400).json({
        error: '查詢失敗',
        message: error.message,
      });
    }

    res.json({
      success: true,
      message: '查詢成功',
      data: data || [],
    });
  } catch (error) {
    console.error('API 錯誤 (GET /reminder-categories):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 排程控制 API ====================

/**
 * POST /api/daily-reminders/scheduler/check
 * 手動觸發提醒檢查（測試用）
 */
router.post('/daily-reminders/scheduler/check', async (req, res) => {
  try {
    await manualCheckReminders();

    res.json({
      message: '提醒檢查已執行',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('API 錯誤 (POST /scheduler/check):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 快捷操作 API ====================

/**
 * POST /api/daily-reminders/quick-create
 * 快速建立常用提醒（使用預設模板）
 *
 * Body: {
 *   elderId: 'uuid',
 *   template: 'water-morning' | 'water-noon' | 'water-evening' | 'exercise-afternoon' | 'sleep-night'
 * }
 */
router.post('/daily-reminders/quick-create', async (req, res) => {
  try {
    const { elderId, template } = req.body;

    if (!elderId || !template) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'elderId 和 template 為必填',
      });
    }

    // 預設模板
    const templates = {
      'water-morning': {
        category: 'water',
        title: '早上喝水',
        description: '起床後補充水分',
        cronSchedule: '0 8 * * *',
        reminderTimes: { times: ['08:00'] },
        categorySpecificData: { targetAmount: 250, unit: 'ml' },
      },
      'water-noon': {
        category: 'water',
        title: '中午喝水',
        description: '午餐後補充水分',
        cronSchedule: '0 12 * * *',
        reminderTimes: { times: ['12:00'] },
        categorySpecificData: { targetAmount: 250, unit: 'ml' },
      },
      'water-evening': {
        category: 'water',
        title: '晚上喝水',
        description: '晚餐後補充水分',
        cronSchedule: '0 18 * * *',
        reminderTimes: { times: ['18:00'] },
        categorySpecificData: { targetAmount: 250, unit: 'ml' },
      },
      'exercise-afternoon': {
        category: 'exercise',
        title: '下午散步',
        description: '出門走走，活動身體',
        cronSchedule: '0 15 * * *',
        reminderTimes: { times: ['15:00'] },
        categorySpecificData: {
          exerciseType: 'walking',
          targetDuration: 30,
          intensity: 'light',
        },
      },
      'sleep-night': {
        category: 'sleep',
        title: '就寢提醒',
        description: '該準備睡覺囉',
        cronSchedule: '0 22 * * *',
        reminderTimes: { times: ['22:00'] },
        categorySpecificData: {
          sleepType: 'bedtime',
          targetTime: '22:00',
        },
      },
    };

    const templateData = templates[template];

    if (!templateData) {
      return res.status(400).json({
        error: '無效的模板',
        message: `template 必須是: ${Object.keys(templates).join(', ')}`,
      });
    }

    // 建立提醒
    const result = await createDailyReminder({
      elderId,
      ...templateData,
    });

    if (!result.success) {
      return res.status(400).json({
        error: '建立提醒失敗',
        message: result.error,
      });
    }

    res.status(201).json({
      message: '快速提醒建立成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /quick-create):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ==================== 健康檢查 ====================

/**
 * GET /api/daily-reminders/health
 * 健康檢查
 */
router.get('/daily-reminders/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'daily-reminder-api',
    timestamp: new Date().toISOString(),
  });
});

export default router;
