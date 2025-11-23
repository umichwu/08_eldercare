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
  sendPushNotification,
  sendMedicationReminder,
} from '../services/fcmService.js';
import {
  sendTestEmail,
} from '../services/emailNotificationService.js';
import {
  generateShortTermMedicationLogs,
  補充ShortTermLogs,
} from '../services/generateShortTermLogs.js';
import {
  manualCheckReminders,
  generateTodayMedicationLogs,
} from '../services/medicationScheduler.js';
import {
  generateShortTermSchedule,
  generateAntibioticSchedule,
  schedulesToCron,
  previewSchedule,
} from '../services/smartScheduleService.js';
import { getSupabase } from '../config/supabase.js';

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

    // 將前端的 camelCase 轉換為資料庫的 snake_case
    const updates = {};
    if (req.body.medicationName !== undefined) updates.medication_name = req.body.medicationName;
    if (req.body.dosage !== undefined) updates.dosage = req.body.dosage;
    if (req.body.medicationType !== undefined) updates.medication_type = req.body.medicationType;
    if (req.body.purpose !== undefined) updates.purpose = req.body.purpose;
    if (req.body.instructions !== undefined) updates.instructions = req.body.instructions;
    if (req.body.sideEffects !== undefined) updates.side_effects = req.body.sideEffects;
    if (req.body.prescribingDoctor !== undefined) updates.prescribed_by = req.body.prescribingDoctor;
    if (req.body.stockQuantity !== undefined) updates.stock_quantity = req.body.stockQuantity;
    if (req.body.status !== undefined) updates.status = req.body.status;

    const result = await updateMedication(id, updates);

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
 * POST /api/medication-reminders/preview
 * 預覽用藥排程（不需要儲存提醒即可預覽）
 */
router.post('/medication-reminders/preview', async (req, res) => {
  try {
    const {
      dosesPerDay = 3,
      timingPlan = 'plan1',
      customTimes = null,
      treatmentDays = 3,
      startDate = new Date().toISOString().split('T')[0],
      isAntibiotic = false,
      firstDoseDateTime = null,
      medicationName = '預覽藥物'
    } = req.body;

    const days = parseInt(req.query.days) || 3;

    let schedules = [];

    if (isAntibiotic && firstDoseDateTime) {
      // 抗生素排程
      schedules = generateAntibioticSchedule({
        firstDoseDateTime,
        dosesPerDay,
        treatmentDays
      });
    } else {
      // 一般短期用藥
      schedules = generateShortTermSchedule({
        dosesPerDay,
        timingPlan,
        customTimes,
        treatmentDays,
        startDate: new Date(startDate)
      });
    }

    // 添加藥物名稱到每個排程
    schedules = schedules.map(s => ({
      ...s,
      medicationName: medicationName
    }));

    // 生成 cron 排程
    const cronData = schedulesToCron(schedules);

    // 生成預覽
    const preview = previewSchedule(schedules, days);

    res.json({
      message: '預覽生成成功',
      data: {
        preview: preview,
        totalDays: days,
        cronSchedule: cronData.cronSchedule,
        reminderTimes: cronData.reminderTimes.times,
        scheduleDetails: {
          dosesPerDay,
          timingPlan,
          customTimes,
          treatmentDays,
          startDate,
          isAntibiotic
        }
      }
    });

  } catch (error) {
    console.error('API 錯誤 (POST /medication-reminders/preview):', error);
    res.status(500).json({
      error: '預覽生成失敗',
      message: error.message
    });
  }
});

/**
 * POST /api/medication-reminders
 * 建立用藥提醒排程（支援智能排程）
 *
 * 請求參數：
 * - 傳統方式：{ medicationId, elderId, cronSchedule, reminderTimes }
 * - 智能排程：{ medicationId, elderId, useSmartSchedule: true, firstDoseDateTime, dosesPerDay, treatmentDays, isAntibiotic }
 */
router.post('/medication-reminders', async (req, res) => {
  try {
    let reminderData = { ...req.body };

    // 如果使用智能排程
    if (req.body.useSmartSchedule) {
      console.log('🧠 使用智能排程生成提醒...');

      let schedules;

      // 判斷是否為抗生素（需要嚴格間隔）
      if (req.body.isAntibiotic && req.body.firstDoseDateTime) {
        schedules = generateAntibioticSchedule({
          firstDoseDateTime: req.body.firstDoseDateTime,
          dosesPerDay: req.body.dosesPerDay || 3,
          treatmentDays: req.body.treatmentDays || 3
        });
      } else {
        // 一般短期用藥（使用預設時段）
        schedules = generateShortTermSchedule({
          dosesPerDay: req.body.dosesPerDay || 3,
          timingPlan: req.body.timingPlan || 'plan1', // 'plan1', 'plan2', or 'custom'
          customTimes: req.body.customTimes || null,  // ['08:00', '13:00', '18:00']
          treatmentDays: req.body.treatmentDays || 3,
          startDate: req.body.startDate || new Date(), // 開始日期（預設今天）
          totalDoses: req.body.totalDoses || null // ✅ 傳遞 totalDoses
        });
      }

      console.log(`📅 生成 ${schedules.length} 個用藥時間點`);

      // 轉換為 Cron 格式
      const cronInfo = schedulesToCron(schedules, req.body.timezone || 'Asia/Taipei');

      // 計算結束日期
      const endDate = new Date(schedules[schedules.length - 1].dateTime);

      // 準備提醒資料
      reminderData = {
        medicationId: req.body.medicationId,
        elderId: req.body.elderId,
        cronSchedule: cronInfo.cronSchedule,
        timezone: cronInfo.timezone,
        reminderTimes: {
          ...cronInfo.reminderTimes,
          dosesPerDay: req.body.dosesPerDay || 3,
          treatmentDays: req.body.treatmentDays || 3,
          timingPlan: req.body.timingPlan || 'plan1',
          customTimes: req.body.customTimes || null,
          startDate: req.body.startDate || new Date().toISOString().split('T')[0],
          durationType: 'shortterm',
          isAntibiotic: req.body.isAntibiotic || false,
          intervalHours: req.body.isAntibiotic ? (24 / (req.body.dosesPerDay || 3)) : null,
          endDate: endDate.toISOString().split('T')[0], // YYYY-MM-DD
        },
        autoMarkMissedAfterMinutes: req.body.autoMarkMissedAfterMinutes || 30,
        notifyFamilyIfMissed: req.body.notifyFamilyIfMissed !== false,
        isEnabled: req.body.isEnabled !== false,
      };

      console.log(`✅ 智能排程生成完成`);
      console.log(`   - Cron: ${cronInfo.cronSchedule}`);
      console.log(`   - 時段: ${cronInfo.reminderTimes.times.join(', ')}`);
    }

    // 建立提醒排程
    const result = await createMedicationReminder(reminderData);

    if (!result.success) {
      return res.status(400).json({
        error: '建立提醒排程失敗',
        message: result.error,
      });
    }

    // ✅ 如果是短期用藥，立即產生所有記錄
    if (reminderData.isShortTerm && reminderData.totalDoses) {
      console.log('🔄 短期用藥：立即產生所有記錄...');

      const medicationName = result.data.medications?.medication_name || '藥物';

      const logsResult = await generateShortTermMedicationLogs({
        reminderId: result.data.id,
        medicationId: reminderData.medicationId,
        elderId: reminderData.elderId,
        medicationName: medicationName,
        cronSchedule: reminderData.cronSchedule,
        totalDoses: reminderData.totalDoses,
        startDate: reminderData.startDate,
        timezone: reminderData.timezone || 'Asia/Taipei'
      });

      if (logsResult.success) {
        console.log(`✅ 成功產生 ${logsResult.count} 筆短期用藥記錄`);
      } else {
        console.error('⚠️  產生短期用藥記錄失敗:', logsResult.error);
      }
    }

    res.status(201).json({
      message: '提醒排程建立成功',
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /medication-reminders):', error);
    res.status(500).json({ error: '伺服器錯誤', details: error.message });
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

/**
 * GET /api/medication-reminders/:id/schedule-preview
 * 預覽用藥排程（未來 N 天）
 */
router.get('/medication-reminders/:id/schedule-preview', async (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days) || 3; // 預設顯示 3 天

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
          medication_name,
          dosage,
          medication_type
        )
      `)
      .eq('id', id)
      .single();

    if (reminderError || !reminder) {
      return res.status(404).json({
        error: '找不到提醒排程',
        message: reminderError?.message || 'Reminder not found',
      });
    }

    // 如果有智能排程資料，使用它來生成預覽
    let schedules = [];

    if (reminder.reminder_times?.schedules) {
      // 使用已生成的排程資料
      schedules = reminder.reminder_times.schedules.map(s => ({
        ...s,
        dateTime: new Date(s.dateTime)
      }));
    } else if (reminder.reminder_times?.startDate) {
      // 重新生成排程（備用方案 - 使用新參數）
      schedules = generateShortTermSchedule({
        dosesPerDay: reminder.reminder_times.dosesPerDay || 3,
        timingPlan: reminder.reminder_times.timingPlan || 'plan1',
        customTimes: reminder.reminder_times.customTimes || null,
        treatmentDays: reminder.reminder_times.treatmentDays || 3,
        startDate: reminder.reminder_times.startDate || new Date()
      });
    } else {
      // 沒有智能排程資料，返回空預覽
      return res.json({
        message: '此提醒未使用智能排程',
        data: {
          reminder: {
            id: reminder.id,
            medicationName: reminder.medications.medication_name,
            cronSchedule: reminder.cron_schedule,
          },
          preview: [],
        },
      });
    }

    // 使用 previewSchedule 生成分組預覽
    const preview = previewSchedule(schedules, days);

    res.json({
      message: '預覽生成成功',
      data: {
        reminder: {
          id: reminder.id,
          medicationName: reminder.medications.medication_name,
          dosage: reminder.medications.dosage,
          medicationType: reminder.medications.medication_type,
          cronSchedule: reminder.cron_schedule,
          timezone: reminder.timezone,
        },
        preview: preview,
        totalDays: preview.length,
      },
    });
  } catch (error) {
    console.error('API 錯誤 (GET /medication-reminders/:id/schedule-preview):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

/**
 * GET /api/elders/:elderId/schedule-preview
 * 預覽長輩的所有用藥排程（未來 N 天）
 */
router.get('/elders/:elderId/schedule-preview', async (req, res) => {
  try {
    const { elderId } = req.params;
    const days = parseInt(req.query.days) || 3;

    // 取得長輩的所有啟用的提醒
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: reminders, error: remindersError } = await supabase
      .from('medication_reminders')
      .select(`
        *,
        medications (
          medication_name,
          dosage,
          medication_type
        )
      `)
      .eq('elder_id', elderId)
      .eq('is_enabled', true);

    if (remindersError) {
      return res.status(400).json({
        error: '查詢提醒失敗',
        message: remindersError.message,
      });
    }

    // 合併所有提醒的排程
    const allSchedules = [];

    for (const reminder of reminders) {
      let schedules = [];

      if (reminder.reminder_times?.schedules) {
        schedules = reminder.reminder_times.schedules.map(s => ({
          ...s,
          dateTime: new Date(s.dateTime),
          medicationName: reminder.medications.medication_name,
          dosage: reminder.medications.dosage,
          reminderId: reminder.id,
        }));
      } else if (reminder.reminder_times?.startDate) {
        schedules = generateShortTermSchedule({
          dosesPerDay: reminder.reminder_times.dosesPerDay || 3,
          timingPlan: reminder.reminder_times.timingPlan || 'plan1',
          customTimes: reminder.reminder_times.customTimes || null,
          treatmentDays: reminder.reminder_times.treatmentDays || 3,
          startDate: reminder.reminder_times.startDate || new Date()
        }).map(s => ({
          ...s,
          medicationName: reminder.medications.medication_name,
          dosage: reminder.medications.dosage,
          reminderId: reminder.id,
        }));
      }

      allSchedules.push(...schedules);
    }

    // 按時間排序
    allSchedules.sort((a, b) => a.dateTime - b.dateTime);

    // 使用 previewSchedule 生成分組預覽
    const preview = previewSchedule(allSchedules, days);

    res.json({
      message: '預覽生成成功',
      data: {
        elderId: elderId,
        preview: preview,
        totalDays: preview.length,
        totalMedications: reminders.length,
      },
    });
  } catch (error) {
    console.error('API 錯誤 (GET /elders/:elderId/schedule-preview):', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
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
 * POST /api/medication-logs/:id/cancel
 * 取消確認服藥（將狀態改回 pending）
 */
router.post('/medication-logs/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { cancelledBy, cancelReason } = req.body;

    const { data: log, error: fetchError } = await getSupabase()
      .from('medication_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !log) {
      return res.status(404).json({
        error: '找不到用藥記錄',
        message: fetchError?.message
      });
    }

    // 只允許取消已服用的記錄
    if (log.status !== 'taken') {
      return res.status(400).json({
        error: '只能取消「已服用」狀態的記錄',
        message: `當前狀態：${log.status}`
      });
    }

    // 更新狀態為 pending
    const { data, error } = await getSupabase()
      .from('medication_logs')
      .update({
        status: 'pending',
        confirmed_by: null,
        confirmed_by_user_id: null,
        taken_at: null,
        confirmation_method: null,
        updated_at: new Date().toISOString(),
        // 記錄取消資訊（如果需要的話）
        notes: log.notes
          ? `${log.notes}\n[已取消確認 - ${cancelReason || '使用者修正'}]`
          : `[已取消確認 - ${cancelReason || '使用者修正'}]`
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('取消確認失敗:', error);
      return res.status(500).json({
        error: '取消確認失敗',
        message: error.message
      });
    }

    console.log(`✅ 取消確認成功: 記錄 ${id}`);

    res.json({
      message: '取消確認成功，狀態已改為待服用',
      data
    });
  } catch (error) {
    console.error('API 錯誤 (POST /medication-logs/:id/cancel):', error);
    res.status(500).json({ error: '伺服器錯誤', details: error.message });
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

/**
 * GET /api/medication-logs/elder/:elderId
 * 取得長輩的所有用藥記錄（供家屬查看）
 */
router.get('/medication-logs/elder/:elderId', async (req, res) => {
  try {
    const { elderId } = req.params;
    const { days, status } = req.query;

    console.log('🔍 [DEBUG] 查詢參數:', { elderId, days, status });

    const daysFilter = days ? parseInt(days) : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysFilter);

    console.log('🔍 [DEBUG] 日期範圍:', {
      daysFilter,
      startDate: startDate.toISOString(),
      now: new Date().toISOString()
    });

    // 查詢用藥記錄
    const { supabaseAdmin } = await import('../config/supabase.js');
    let query = supabaseAdmin
      .from('medication_logs')
      .select(`
        id,
        scheduled_time,
        actual_time,
        status,
        notes,
        dose_sequence,
        dose_label,
        created_at,
        medications (
          id,
          medication_name,
          dosage,
          status
        )
      `)
      .eq('elder_id', elderId)
      .gte('scheduled_time', startDate.toISOString())
      .order('scheduled_time', { ascending: false });

    // 狀態篩選
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    console.log('🔍 [DEBUG] 執行查詢...');
    const { data, error } = await query;
    console.log('🔍 [DEBUG] 查詢結果:', { dataLength: data?.length, hasError: !!error });

    if (error) {
      console.error('查詢用藥記錄失敗:', error);
      return res.status(400).json({
        error: '查詢失敗',
        message: error.message,
      });
    }

    // 整理資料格式，過濾掉已刪除的藥物記錄
    const logs = data
      .filter(log => log.medications && log.medications.status === 'active')
      .map(log => ({
        id: log.id,
        medication_name: log.medications.medication_name,
        dosage: log.medications.dosage,
        scheduled_time: log.scheduled_time,
        actual_time: log.actual_time,
        status: log.status,
        notes: log.notes,
        dose_sequence: log.dose_sequence, // ✅ 加入短期用藥序號
        dose_label: log.dose_label, // ✅ 加入短期用藥標籤
        created_at: log.created_at
      }));

    res.json({
      success: true,
      message: '查詢成功',
      data: logs
    });
  } catch (error) {
    console.error('API 錯誤 (GET /medication-logs/elder/:elderId):', error);
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
 * 生成指定日期的用藥記錄
 */
router.post('/scheduler/generate-today-logs', async (req, res) => {
  try {
    const { elderId, targetDate } = req.body; // ✅ 新增 targetDate 參數
    const result = await generateTodayMedicationLogs(elderId, targetDate);

    if (!result.success) {
      return res.status(400).json({
        error: '生成記錄失敗',
        message: result.error,
      });
    }

    res.json({
      message: targetDate ? `用藥記錄生成成功 (${targetDate})` : '今日用藥記錄生成成功',
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
// ==================== FCM 測試 API ====================

/**
 * POST /api/fcm/test-push
 * 發送測試 FCM 推送通知
 */
router.post('/fcm/test-push', async (req, res) => {
  try {
    const { elderId } = req.body;

    if (!elderId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'elderId 為必填',
      });
    }

    // 先從資料庫取得長輩的 FCM Token
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: elder, error: elderError } = await supabase
      .from('elders')
      .select('fcm_token, name')
      .eq('id', elderId)
      .single();

    if (elderError || !elder) {
      return res.status(404).json({
        error: '找不到長輩資料',
        message: elderError?.message || 'Elder not found',
      });
    }

    if (!elder.fcm_token) {
      return res.status(400).json({
        error: 'FCM Token 未註冊',
        message: '請先註冊 FCM Token',
      });
    }

    // 使用 FCM Token 發送推送通知
    const result = await sendPushNotification(
      elder.fcm_token,
      {
        title: '🔔 測試通知',
        body: '這是一個測試推送通知！如果您看到此訊息，表示 FCM 推送功能正常運作。',
      },
      {
        type: 'test',
        timestamp: new Date().toISOString(),
      }
    );

    if (!result.success) {
      return res.status(400).json({
        error: '推送通知發送失敗',
        message: result.error,
      });
    }

    res.json({
      message: 'FCM 測試推送已發送',
      elderName: elder.name,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /fcm/test-push):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * POST /api/fcm/test-medication-reminder
 * 發送測試用藥提醒推送
 */
router.post('/fcm/test-medication-reminder', async (req, res) => {
  try {
    const { elderId } = req.body;

    if (!elderId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'elderId 為必填',
      });
    }

    const result = await sendMedicationReminder(elderId, {
      medicationId: 'test-id',
      medicationName: '測試藥物',
      dosage: '1 顆',
      scheduledTime: new Date().toISOString(),
    });

    if (!result.success) {
      return res.status(400).json({
        error: '用藥提醒推送發送失敗',
        message: result.error,
      });
    }

    res.json({
      message: '用藥提醒推送已發送',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /fcm/test-medication-reminder):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * DELETE /api/medication-logs/today-pending/:medicationId
 * 刪除指定藥物今日尚未服用的記錄
 * 用於更新提醒時間時，清除舊的待服用記錄
 */
router.delete('/medication-logs/today-pending/:medicationId', async (req, res) => {
  try {
    const { medicationId } = req.params;
    const { elderId } = req.query;

    if (!elderId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'elderId 為必填',
      });
    }

    // 取得今日的開始和結束時間
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('🗑️ 刪除今日尚未服用的記錄:', {
      medicationId,
      elderId,
      todayStart: today.toISOString(),
      todayEnd: tomorrow.toISOString()
    });

    // 使用 Supabase 刪除
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('medication_logs')
      .delete()
      .eq('medication_id', medicationId)
      .eq('elder_id', elderId)
      .eq('status', 'pending')
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', tomorrow.toISOString())
      .select();

    if (error) {
      console.error('❌ 刪除記錄失敗:', error);
      return res.status(400).json({
        error: '刪除記錄失敗',
        message: error.message,
      });
    }

    console.log(`✅ 已刪除 ${data?.length || 0} 筆今日尚未服用的記錄`);

    res.json({
      success: true,
      message: '今日尚未服用的記錄已刪除',
      deletedCount: data?.length || 0,
      data: data,
    });
  } catch (error) {
    console.error('API 錯誤 (DELETE /medication-logs/today-pending/:medicationId):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * POST /api/medication-reminders/:id/generate-short-term-logs
 * 為短期用藥提醒產生所有記錄
 */
router.post('/medication-reminders/:id/generate-short-term-logs', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔄 收到產生短期用藥記錄請求: reminder_id=${id}`);

    const result = await 補充ShortTermLogs(id);

    if (!result.success) {
      return res.status(400).json({
        error: '產生記錄失敗',
        message: result.error,
      });
    }

    res.json({
      message: result.message || '產生成功',
      count: result.count,
      data: result.data,
    });
  } catch (error) {
    console.error('API 錯誤 (POST /medication-reminders/:id/generate-short-term-logs):', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'medication-api',
    timestamp: new Date().toISOString(),
  });
});

export default router;
