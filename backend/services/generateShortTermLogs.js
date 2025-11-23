/**
 * 短期用藥記錄產生服務
 *
 * 核心概念：
 * - 在建立短期用藥提醒時，立即產生所有記錄
 * - 根據建立時間智能過濾時段
 * - 精確標記序號
 */

import { getSupabase } from '../config/supabase.js';
import cronParser from 'cron-parser';

/**
 * 為短期用藥提醒產生所有記錄
 *
 * @param {Object} params - 參數
 * @param {string} params.reminderId - 提醒 ID
 * @param {string} params.medicationId - 藥物 ID
 * @param {string} params.elderId - 長輩 ID
 * @param {string} params.medicationName - 藥物名稱
 * @param {string} params.cronSchedule - Cron 表達式
 * @param {number} params.totalDoses - 總次數
 * @param {string} params.startDate - 開始日期 (YYYY-MM-DD)
 * @param {string} params.timezone - 時區
 * @returns {Promise<Object>} - 產生結果
 */
export async function generateShortTermMedicationLogs(params) {
  const {
    reminderId,
    medicationId,
    elderId,
    medicationName,
    cronSchedule,
    totalDoses,
    startDate,
    timezone = 'Asia/Taipei'
  } = params;

  try {
    const sb = getSupabase();
    const now = new Date();

    // ✅ 使用 startDate 作為起始點，而非當前時間
    const startDateObj = startDate ? new Date(startDate) : new Date();
    startDateObj.setHours(0, 0, 0, 0); // 設定為當天 00:00

    // 解析 cron 表達式，從 startDate 開始往後計算
    const options = {
      currentDate: startDateObj,
      tz: timezone
    };

    const interval = cronParser.parseExpression(cronSchedule, options);

    const logs = [];
    let doseSequence = 1;

    console.log(`📊 開始產生短期用藥記錄...`);
    console.log(`   藥物: ${medicationName}`);
    console.log(`   總次數: ${totalDoses}`);
    console.log(`   開始日期: ${startDateObj.toLocaleDateString('zh-TW')}`);
    console.log(`   Cron: ${cronSchedule}`);

    // 產生所有記錄
    while (doseSequence <= totalDoses) {
      try {
        const nextTime = interval.next().toDate();

        // ✅ 直接產生記錄，不需要過濾（因為已從 startDate 開始解析）

        const doseLabel = `${medicationName}-${doseSequence}`;

        logs.push({
          medication_id: medicationId,
          medication_reminder_id: reminderId,
          elder_id: elderId,
          scheduled_time: nextTime.toISOString(),
          status: 'pending',
          dose_sequence: doseSequence,
          dose_label: doseLabel,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        });

        console.log(`   ✅ 產生: [${doseSequence}/${totalDoses}] ${doseLabel} - ${nextTime.toLocaleString('zh-TW')}`);

        doseSequence++;
      } catch (err) {
        console.error('解析時間錯誤:', err);
        break;
      }
    }

    if (logs.length === 0) {
      return {
        success: false,
        error: 'No logs generated',
        message: '沒有產生任何記錄，請檢查 cron 表達式和總次數'
      };
    }

    // 批次插入所有記錄
    console.log(`\n💾 批次插入 ${logs.length} 筆記錄...`);

    const { data, error } = await sb
      .from('medication_logs')
      .insert(logs)
      .select();

    if (error) {
      console.error('❌ 插入失敗:', error.message);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`✅ 成功產生 ${data.length} 筆短期用藥記錄\n`);

    return {
      success: true,
      data: data,
      count: data.length,
      message: `成功產生 ${data.length} 筆記錄`
    };

  } catch (error) {
    console.error('❌ 產生短期用藥記錄失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 檢查並補充缺失的短期用藥記錄
 * （用於修復已建立但沒有記錄的提醒）
 *
 * @param {string} reminderId - 提醒 ID
 * @returns {Promise<Object>} - 補充結果
 */
export async function replenishShortTermLogs(reminderId) {
  try {
    const sb = getSupabase();

    // 查詢提醒資訊
    const { data: reminder, error: reminderError } = await sb
      .from('medication_reminders')
      .select(`
        id,
        medication_id,
        elder_id,
        cron_schedule,
        total_doses,
        start_date,
        created_at,
        timezone,
        medications (
          medication_name
        )
      `)
      .eq('id', reminderId)
      .eq('is_short_term', true)
      .single();

    if (reminderError || !reminder) {
      return {
        success: false,
        error: '找不到短期用藥提醒'
      };
    }

    // 查詢已有的記錄數
    const { count: existingCount } = await sb
      .from('medication_logs')
      .select('*', { count: 'exact', head: true })
      .eq('medication_reminder_id', reminderId);

    console.log(`📊 提醒 ${reminder.medications.medication_name}:`);
    console.log(`   總需求: ${reminder.total_doses} 筆`);
    console.log(`   已有: ${existingCount || 0} 筆`);

    if (existingCount >= reminder.total_doses) {
      return {
        success: true,
        message: '記錄已完整，無需補充'
      };
    }

    // 產生所有記錄
    return await generateShortTermMedicationLogs({
      reminderId: reminder.id,
      medicationId: reminder.medication_id,
      elderId: reminder.elder_id,
      medicationName: reminder.medications.medication_name,
      cronSchedule: reminder.cron_schedule,
      totalDoses: reminder.total_doses,
      startDate: reminder.start_date || reminder.created_at,
      timezone: reminder.timezone
    });

  } catch (error) {
    console.error('❌ 補充記錄失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
