/**
 * Daily Reminder Service - 生活提醒服務（通用）
 *
 * 功能：
 * - 建立/更新/刪除生活提醒
 * - 查詢提醒（按長輩、類別、日期）
 * - 生成今日提醒記錄
 * - 確認完成提醒
 * - 標記錯過提醒
 * - 取得統計資料
 *
 * 支援類別：
 * - medication（用藥）、water（喝水）、meal（飲食）
 * - exercise（運動）、appointment（回診）、sleep（睡眠）
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 載入環境變數
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
} else {
  dotenv.config();
}

// 使用懶加載方式創建 Supabase 客戶端
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

// ============================================================================
// 提醒管理（CRUD）
// ============================================================================

/**
 * 建立生活提醒
 *
 * @param {Object} reminderData - 提醒資料
 * @param {string} reminderData.elderId - 長輩 ID
 * @param {string} reminderData.category - 提醒類別 (water, meal, exercise, etc.)
 * @param {string} reminderData.title - 提醒標題
 * @param {string} reminderData.description - 詳細說明
 * @param {string} reminderData.cronSchedule - Cron 排程表達式
 * @param {Object} reminderData.reminderTimes - 時間設定 (JSONB)
 * @param {Object} reminderData.categorySpecificData - 類別特定資料 (JSONB)
 * @param {boolean} reminderData.isEnabled - 是否啟用
 * @param {Array} reminderData.notificationMethods - 通知方式 ['push', 'email']
 * @param {boolean} reminderData.notifyFamilyIfMissed - 是否通知家屬
 * @param {number} reminderData.missedThresholdMinutes - 錯過閾值（分鐘）
 * @param {Date} reminderData.startDate - 開始日期（可選）
 * @param {Date} reminderData.endDate - 結束日期（可選）
 * @param {boolean} reminderData.isTemporary - 是否為臨時提醒
 * @returns {Promise<Object>} { success: boolean, data: Object, error: string }
 */
export async function createDailyReminder(reminderData) {
  try {
    const {
      elderId,
      category,
      title,
      description = null,
      reminderNote = null,
      cronSchedule,
      timezone = 'Asia/Taipei',
      reminderTimes = null,
      isEnabled = true,
      notificationMethods = ['push', 'email'],
      advanceNoticeMinutes = 0,
      repeatIntervalMinutes = null,
      maxRepeats = 3,
      categorySpecificData = null,
      notifyFamilyIfMissed = false,
      missedThresholdMinutes = 30,
      startDate = null,
      endDate = null,
      isTemporary = false,
      createdBy = null,
    } = reminderData;

    // 驗證必填欄位
    if (!elderId || !category || !title || !cronSchedule) {
      return {
        success: false,
        error: '缺少必要欄位: elderId, category, title, cronSchedule',
      };
    }

    // 驗證類別是否存在
    const sb = getSupabase();
    const { data: categoryExists, error: categoryError } = await sb
      .from('reminder_categories')
      .select('id')
      .eq('id', category)
      .single();

    if (categoryError || !categoryExists) {
      console.error('❌ 類別驗證失敗:', categoryError);
      return {
        success: false,
        error: `無效的提醒類別: ${category}`,
      };
    }

    // 建立提醒
    const { data, error } = await sb
      .from('daily_reminders')
      .insert({
        elder_id: elderId,
        category,
        title,
        description,
        reminder_note: reminderNote,
        cron_schedule: cronSchedule,
        timezone,
        reminder_times: reminderTimes,
        is_enabled: isEnabled,
        notification_methods: notificationMethods,
        advance_notice_minutes: advanceNoticeMinutes,
        repeat_interval_minutes: repeatIntervalMinutes,
        max_repeats: maxRepeats,
        category_specific_data: categorySpecificData,
        notify_family_if_missed: notifyFamilyIfMissed,
        missed_threshold_minutes: missedThresholdMinutes,
        start_date: startDate,
        end_date: endDate,
        is_temporary: isTemporary,
        status: 'active',
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ 建立提醒失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`✅ 提醒建立成功: ${title} (${category})`);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ 建立提醒異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 更新生活提醒
 *
 * @param {string} reminderId - 提醒 ID
 * @param {Object} updates - 要更新的欄位
 * @returns {Promise<Object>} { success: boolean, data: Object, error: string }
 */
export async function updateDailyReminder(reminderId, updates) {
  try {
    if (!reminderId) {
      return {
        success: false,
        error: '缺少 reminderId',
      };
    }

    const sb = getSupabase();

    // 檢查提醒是否存在
    const { data: existing, error: fetchError } = await sb
      .from('daily_reminders')
      .select('id, title')
      .eq('id', reminderId)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        error: '找不到該提醒',
      };
    }

    // 更新提醒
    const { data, error } = await sb
      .from('daily_reminders')
      .update(updates)
      .eq('id', reminderId)
      .select()
      .single();

    if (error) {
      console.error('❌ 更新提醒失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`✅ 提醒更新成功: ${existing.title}`);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ 更新提醒異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 刪除生活提醒（軟刪除：設定 status = 'cancelled'）
 *
 * @param {string} reminderId - 提醒 ID
 * @returns {Promise<Object>} { success: boolean, data: Object, error: string }
 */
export async function deleteDailyReminder(reminderId) {
  try {
    if (!reminderId) {
      return {
        success: false,
        error: '缺少 reminderId',
      };
    }

    const sb = getSupabase();

    // 軟刪除（設定為 cancelled）
    const { data, error } = await sb
      .from('daily_reminders')
      .update({
        status: 'cancelled',
        is_enabled: false,
      })
      .eq('id', reminderId)
      .select()
      .single();

    if (error) {
      console.error('❌ 刪除提醒失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`✅ 提醒已取消: ${data.title}`);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ 刪除提醒異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 暫停/恢復提醒
 *
 * @param {string} reminderId - 提醒 ID
 * @param {boolean} pause - true=暫停, false=恢復
 * @returns {Promise<Object>} { success: boolean, data: Object, error: string }
 */
export async function toggleDailyReminder(reminderId, pause = true) {
  try {
    const newStatus = pause ? 'paused' : 'active';
    const result = await updateDailyReminder(reminderId, {
      status: newStatus,
      is_enabled: !pause,
    });

    if (result.success) {
      console.log(`✅ 提醒已${pause ? '暫停' : '恢復'}: ${result.data.title}`);
    }

    return result;
  } catch (error) {
    console.error('❌ 切換提醒狀態異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// 查詢提醒
// ============================================================================

/**
 * 取得長輩的所有提醒
 *
 * @param {string} elderId - 長輩 ID
 * @param {string} category - 提醒類別（可選）
 * @param {string} status - 狀態篩選（可選）
 * @returns {Promise<Object>} { success: boolean, data: Array, error: string }
 */
export async function getRemindersByElder(elderId, category = null, status = 'active') {
  try {
    if (!elderId) {
      return {
        success: false,
        error: '缺少 elderId',
      };
    }

    const sb = getSupabase();

    let query = sb
      .from('daily_reminders')
      .select(`
        *,
        reminder_categories (
          id,
          name_zh,
          name_en,
          icon,
          color
        )
      `)
      .eq('elder_id', elderId)
      .order('created_at', { ascending: false });

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
      console.error('❌ 查詢提醒失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error('❌ 查詢提醒異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 取得單一提醒詳情
 *
 * @param {string} reminderId - 提醒 ID
 * @returns {Promise<Object>} { success: boolean, data: Object, error: string }
 */
export async function getReminderById(reminderId) {
  try {
    if (!reminderId) {
      return {
        success: false,
        error: '缺少 reminderId',
      };
    }

    const sb = getSupabase();

    const { data, error } = await sb
      .from('daily_reminders')
      .select(`
        *,
        reminder_categories (
          id,
          name_zh,
          name_en,
          icon,
          color
        )
      `)
      .eq('id', reminderId)
      .single();

    if (error) {
      console.error('❌ 查詢提醒失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ 查詢提醒異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// 提醒記錄管理
// ============================================================================

/**
 * 建立提醒記錄
 *
 * @param {Object} logData - 記錄資料
 * @returns {Promise<Object>} { success: boolean, data: Object, error: string }
 */
export async function createReminderLog(logData) {
  try {
    const {
      reminderId,
      elderId,
      category,
      scheduledTime,
      status = 'pending',
    } = logData;

    if (!reminderId || !elderId || !category || !scheduledTime) {
      return {
        success: false,
        error: '缺少必要欄位: reminderId, elderId, category, scheduledTime',
      };
    }

    const sb = getSupabase();

    const { data, error } = await sb
      .from('daily_reminder_logs')
      .insert({
        reminder_id: reminderId,
        elder_id: elderId,
        category,
        scheduled_time: scheduledTime,
        status,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ 建立提醒記錄失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ 建立提醒記錄異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 確認完成提醒
 *
 * @param {string} logId - 記錄 ID
 * @param {string} confirmedBy - 確認者 ('elder' or 'family_member')
 * @param {string} confirmedByUserId - 確認者使用者 ID
 * @param {string} confirmationMethod - 確認方式 ('app', 'voice', 'manual')
 * @param {Object} responseData - 回饋資訊（可選，例如飲水量、運動時長）
 * @param {string} notes - 備註（可選）
 * @returns {Promise<Object>} { success: boolean, data: Object, error: string }
 */
export async function confirmReminderLog(
  logId,
  confirmedBy,
  confirmedByUserId = null,
  confirmationMethod = 'app',
  responseData = null,
  notes = null
) {
  try {
    if (!logId || !confirmedBy) {
      return {
        success: false,
        error: '缺少必要欄位: logId, confirmedBy',
      };
    }

    const sb = getSupabase();

    // 檢查記錄是否存在且為 pending 狀態
    const { data: existing, error: fetchError } = await sb
      .from('daily_reminder_logs')
      .select('id, status, reminder_id')
      .eq('id', logId)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        error: '找不到該提醒記錄',
      };
    }

    if (existing.status !== 'pending') {
      return {
        success: false,
        error: `該提醒已是 ${existing.status} 狀態，無法確認`,
      };
    }

    // 更新記錄為 completed
    const { data, error } = await sb
      .from('daily_reminder_logs')
      .update({
        status: 'completed',
        actual_time: new Date().toISOString(),
        confirmed_by: confirmedBy,
        confirmed_by_user_id: confirmedByUserId,
        confirmation_method: confirmationMethod,
        response_data: responseData,
        notes: notes,
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) {
      console.error('❌ 確認提醒失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`✅ 提醒已確認完成: Log ID ${logId}`);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ 確認提醒異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 自動標記錯過的提醒
 *
 * @param {number} thresholdMinutes - 閾值（分鐘）
 * @returns {Promise<Object>} { success: boolean, data: Array, error: string }
 */
export async function autoMarkMissedReminders(thresholdMinutes = 30) {
  try {
    const sb = getSupabase();

    // 計算閾值時間
    const thresholdTime = new Date();
    thresholdTime.setMinutes(thresholdTime.getMinutes() - thresholdMinutes);

    // 查詢超過閾值的 pending 記錄
    const { data: pendingLogs, error: fetchError } = await sb
      .from('daily_reminder_logs')
      .select('id, reminder_id, elder_id, category, scheduled_time')
      .eq('status', 'pending')
      .lt('scheduled_time', thresholdTime.toISOString());

    if (fetchError) {
      console.error('❌ 查詢待處理記錄失敗:', fetchError);
      return {
        success: false,
        error: fetchError.message,
      };
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    console.log(`⚠️  發現 ${pendingLogs.length} 筆超過閾值的提醒`);

    // 批次更新為 missed
    const logIds = pendingLogs.map(log => log.id);

    const { data, error } = await sb
      .from('daily_reminder_logs')
      .update({ status: 'missed' })
      .in('id', logIds)
      .select();

    if (error) {
      console.error('❌ 標記錯過提醒失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`✅ 已標記 ${data.length} 筆提醒為錯過`);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ 標記錯過提醒異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 取得今日提醒記錄
 *
 * @param {string} elderId - 長輩 ID
 * @param {string} category - 提醒類別（可選）
 * @returns {Promise<Object>} { success: boolean, data: Array, error: string }
 */
export async function getTodayReminderLogs(elderId, category = null) {
  try {
    if (!elderId) {
      return {
        success: false,
        error: '缺少 elderId',
      };
    }

    const sb = getSupabase();

    // 使用視圖查詢（v_today_reminders）
    let query = sb
      .from('v_today_reminders')
      .select('*')
      .eq('elder_id', elderId)
      .order('scheduled_time', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ 查詢今日提醒失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error('❌ 查詢今日提醒異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 取得提醒統計資料
 *
 * @param {string} elderId - 長輩 ID
 * @param {number} days - 統計天數（預設 7 天）
 * @param {string} category - 提醒類別（可選）
 * @returns {Promise<Object>} { success: boolean, data: Object, error: string }
 */
export async function getReminderStatistics(elderId, days = 7, category = null) {
  try {
    if (!elderId) {
      return {
        success: false,
        error: '缺少 elderId',
      };
    }

    const sb = getSupabase();

    // 計算日期範圍
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 使用視圖查詢統計（v_daily_reminder_statistics）
    let query = sb
      .from('v_daily_reminder_statistics')
      .select('*')
      .eq('elder_id', elderId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ 查詢統計失敗:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // 計算總計
    const summary = {
      totalReminders: 0,
      completedCount: 0,
      missedCount: 0,
      pendingCount: 0,
      skippedCount: 0,
      completionRate: 0,
      byCategory: {},
    };

    data.forEach(row => {
      summary.totalReminders += row.total_reminders;
      summary.completedCount += row.completed_count;
      summary.missedCount += row.missed_count;
      summary.pendingCount += row.pending_count;
      summary.skippedCount += row.skipped_count || 0;

      // 按類別統計
      if (!summary.byCategory[row.category]) {
        summary.byCategory[row.category] = {
          categoryName: row.category_name,
          categoryIcon: row.category_icon,
          categoryColor: row.category_color,
          total: 0,
          completed: 0,
          missed: 0,
          pending: 0,
          skipped: 0,
          completionRate: 0,
        };
      }

      const cat = summary.byCategory[row.category];
      cat.total += row.total_reminders;
      cat.completed += row.completed_count;
      cat.missed += row.missed_count;
      cat.pending += row.pending_count;
      cat.skipped += row.skipped_count || 0;
    });

    // 計算總完成率
    if (summary.totalReminders > 0) {
      summary.completionRate = Math.round(
        (summary.completedCount / summary.totalReminders) * 100 * 10
      ) / 10;
    }

    // 計算各類別完成率
    Object.keys(summary.byCategory).forEach(catKey => {
      const cat = summary.byCategory[catKey];
      if (cat.total > 0) {
        cat.completionRate = Math.round((cat.completed / cat.total) * 100 * 10) / 10;
      }
    });

    return {
      success: true,
      data: {
        summary,
        details: data,
        days,
        startDate: startDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      },
    };
  } catch (error) {
    console.error('❌ 查詢統計異常:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// 匯出
// ============================================================================

export default {
  // 提醒管理
  createDailyReminder,
  updateDailyReminder,
  deleteDailyReminder,
  toggleDailyReminder,

  // 查詢提醒
  getRemindersByElder,
  getReminderById,

  // 提醒記錄
  createReminderLog,
  confirmReminderLog,
  autoMarkMissedReminders,
  getTodayReminderLogs,
  getReminderStatistics,
};
