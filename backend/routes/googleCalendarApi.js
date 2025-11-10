/**
 * Google Calendar API Routes
 * 處理 Google Calendar 整合相關的 API 端點
 */

import express from 'express';
import {
  createMedicationEvent,
  batchCreateMedicationEvents,
  updateMedicationEvent,
  deleteMedicationEvent,
  batchDeleteMedicationEvents,
  getCalendarList
} from '../services/googleCalendarService.js';

import {
  generateShortTermSchedule,
  generateAntibioticSchedule,
} from '../services/smartScheduleService.js';

const router = express.Router();

/**
 * POST /api/google-calendar/sync-medication
 * 同步單個藥物提醒到 Google Calendar
 */
router.post('/sync-medication', async (req, res) => {
  try {
    const {
      accessToken,
      medicationId,
      medicationName,
      dosage,
      instructions,
      elderId,
      schedules
    } = req.body;

    if (!accessToken) {
      return res.status(401).json({
        error: '未授權',
        message: '缺少 Google Calendar 授權 token'
      });
    }

    if (!schedules || schedules.length === 0) {
      return res.status(400).json({
        error: '參數錯誤',
        message: '缺少用藥排程資料'
      });
    }

    // 批次建立事件
    const result = await batchCreateMedicationEvents(
      accessToken,
      schedules.map(s => ({
        ...s,
        dateTime: new Date(s.dateTime)
      })),
      {
        medicationId,
        medicationName,
        dosage,
        instructions,
        elderId
      }
    );

    if (!result.success) {
      return res.status(500).json({
        error: '同步失敗',
        message: result.error
      });
    }

    // 儲存事件 ID 到資料庫
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const eventIds = result.results.success.map(s => s.eventId);

    const { error: updateError } = await supabase
      .from('medication_reminders')
      .update({
        google_calendar_event_ids: eventIds
      })
      .eq('medication_id', medicationId)
      .eq('elder_id', elderId);

    if (updateError) {
      console.warn('⚠️ 儲存事件 ID 失敗:', updateError.message);
    }

    res.json({
      message: '同步成功',
      data: {
        total: result.results.total,
        success: result.results.success.length,
        failed: result.results.failed.length,
        eventIds: eventIds,
        details: result.results
      }
    });

  } catch (error) {
    console.error('API 錯誤 (POST /google-calendar/sync-medication):', error);
    res.status(500).json({
      error: '伺服器錯誤',
      message: error.message
    });
  }
});

/**
 * POST /api/google-calendar/sync-from-reminder
 * 從提醒 ID 同步到 Google Calendar
 */
router.post('/sync-from-reminder', async (req, res) => {
  try {
    const { accessToken, reminderId } = req.body;

    if (!accessToken) {
      return res.status(401).json({
        error: '未授權',
        message: '缺少 Google Calendar 授權 token'
      });
    }

    // 從資料庫取得提醒資料
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: reminder, error: reminderError } = await supabase
      .from('medication_reminders')
      .select(`
        *,
        medications (
          id,
          medication_name,
          dosage,
          instructions
        )
      `)
      .eq('id', reminderId)
      .single();

    if (reminderError || !reminder) {
      return res.status(404).json({
        error: '找不到提醒',
        message: reminderError?.message || 'Reminder not found'
      });
    }

    // 重新生成排程
    let schedules = [];

    if (reminder.reminder_times?.schedules) {
      schedules = reminder.reminder_times.schedules.map(s => ({
        ...s,
        dateTime: new Date(s.dateTime)
      }));
    } else if (reminder.reminder_times?.isAntibiotic && reminder.reminder_times?.firstDoseDateTime) {
      schedules = generateAntibioticSchedule({
        firstDoseDateTime: reminder.reminder_times.firstDoseDateTime,
        dosesPerDay: reminder.reminder_times.dosesPerDay,
        treatmentDays: reminder.reminder_times.treatmentDays
      });
    } else if (reminder.reminder_times?.startDate) {
      schedules = generateShortTermSchedule({
        dosesPerDay: reminder.reminder_times.dosesPerDay || 3,
        timingPlan: reminder.reminder_times.timingPlan || 'plan1',
        customTimes: reminder.reminder_times.customTimes || null,
        treatmentDays: reminder.reminder_times.treatmentDays || 3,
        startDate: new Date(reminder.reminder_times.startDate)
      });
    }

    if (schedules.length === 0) {
      return res.status(400).json({
        error: '無法生成排程',
        message: '此提醒沒有排程資料'
      });
    }

    // 同步到 Google Calendar
    const result = await batchCreateMedicationEvents(
      accessToken,
      schedules,
      {
        medicationId: reminder.medication_id,
        medicationName: reminder.medications.medication_name,
        dosage: reminder.medications.dosage,
        instructions: reminder.medications.instructions,
        elderId: reminder.elder_id
      }
    );

    if (!result.success) {
      return res.status(500).json({
        error: '同步失敗',
        message: result.error
      });
    }

    // 儲存事件 ID
    const eventIds = result.results.success.map(s => s.eventId);

    const { error: updateError } = await supabase
      .from('medication_reminders')
      .update({
        google_calendar_event_ids: eventIds,
        google_calendar_synced_at: new Date().toISOString()
      })
      .eq('id', reminderId);

    if (updateError) {
      console.warn('⚠️ 儲存事件 ID 失敗:', updateError.message);
    }

    res.json({
      message: '同步成功',
      data: {
        reminderId: reminderId,
        medicationName: reminder.medications.medication_name,
        total: result.results.total,
        success: result.results.success.length,
        failed: result.results.failed.length,
        eventIds: eventIds,
        details: result.results
      }
    });

  } catch (error) {
    console.error('API 錯誤 (POST /google-calendar/sync-from-reminder):', error);
    res.status(500).json({
      error: '伺服器錯誤',
      message: error.message
    });
  }
});

/**
 * DELETE /api/google-calendar/unsync-reminder/:reminderId
 * 從 Google Calendar 移除提醒事件
 */
router.delete('/unsync-reminder/:reminderId', async (req, res) => {
  try {
    const { reminderId } = req.params;
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(401).json({
        error: '未授權',
        message: '缺少 Google Calendar 授權 token'
      });
    }

    // 從資料庫取得事件 ID
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: reminder, error: reminderError } = await supabase
      .from('medication_reminders')
      .select('google_calendar_event_ids')
      .eq('id', reminderId)
      .single();

    if (reminderError || !reminder) {
      return res.status(404).json({
        error: '找不到提醒',
        message: reminderError?.message || 'Reminder not found'
      });
    }

    const eventIds = reminder.google_calendar_event_ids || [];

    if (eventIds.length === 0) {
      return res.json({
        message: '此提醒沒有同步到 Google Calendar',
        data: { total: 0, deleted: 0 }
      });
    }

    // 批次刪除事件
    const result = await batchDeleteMedicationEvents(accessToken, eventIds);

    // 清除資料庫中的事件 ID
    const { error: updateError } = await supabase
      .from('medication_reminders')
      .update({
        google_calendar_event_ids: null,
        google_calendar_synced_at: null
      })
      .eq('id', reminderId);

    if (updateError) {
      console.warn('⚠️ 清除事件 ID 失敗:', updateError.message);
    }

    res.json({
      message: '取消同步成功',
      data: {
        total: result.results.total,
        deleted: result.results.success.length,
        failed: result.results.failed.length,
        details: result.results
      }
    });

  } catch (error) {
    console.error('API 錯誤 (DELETE /google-calendar/unsync-reminder):', error);
    res.status(500).json({
      error: '伺服器錯誤',
      message: error.message
    });
  }
});

/**
 * GET /api/google-calendar/calendars
 * 取得用戶的 Google Calendar 列表
 */
router.get('/calendars', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      return res.status(401).json({
        error: '未授權',
        message: '缺少授權 token'
      });
    }

    const result = await getCalendarList(accessToken);

    if (!result.success) {
      return res.status(500).json({
        error: '取得 Calendar 列表失敗',
        message: result.error
      });
    }

    res.json({
      message: '取得成功',
      data: result.calendars
    });

  } catch (error) {
    console.error('API 錯誤 (GET /google-calendar/calendars):', error);
    res.status(500).json({
      error: '伺服器錯誤',
      message: error.message
    });
  }
});

/**
 * POST /api/google-calendar/test-auth
 * 測試 Google Calendar 授權
 */
router.post('/test-auth', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(401).json({
        error: '未授權',
        message: '缺少授權 token'
      });
    }

    const result = await getCalendarList(accessToken);

    res.json({
      message: result.success ? '授權有效' : '授權失敗',
      success: result.success,
      error: result.error || null
    });

  } catch (error) {
    console.error('API 錯誤 (POST /google-calendar/test-auth):', error);
    res.status(500).json({
      error: '伺服器錯誤',
      message: error.message
    });
  }
});

export default router;
