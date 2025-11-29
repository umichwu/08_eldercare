/**
 * Medication Service - 用藥管理業務邏輯服務
 *
 * 功能：
 * - 藥物 CRUD 操作
 * - 用藥提醒排程管理
 * - 用藥記錄管理
 * - 自動標記錯過的用藥
 * - 統計和查詢功能
 * - Google Calendar 自動同步（可選）
 */

import { createClient } from '@supabase/supabase-js';
import cronParser from 'cron-parser';
import dotenv from 'dotenv';
import * as googleCalendarService from './googleCalendarService.js';

const { parseExpression } = cronParser;

// 載入環境變數
// 在本地開發：從根目錄的 .env 載入
// 在 Render：環境變數已經在 Dashboard 設定，dotenv.config() 不會覆蓋現有變數
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
} else {
  // 生產環境：環境變數應該由平台提供（Render Dashboard）
  dotenv.config(); // 嘗試載入，但不強制要求檔案存在
}

// 使用懶加載方式創建 Supabase 客戶端，避免在模組加載時就需要環境變數
let supabase = null;
function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

/**
 * 建立新的藥物記錄
 *
 * @param {Object} medicationData - 藥物資料
 * @returns {Promise<Object>} - 建立結果
 */
export async function createMedication(medicationData) {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('medications')
      .insert([{
        elder_id: medicationData.elderId,
        medication_name: medicationData.medicationName,
        medication_type: medicationData.medicationType || null,
        dosage: medicationData.dosage,
        instructions: medicationData.instructions || null,
        purpose: medicationData.purpose || null,
        side_effects: medicationData.sideEffects || null,
        stock_quantity: medicationData.stockQuantity || 0,
        stock_alert_threshold: medicationData.stockAlertThreshold || 7,
        // 使用正確的欄位名稱（與資料庫 schema 一致）
        prescribed_by: medicationData.prescribingDoctor || null,  // 注意：欄位名是 prescribed_by
        prescription_number: medicationData.prescriptionNumber || null,
        prescription_date: medicationData.prescriptionDate || null,
        status: medicationData.status || 'active',
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ 建立藥物失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ 藥物建立成功:', data.id);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 建立藥物異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 更新藥物資料
 *
 * @param {string} medicationId - 藥物 ID
 * @param {Object} updates - 要更新的欄位
 * @returns {Promise<Object>} - 更新結果
 */
export async function updateMedication(medicationId, updates) {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('medications')
      .update(updates)
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      console.error('❌ 更新藥物失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ 藥物更新成功:', medicationId);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 更新藥物異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 刪除藥物 (軟刪除)
 *
 * @param {string} medicationId - 藥物 ID
 * @returns {Promise<Object>} - 刪除結果
 */
export async function deleteMedication(medicationId) {
  try {
    const sb = getSupabase();
    // 注意：medications 表格的 status 限制為 'active', 'discontinued', 'expired', 'temporary'
    // 使用 'discontinued' 來代表已刪除的藥物
    const { data, error } = await sb
      .from('medications')
      .update({
        status: 'discontinued',
        updated_at: new Date().toISOString()
      })
      .eq('id', medicationId)
      .select()
      .single();

    if (error) {
      console.error('❌ 刪除藥物失敗:', error.message);
      return { success: false, error: error.message };
    }

    // 同時停用該藥物的所有提醒
    const { error: reminderError } = await sb
      .from('medication_reminders')
      .update({
        is_enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq('medication_id', medicationId);

    if (reminderError) {
      console.error('⚠️ 停用提醒失敗:', reminderError.message);
      // 不返回錯誤，因為藥物已經刪除成功
    } else {
      console.log('✅ 已停用該藥物的所有提醒');
    }

    // 自動刪除 Google Calendar 事件（如果用戶已授權）
    // 從 data 中取得 elder_id
    if (data && data.elder_id) {
      await autoDeleteFromGoogleCalendar(data.elder_id, medicationId);
    }

    console.log('✅ 藥物刪除成功 (標記為 discontinued):', medicationId);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 刪除藥物異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 取得長輩的所有藥物
 *
 * @param {string} elderId - 長輩 ID
 * @param {string} status - 藥物狀態 (optional)
 * @returns {Promise<Object>} - 查詢結果
 */
export async function getMedicationsByElder(elderId, status = 'active') {
  try {
    const sb = getSupabase();

    // ✅ 修改：同時查詢藥物和其提醒設定，以便過濾已過期的短期用藥
    let query = sb
      .from('medications')
      .select(`
        *,
        medication_reminders (
          id,
          is_short_term,
          reminder_times,
          is_enabled
        )
      `)
      .eq('elder_id', elderId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ 查詢藥物失敗:', error.message);
      return { success: false, error: error.message };
    }

    // ✅ 過濾已過期的短期用藥
    const now = new Date();
    const filteredData = data.filter(medication => {
      // 如果沒有提醒設定，保留
      if (!medication.medication_reminders || medication.medication_reminders.length === 0) {
        return true;
      }

      // 檢查是否有任何短期用藥提醒已過期
      const hasActiveReminder = medication.medication_reminders.some(reminder => {
        // 如果不是短期用藥，保留
        if (!reminder.is_short_term) {
          return true;
        }

        // 如果是短期用藥，檢查是否過期
        if (reminder.reminder_times?.endDate) {
          const endDate = new Date(reminder.reminder_times.endDate);
          endDate.setHours(23, 59, 59, 999);

          // 如果還沒過期，保留
          if (now <= endDate) {
            return true;
          }

          // 已過期，不保留
          console.log(`⏭️  過濾已過期的短期用藥: ${medication.medication_name} (結束日期: ${reminder.reminder_times.endDate})`);
          return false;
        }

        // 沒有結束日期的短期用藥，保留
        return true;
      });

      return hasActiveReminder;
    });

    console.log(`📊 藥物查詢: 總共 ${data.length} 筆，過濾後 ${filteredData.length} 筆`);

    return { success: true, data: filteredData };
  } catch (error) {
    console.error('❌ 查詢藥物異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 建立用藥提醒排程
 *
 * @param {Object} reminderData - 提醒排程資料
 * @returns {Promise<Object>} - 建立結果
 */
export async function createMedicationReminder(reminderData) {
  try {
    const sb = getSupabase();
    // 驗證 cron 表達式
    try {
      parseExpression(reminderData.cronSchedule);
    } catch (cronError) {
      console.error('❌ 無效的 cron 表達式:', cronError.message);
      return { success: false, error: 'Invalid cron schedule' };
    }

    // 獲取長輩的 FCM token
    const { data: elder } = await sb
      .from('elders')
      .select('fcm_token')
      .eq('id', reminderData.elderId)
      .single();

    // 獲取家屬的 FCM tokens
    const { data: familyRelations } = await sb
      .from('elder_family_relations')
      .select(`
        family_members!inner (
          fcm_token
        )
      `)
      .eq('elder_id', reminderData.elderId)
      .eq('status', 'active')
      .eq('can_receive_alerts', true);

    const familyTokens = familyRelations
      ? familyRelations
          .map(rel => rel.family_members.fcm_token)
          .filter(token => token && token.trim().length > 0)
      : [];

    const insertData = {
      medication_id: reminderData.medicationId,
      elder_id: reminderData.elderId,
      cron_schedule: reminderData.cronSchedule,
      timezone: reminderData.timezone || 'Asia/Taipei',
      reminder_times: reminderData.reminderTimes || null,
      auto_mark_missed_after_minutes: reminderData.autoMarkMissedAfterMinutes || 30,
      fcm_tokens: elder?.fcm_token ? [elder.fcm_token] : [],
      notify_family_if_missed: reminderData.notifyFamilyIfMissed !== false,
      family_fcm_tokens: familyTokens,
      is_enabled: reminderData.isEnabled !== false,
    };

    // ✅ 短期用藥欄位
    if (reminderData.isShortTerm !== undefined) {
      insertData.is_short_term = reminderData.isShortTerm;
    }
    if (reminderData.totalDoses !== undefined) {
      insertData.total_doses = reminderData.totalDoses;
    }
    if (reminderData.startDate !== undefined) {
      insertData.start_date = reminderData.startDate;
    }

    const { data, error } = await sb
      .from('medication_reminders')
      .insert([insertData])
      .select(`
        *,
        medications (
          medication_name
        )
      `)
      .single();

    if (error) {
      console.error('❌ 建立提醒排程失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ 提醒排程建立成功:', data.id);

    // 自動同步到 Google Calendar（如果用戶已授權）
    await autoSyncToGoogleCalendar(reminderData.elderId, reminderData.medicationId);

    return { success: true, data };
  } catch (error) {
    console.error('❌ 建立提醒排程異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 更新用藥提醒排程
 *
 * @param {string} reminderId - 提醒 ID
 * @param {Object} updates - 要更新的欄位
 * @returns {Promise<Object>} - 更新結果
 */
export async function updateMedicationReminder(reminderId, updates) {
  try {
    const sb = getSupabase();

    // 先取得現有的提醒資料
    const { data: existingReminder, error: fetchError } = await sb
      .from('medication_reminders')
      .select('medication_id, elder_id, cron_schedule')
      .eq('id', reminderId)
      .single();

    if (fetchError) {
      console.error('❌ 取得提醒排程失敗:', fetchError.message);
      return { success: false, error: fetchError.message };
    }

    // ✅ 將駝峰式命名轉換為資料庫的底線命名
    const dbUpdates = {};

    // 基本欄位映射
    const fieldMapping = {
      medicationId: 'medication_id',
      elderId: 'elder_id',
      cronSchedule: 'cron_schedule',
      reminderTimes: 'reminder_times',
      isEnabled: 'is_enabled',
      timezone: 'timezone',
      frequencyDescription: 'frequency_description',
      reminderMessage: 'reminder_message',
      reminderSound: 'reminder_sound',
      vibrate: 'vibrate',
      reminderAdvanceMinutes: 'reminder_advance_minutes',
      autoMarkMissedAfterMinutes: 'auto_mark_missed_after_minutes',
      notifyFamilyIfMissed: 'notify_family_if_missed',
      startDate: 'start_date',
      endDate: 'end_date'
    };

    // 轉換欄位名稱
    Object.keys(updates).forEach(key => {
      const dbKey = fieldMapping[key] || key; // 如果沒有映射，就用原始 key
      dbUpdates[dbKey] = updates[key];
    });

    console.log('🔄 欄位轉換:', { 原始: Object.keys(updates), 轉換後: Object.keys(dbUpdates) });

    // 如果更新 cron 排程，驗證格式
    if (dbUpdates.cron_schedule) {
      try {
        parseExpression(dbUpdates.cron_schedule);
      } catch (cronError) {
        console.error('❌ 無效的 cron 表達式:', cronError.message);
        return { success: false, error: 'Invalid cron schedule' };
      }
    }

    // 更新提醒排程（使用轉換後的欄位名稱）
    const { data, error } = await sb
      .from('medication_reminders')
      .update(dbUpdates)
      .eq('id', reminderId)
      .select()
      .single();

    if (error) {
      console.error('❌ 更新提醒排程失敗:', error.message);
      return { success: false, error: error.message };
    }

    // 如果更新了 cron_schedule 或 reminder_times，刪除今天尚未服用的舊記錄
    const isTimeUpdated = dbUpdates.cron_schedule || dbUpdates.reminder_times;

    if (isTimeUpdated) {
      console.log('🗑️  偵測到時間更新，清理今天舊的未服用記錄...');
      console.log('📊 更新內容:', {
        cron_schedule: dbUpdates.cron_schedule,
        reminder_times: dbUpdates.reminder_times
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      console.log(`🔍 查詢範圍: ${today.toISOString()} ~ ${tomorrow.toISOString()}`);

      const { data: deletedLogs, error: deleteError } = await sb
        .from('medication_logs')
        .delete()
        .eq('medication_id', existingReminder.medication_id)
        .eq('elder_id', existingReminder.elder_id)
        .eq('status', 'pending')
        .gte('scheduled_time', today.toISOString())
        .lt('scheduled_time', tomorrow.toISOString())
        .select();

      if (deleteError) {
        console.error('❌ 刪除舊記錄失敗:', deleteError.message);
      } else {
        console.log(`✅ 已刪除 ${deletedLogs?.length || 0} 筆今日未服用的舊記錄`);
        if (deletedLogs && deletedLogs.length > 0) {
          deletedLogs.forEach(log => {
            const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
              hour: '2-digit',
              minute: '2-digit'
            });
            console.log(`   - 已刪除: ${time}`);
          });
        }
      }
    } else {
      console.log('ℹ️  未偵測到時間更新，跳過清理舊記錄');
    }

    console.log('✅ 提醒排程更新成功:', reminderId);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 更新提醒排程異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 取得長輩的所有提醒排程
 *
 * @param {string} elderId - 長輩 ID
 * @returns {Promise<Object>} - 查詢結果
 */
export async function getRemindersByElder(elderId) {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('medication_reminders')
      .select(`
        *,
        medications (
          medication_name,
          dosage,
          status
        )
      `)
      .eq('elder_id', elderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ 查詢提醒排程失敗:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('❌ 查詢提醒排程異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 建立用藥記錄
 *
 * @param {Object} logData - 記錄資料
 * @returns {Promise<Object>} - 建立結果
 */
export async function createMedicationLog(logData) {
  try {
    const sb = getSupabase();

    // ✅ 先檢查是否已存在相同的記錄（防止重複）
    const { data: existing, error: checkError } = await sb
      .from('medication_logs')
      .select('id')
      .eq('medication_id', logData.medicationId)
      .eq('elder_id', logData.elderId)
      .eq('scheduled_time', logData.scheduledTime)
      .maybeSingle();

    if (checkError) {
      console.error('❌ 檢查現有記錄失敗:', checkError.message);
      // 繼續嘗試插入
    }

    if (existing) {
      console.log(`ℹ️  記錄已存在，跳過建立 (medication_id: ${logData.medicationId}, scheduled_time: ${logData.scheduledTime})`);
      return { success: true, data: existing, alreadyExists: true };
    }

    // 插入新記錄
    const insertData = {
      medication_id: logData.medicationId,
      elder_id: logData.elderId,
      scheduled_time: logData.scheduledTime,
      actual_time: logData.actualTime || null,
      status: logData.status || 'pending',
      notes: logData.notes || null,
      push_sent: logData.pushSent || false,
      family_notified: logData.familyNotified || false,
    };

    // 新增可選欄位（如果有提供的話）
    if (logData.medicationReminderId) {
      insertData.medication_reminder_id = logData.medicationReminderId;
    }

    if (logData.doseSequence !== null && logData.doseSequence !== undefined) {
      insertData.dose_sequence = logData.doseSequence;
    }

    if (logData.doseLabel) {
      insertData.dose_label = logData.doseLabel;
    }

    const { data, error } = await sb
      .from('medication_logs')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ 建立用藥記錄失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ 用藥記錄建立成功:', data.id);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 建立用藥記錄異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 確認服藥
 *
 * @param {string} logId - 記錄 ID
 * @param {Object} confirmData - 確認資料
 * @returns {Promise<Object>} - 更新結果
 */
export async function confirmMedication(logId, confirmData = {}) {
  try {
    const sb = getSupabase();
    // 先獲取原始記錄以計算延遲時間
    const { data: log, error: fetchError } = await sb
      .from('medication_logs')
      .select('scheduled_time')
      .eq('id', logId)
      .single();

    if (fetchError || !log) {
      console.error('❌ 找不到用藥記錄:', fetchError?.message);
      return { success: false, error: 'Log not found' };
    }

    const actualTime = new Date();
    const scheduledTime = new Date(log.scheduled_time);
    const delayMinutes = Math.round((actualTime - scheduledTime) / 60000);

    let status = 'taken';
    if (delayMinutes > 30) {
      status = 'late';
    }

    const { data, error } = await sb
      .from('medication_logs')
      .update({
        actual_time: actualTime.toISOString(),
        status: status,
        delay_minutes: delayMinutes > 0 ? delayMinutes : 0,
        notes: confirmData.notes || null,
        confirmed_by: confirmData.confirmedBy || 'user',  // 字串類型 (user/family/system)
        confirmed_by_user_id: confirmData.confirmedByUserId || null,  // UUID 類型
        confirmation_method: confirmData.confirmationMethod || 'manual',
        updated_at: actualTime.toISOString(),
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) {
      console.error('❌ 確認服藥失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`✅ 服藥確認成功: ${logId} (${status}, 延遲 ${delayMinutes} 分鐘)`);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 確認服藥異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 標記錯過的用藥
 *
 * @param {string} logId - 記錄 ID
 * @returns {Promise<Object>} - 更新結果
 */
export async function markMedicationAsMissed(logId) {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('medication_logs')
      .update({
        status: 'missed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', logId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('❌ 標記錯過用藥失敗:', error.message);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Log not found or already processed' };
    }

    console.log('✅ 標記錯過用藥成功:', logId);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 標記錯過用藥異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 自動標記所有過期的 pending 記錄為 missed
 *
 * @param {number} thresholdMinutes - 超過幾分鐘算錯過 (預設 30)
 * @returns {Promise<Object>} - 處理結果
 */
export async function autoMarkMissedMedications(thresholdMinutes = 30) {
  try {
    const sb = getSupabase();
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60000);

    const { data, error } = await sb
      .from('medication_logs')
      .update({
        status: 'missed',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .lt('scheduled_time', thresholdTime.toISOString())
      .select();

    if (error) {
      console.error('❌ 自動標記錯過用藥失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`✅ 自動標記錯過用藥: ${data?.length || 0} 筆記錄`);
    return { success: true, count: data?.length || 0, data };
  } catch (error) {
    console.error('❌ 自動標記錯過用藥異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 取得待處理的用藥記錄
 *
 * @param {string} elderId - 長輩 ID (optional)
 * @returns {Promise<Object>} - 查詢結果
 */
export async function getPendingMedicationLogs(elderId = null) {
  try {
    const sb = getSupabase();
    let query = sb
      .from('medication_logs')
      .select(`
        *,
        medications (
          medication_name,
          dosage
        ),
        elders (
          name
        )
      `)
      .eq('status', 'pending')
      .order('scheduled_time', { ascending: true });

    if (elderId) {
      query = query.eq('elder_id', elderId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ 查詢待處理用藥記錄失敗:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('❌ 查詢待處理用藥記錄異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 取得長輩的用藥統計
 *
 * @param {string} elderId - 長輩 ID
 * @param {number} days - 統計天數 (預設 7)
 * @returns {Promise<Object>} - 統計結果
 */
export async function getMedicationStatistics(elderId, days = 7) {
  try {
    const sb = getSupabase();

    // ✅ 修正：計算開始日期時，從「今天 00:00」往回推 N 天
    // 例如 days=1 表示「今天一整天」，days=7 表示「最近 7 天」
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days + 1); // +1 是為了包含今天
    startDate.setHours(0, 0, 0, 0); // 設定為當天 00:00

    console.log(`📊 [統計] Elder ID: ${elderId}, Days: ${days}`);
    console.log(`📊 [統計] 查詢範圍: ${startDate.toISOString()} ~ ${now.toISOString()}`);

    const { data, error } = await sb
      .from('medication_logs')
      .select('status, scheduled_time')
      .eq('elder_id', elderId)
      .gte('scheduled_time', startDate.toISOString())
      .lte('scheduled_time', now.toISOString()); // ✅ 加入結束時間限制

    if (error) {
      console.error('❌ 查詢用藥統計失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`📊 [統計] 查詢到 ${data.length} 筆記錄`);
    if (data.length > 0) {
      console.log(`📊 [統計] 記錄詳情:`, data.map(log => ({
        time: log.scheduled_time,
        status: log.status
      })));
    }

    const stats = {
      totalLogs: data.length, // ✅ 改名為 totalLogs 避免混淆
      takenCount: data.filter(log => log.status === 'taken').length,
      missedCount: data.filter(log => log.status === 'missed').length,
      lateCount: data.filter(log => log.status === 'late').length,
      pendingCount: data.filter(log => log.status === 'pending').length,
      skippedCount: data.filter(log => log.status === 'skipped').length,
    };

    // ✅ 修正遵從率計算：排除 pending（待服用）的記錄
    // 公式：(已服用 + 延遲服用) / (總數 - 待服用 - 跳過) * 100
    // pending 不計入分母（因為時間還沒到）
    // skipped 不計入分母（因為是主動跳過，不算錯過）
    const shouldTakeCount = stats.totalLogs - stats.pendingCount - stats.skippedCount;
    stats.adherenceRate = shouldTakeCount > 0
      ? Math.round((stats.takenCount + stats.lateCount) / shouldTakeCount * 100)
      : 0;

    // ✅ 新增：計算每日詳細統計
    const dailyStats = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayLogs = data.filter(log => {
        const logTime = new Date(log.scheduled_time);
        return logTime >= dayStart && logTime <= dayEnd;
      });

      const dayTaken = dayLogs.filter(log => log.status === 'taken').length;
      const dayLate = dayLogs.filter(log => log.status === 'late').length;
      const dayPending = dayLogs.filter(log => log.status === 'pending').length;
      const daySkipped = dayLogs.filter(log => log.status === 'skipped').length;
      const dayShouldTake = dayLogs.length - dayPending - daySkipped;

      const dayAdherence = dayShouldTake > 0
        ? Math.round((dayTaken + dayLate) / dayShouldTake * 100)
        : 0;

      dailyStats.push({
        date: dayStart.toISOString().split('T')[0],
        adherenceRate: dayAdherence,
        totalLogs: dayLogs.length,
        takenCount: dayTaken,
        lateCount: dayLate,
        missedCount: dayLogs.filter(log => log.status === 'missed').length,
        pendingCount: dayPending,
        skippedCount: daySkipped
      });
    }

    stats.dailyStats = dailyStats;

    console.log(`📊 [統計] 結果:`, stats);

    return { success: true, data: stats };
  } catch (error) {
    console.error('❌ 查詢用藥統計異常:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 自動同步用藥提醒到 Google Calendar
 * 此函數會靜默失敗，不影響主要業務邏輯
 *
 * @param {string} elderId - 長輩 ID
 * @param {string} medicationId - 藥物 ID
 */
async function autoSyncToGoogleCalendar(elderId, medicationId) {
  try {
    // 從 elders 表取得 user_profile_id
    const sb = getSupabase();
    const { data: elder } = await sb
      .from('elders')
      .select('user_profile_id')
      .eq('id', elderId)
      .single();

    if (!elder || !elder.user_profile_id) {
      console.log('⚠️ 無法取得 user_profile_id，跳過 Calendar 同步');
      return;
    }

    // 從 user_profiles 取得 auth_user_id
    const { data: profile } = await sb
      .from('user_profiles')
      .select('auth_user_id')
      .eq('id', elder.user_profile_id)
      .single();

    if (!profile || !profile.auth_user_id) {
      console.log('⚠️ 無法取得 auth_user_id，跳過 Calendar 同步');
      return;
    }

    const userId = profile.auth_user_id;

    // 檢查用戶是否已授權 Google Calendar
    const authStatus = await googleCalendarService.checkAuthStatus(userId);

    if (!authStatus.success || !authStatus.isAuthorized) {
      console.log('📅 用戶尚未授權 Google Calendar，跳過同步');
      return;
    }

    // 執行同步
    console.log(`📅 自動同步用藥提醒到 Google Calendar: ${medicationId}`);
    const syncResult = await googleCalendarService.syncMedicationToCalendar(userId, medicationId);

    if (syncResult.success) {
      console.log(`✅ Google Calendar 同步成功: ${syncResult.eventCount} 個事件`);
    } else {
      console.log(`⚠️ Google Calendar 同步失敗: ${syncResult.error}`);
    }
  } catch (error) {
    // 靜默失敗，不影響主要業務邏輯
    console.log('⚠️ Google Calendar 自動同步失敗（已忽略）:', error.message);
  }
}

/**
 * 自動刪除 Google Calendar 事件
 *
 * @param {string} elderId - 長輩 ID
 * @param {string} medicationId - 藥物 ID
 */
async function autoDeleteFromGoogleCalendar(elderId, medicationId) {
  try {
    const sb = getSupabase();

    // 從 elders 表取得 user_profile_id
    const { data: elder } = await sb
      .from('elders')
      .select('user_profile_id')
      .eq('id', elderId)
      .single();

    if (!elder || !elder.user_profile_id) {
      console.log('⚠️ 無法取得 user_profile_id，跳過 Calendar 刪除');
      return;
    }

    // 從 user_profiles 取得 auth_user_id
    const { data: profile } = await sb
      .from('user_profiles')
      .select('auth_user_id')
      .eq('id', elder.user_profile_id)
      .single();

    if (!profile || !profile.auth_user_id) {
      console.log('⚠️ 無法取得 auth_user_id，跳過 Calendar 刪除');
      return;
    }

    const userId = profile.auth_user_id;

    // 檢查用戶是否已授權 Google Calendar
    const authStatus = await googleCalendarService.checkAuthStatus(userId);

    if (!authStatus.success || !authStatus.isAuthorized) {
      console.log('📅 用戶尚未授權 Google Calendar，跳過刪除');
      return;
    }

    // 執行刪除
    console.log(`🗑️ 自動刪除 Google Calendar 事件: ${medicationId}`);
    const deleteResult = await googleCalendarService.deleteMedicationCalendarEvents(userId, medicationId);

    if (deleteResult.success) {
      console.log(`✅ Google Calendar 事件已刪除`);
    } else {
      console.log(`⚠️ Google Calendar 事件刪除失敗: ${deleteResult.error}`);
    }
  } catch (error) {
    // 靜默失敗，不影響主要業務邏輯
    console.log('⚠️ Google Calendar 自動刪除失敗（已忽略）:', error.message);
  }
}

export default {
  createMedication,
  updateMedication,
  deleteMedication,
  getMedicationsByElder,
  createMedicationReminder,
  updateMedicationReminder,
  getRemindersByElder,
  createMedicationLog,
  confirmMedication,
  markMedicationAsMissed,
  autoMarkMissedMedications,
  getPendingMedicationLogs,
  getMedicationStatistics,
};
