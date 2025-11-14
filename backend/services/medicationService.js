/**
 * Medication Service - 用藥管理業務邏輯服務
 *
 * 功能：
 * - 藥物 CRUD 操作
 * - 用藥提醒排程管理
 * - 用藥記錄管理
 * - 自動標記錯過的用藥
 * - 統計和查詢功能
 */

import { createClient } from '@supabase/supabase-js';
import cronParser from 'cron-parser';
import dotenv from 'dotenv';

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
    let query = sb
      .from('medications')
      .select('*')
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

    return { success: true, data };
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

    const { data, error } = await sb
      .from('medication_reminders')
      .insert([{
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
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ 建立提醒排程失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ 提醒排程建立成功:', data.id);
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
    // 如果更新 cron 排程，驗證格式
    if (updates.cronSchedule) {
      try {
        parseExpression(updates.cronSchedule);
      } catch (cronError) {
        console.error('❌ 無效的 cron 表達式:', cronError.message);
        return { success: false, error: 'Invalid cron schedule' };
      }
    }

    const { data, error } = await sb
      .from('medication_reminders')
      .update(updates)
      .eq('id', reminderId)
      .select()
      .single();

    if (error) {
      console.error('❌ 更新提醒排程失敗:', error.message);
      return { success: false, error: error.message };
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
    const { data, error } = await sb
      .from('medication_logs')
      .insert([{
        medication_id: logData.medicationId,
        elder_id: logData.elderId,
        scheduled_time: logData.scheduledTime,
        actual_time: logData.actualTime || null,
        status: logData.status || 'pending',
        notes: logData.notes || null,
        push_sent: logData.pushSent || false,
        family_notified: logData.familyNotified || false,
      }])
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
        confirmed_by: confirmData.confirmedBy || null,
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
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data, error } = await sb
      .from('medication_logs')
      .select('status')
      .eq('elder_id', elderId)
      .gte('scheduled_time', startDate.toISOString());

    if (error) {
      console.error('❌ 查詢用藥統計失敗:', error.message);
      return { success: false, error: error.message };
    }

    const stats = {
      total: data.length,
      taken: data.filter(log => log.status === 'taken').length,
      missed: data.filter(log => log.status === 'missed').length,
      late: data.filter(log => log.status === 'late').length,
      pending: data.filter(log => log.status === 'pending').length,
      skipped: data.filter(log => log.status === 'skipped').length,
    };

    stats.adherenceRate = stats.total > 0
      ? ((stats.taken + stats.late) / stats.total * 100).toFixed(1)
      : 0;

    return { success: true, data: stats };
  } catch (error) {
    console.error('❌ 查詢用藥統計異常:', error.message);
    return { success: false, error: error.message };
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
