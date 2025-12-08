/**
 * Daily Reminder Scheduler - 生活提醒排程服務
 *
 * 功能：
 * - 使用 node-cron 執行定時任務
 * - 每分鐘檢查是否有需要發送的提醒
 * - 自動生成今日提醒記錄
 * - 自動標記錯過的提醒
 * - 通知家屬錯過提醒的情況
 */

import cron from 'node-cron';
import cronParser from 'cron-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const { parseExpression } = cronParser;

import {
  sendPushNotification,
} from './fcmService.js';

import {
  sendDailyReminderEmail,
} from './emailNotificationService.js';

import {
  createReminderLog,
  autoMarkMissedReminders,
} from './dailyReminderService.js';

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

let schedulerTask = null;
let missedCheckTask = null;

/**
 * 啟動生活提醒排程器
 */
export function startDailyReminderScheduler() {
  if (schedulerTask) {
    console.log('⚠️  生活提醒排程器已經在運行中');
    return;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('🕐 啟動生活提醒排程器');
  console.log('='.repeat(60));

  // 每分鐘執行一次
  schedulerTask = cron.schedule('* * * * *', async () => {
    try {
      await checkAndSendReminders();
    } catch (error) {
      console.error('❌ 排程器執行錯誤:', error.message);
    }
  });

  // 每 5 分鐘檢查一次錯過的提醒
  missedCheckTask = cron.schedule('*/5 * * * *', async () => {
    try {
      await checkAndNotifyMissedReminders();
    } catch (error) {
      console.error('❌ 錯過提醒檢查錯誤:', error.message);
    }
  });

  console.log('✅ 排程器啟動成功');
  console.log('   - 提醒檢查: 每分鐘執行一次');
  console.log('   - 錯過檢查: 每 5 分鐘執行一次');
  console.log('='.repeat(60));
  console.log('');

  // 立即執行一次檢查
  checkAndSendReminders().catch(err => {
    console.error('❌ 初始檢查失敗:', err.message);
  });
}

/**
 * 停止生活提醒排程器
 */
export function stopDailyReminderScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('🛑 生活提醒排程器已停止');
  }

  if (missedCheckTask) {
    missedCheckTask.stop();
    missedCheckTask = null;
    console.log('🛑 錯過提醒檢查已停止');
  }
}

/**
 * 檢查並發送生活提醒
 *
 * 流程：
 * 1. 獲取所有啟用的提醒排程
 * 2. 根據 cron 表達式判斷是否需要發送（包含補償機制）
 * 3. 檢查今日是否已有記錄，沒有則建立
 * 4. 發送 FCM 推送通知 + Email
 */
async function checkAndSendReminders() {
  try {
    const now = new Date();
    const currentMinute = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // 補償機制：檢查過去 5 分鐘
    const compensationWindow = 5; // 分鐘
    const checkStart = new Date(now.getTime() - compensationWindow * 60 * 1000);

    // 獲取所有啟用的提醒排程
    const sb = getSupabase();
    const { data: reminders, error } = await sb
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
      .eq('is_enabled', true)
      .eq('status', 'active');

    if (error) {
      console.error('❌ 獲取提醒排程失敗:', error.message);
      return;
    }

    if (!reminders || reminders.length === 0) {
      return;
    }

    console.log(`🔍 [${currentMinute}] 檢查 ${reminders.length} 個提醒排程 (含過去 ${compensationWindow} 分鐘補償)...`);

    const processedTimes = new Set();

    for (const reminder of reminders) {
      try {
        // 檢查是否在有效期間內
        if (reminder.start_date) {
          const startDate = new Date(reminder.start_date);
          startDate.setHours(0, 0, 0, 0);
          if (now < startDate) {
            console.log(`⏭️  跳過未開始的提醒: ${reminder.title} (開始日期: ${reminder.start_date})`);
            continue;
          }
        }

        if (reminder.end_date) {
          const endDate = new Date(reminder.end_date);
          endDate.setHours(23, 59, 59, 999);
          if (now > endDate) {
            console.log(`⏭️  跳過已結束的提醒: ${reminder.title} (結束日期: ${reminder.end_date})`);

            // 自動停用已結束的提醒
            await sb
              .from('daily_reminders')
              .update({
                is_enabled: false,
                status: 'completed',
              })
              .eq('id', reminder.id);

            continue;
          }
        }

        // 解析 cron 表達式
        const cronExpression = parseExpression(reminder.cron_schedule, {
          currentDate: checkStart,
          endDate: new Date(now.getTime() + 60 * 1000), // 當前時間 + 1 分鐘
          tz: reminder.timezone || 'Asia/Taipei',
        });

        // 收集過去 5 分鐘內應該執行的所有時間點
        const missedTimes = [];
        while (true) {
          try {
            const next = cronExpression.next();
            const nextDate = next.toDate();

            if (nextDate > now) break;

            const timeKey = `${reminder.id}-${nextDate.getTime()}`;
            if (!processedTimes.has(timeKey)) {
              missedTimes.push(nextDate);
              processedTimes.add(timeKey);
            }
          } catch {
            break;
          }
        }

        // 處理錯過的提醒
        for (const missedTime of missedTimes) {
          const minutesAgo = Math.floor((now - missedTime) / 1000 / 60);
          if (minutesAgo === 0) {
            console.log(`  ⏰ 處理當前提醒: ${reminder.title} (${reminder.reminder_categories.name_zh})`);
          } else {
            console.log(`  🔄 補償處理 ${minutesAgo} 分鐘前錯過的提醒: ${reminder.title}`);
          }
          await processReminder(reminder, missedTime);
        }
      } catch (cronError) {
        console.error(`❌ 處理提醒 ${reminder.id} 失敗:`, cronError.message);
      }
    }
  } catch (error) {
    console.error('❌ 檢查提醒失敗:', error.message);
  }
}

/**
 * 處理單一提醒
 *
 * @param {Object} reminder - 提醒排程資料
 * @param {Date} scheduledTime - 排程時間
 */
async function processReminder(reminder, scheduledTime) {
  try {
    const sb = getSupabase();

    // 檢查今天是否已經有這個時間點的記錄
    const dayStart = new Date(scheduledTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledTime);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: existingLogs, error: logError } = await sb
      .from('daily_reminder_logs')
      .select('id, status, push_sent, scheduled_time')
      .eq('reminder_id', reminder.id)
      .eq('elder_id', reminder.elder_id)
      .gte('scheduled_time', dayStart.toISOString())
      .lt('scheduled_time', dayEnd.toISOString());

    if (logError) {
      console.error('❌ 查詢現有記錄失敗:', logError.message);
      return;
    }

    // 找到當前時間點的記錄
    const currentLog = existingLogs?.find(log => {
      const logTime = new Date(log.scheduled_time);
      return logTime.getHours() === scheduledTime.getHours() &&
             logTime.getMinutes() === scheduledTime.getMinutes();
    });

    let logId;

    if (currentLog) {
      // 如果記錄已存在且已發送推送，跳過
      if (currentLog.push_sent) {
        return;
      }
      logId = currentLog.id;
    } else {
      // 建立新的提醒記錄
      const logResult = await createReminderLog({
        reminderId: reminder.id,
        elderId: reminder.elder_id,
        category: reminder.category,
        scheduledTime: scheduledTime.toISOString(),
        status: 'pending',
      });

      if (!logResult.success) {
        console.error('❌ 建立提醒記錄失敗:', logResult.error);
        return;
      }

      logId = logResult.data.id;
    }

    // 發送通知
    let notificationSent = false;

    // 1. FCM 推送通知
    if (reminder.notification_methods?.includes('push')) {
      const pushResult = await sendDailyReminderPush(reminder, scheduledTime, logId);
      if (pushResult) {
        notificationSent = true;
      }
    }

    // 2. Email 通知
    if (reminder.notification_methods?.includes('email')) {
      const emailResult = await sendDailyReminderEmailNotification(reminder, scheduledTime);
      if (emailResult) {
        notificationSent = true;
      }
    }

    // 更新記錄的推送狀態
    if (notificationSent) {
      await sb
        .from('daily_reminder_logs')
        .update({
          push_sent: true,
          push_sent_at: new Date().toISOString(),
        })
        .eq('id', logId);

      console.log(`✅ [${scheduledTime.getHours()}:${scheduledTime.getMinutes()}] 提醒已發送: ${reminder.title}`);

      // 更新提醒統計
      await sb
        .from('daily_reminders')
        .update({
          last_triggered_at: scheduledTime.toISOString(),
          total_reminders_sent: sb.sql`total_reminders_sent + 1`,
        })
        .eq('id', reminder.id);
    }
  } catch (error) {
    console.error('❌ 處理提醒異常:', error.message);
  }
}

/**
 * 發送 FCM 推送通知
 *
 * @param {Object} reminder - 提醒資料
 * @param {Date} scheduledTime - 排程時間
 * @param {string} logId - 記錄 ID
 * @returns {Promise<boolean>} 是否發送成功
 */
async function sendDailyReminderPush(reminder, scheduledTime, logId) {
  try {
    const sb = getSupabase();

    // 獲取長輩的 FCM Token
    const { data: elder, error: elderError } = await sb
      .from('elders')
      .select('fcm_token, name')
      .eq('id', reminder.elder_id)
      .single();

    if (elderError || !elder || !elder.fcm_token) {
      console.log(`⚠️  長輩未註冊 FCM Token，跳過推送`);
      return false;
    }

    // 準備推送內容
    const categoryIcon = reminder.reminder_categories?.icon || '🔔';
    const categoryName = reminder.reminder_categories?.name_zh || '提醒';

    const notification = {
      title: `${categoryIcon} ${categoryName}`,
      body: reminder.reminder_note || reminder.title,
    };

    const data = {
      type: 'daily_reminder',
      category: reminder.category,
      logId: logId,
      reminderId: reminder.id,
      scheduledTime: scheduledTime.toISOString(),
      action: 'confirm',
    };

    // 加入類別特定資料
    if (reminder.category_specific_data) {
      data.categoryData = JSON.stringify(reminder.category_specific_data);
    }

    const result = await sendPushNotification(elder.fcm_token, notification, data);

    if (result.success) {
      console.log(`📱 FCM 推送已發送: ${elder.name}`);
      return true;
    } else {
      console.error(`❌ FCM 推送失敗: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('❌ 發送 FCM 推送異常:', error.message);
    return false;
  }
}

/**
 * 發送 Email 通知
 *
 * @param {Object} reminder - 提醒資料
 * @param {Date} scheduledTime - 排程時間
 * @returns {Promise<boolean>} 是否發送成功
 */
async function sendDailyReminderEmailNotification(reminder, scheduledTime) {
  try {
    const sb = getSupabase();

    // 獲取長輩的 Email
    const { data: elder, error: elderError } = await sb
      .from('elders')
      .select('email, name, preferred_language')
      .eq('id', reminder.elder_id)
      .single();

    if (elderError || !elder || !elder.email) {
      console.log(`⚠️  長輩未設定 Email，跳過郵件通知`);
      return false;
    }

    const emailResult = await sendDailyReminderEmail({
      to: elder.email,
      elderName: elder.name,
      category: reminder.category,
      categoryName: reminder.reminder_categories?.name_zh || '提醒',
      categoryIcon: reminder.reminder_categories?.icon || '🔔',
      title: reminder.title,
      description: reminder.description,
      reminderNote: reminder.reminder_note,
      scheduledTime: scheduledTime.toISOString(),
      categorySpecificData: reminder.category_specific_data,
      language: elder.preferred_language || 'zh-TW',
    });

    if (emailResult.success) {
      console.log(`📧 Email 通知已發送: ${elder.email}`);
      return true;
    } else {
      console.error(`❌ Email 通知失敗: ${emailResult.error}`);
      return false;
    }
  } catch (error) {
    console.error('❌ 發送 Email 通知異常:', error.message);
    return false;
  }
}

/**
 * 檢查並通知錯過的提醒
 *
 * 流程：
 * 1. 自動標記超過閾值時間的 pending 記錄為 missed
 * 2. 通知家屬有關錯過的提醒
 */
async function checkAndNotifyMissedReminders() {
  try {
    console.log('🔍 檢查錯過的生活提醒...');

    // 自動標記錯過的提醒（超過 30 分鐘）
    const markResult = await autoMarkMissedReminders(30);

    if (!markResult.success || !markResult.data || markResult.data.length === 0) {
      return;
    }

    console.log(`⚠️  發現 ${markResult.data.length} 筆錯過的生活提醒`);

    const sb = getSupabase();

    // 對每筆錯過的提醒，通知家屬
    for (const missedLog of markResult.data) {
      try {
        // 獲取提醒設定
        const { data: reminder, error: reminderError } = await sb
          .from('daily_reminders')
          .select(`
            *,
            reminder_categories (
              name_zh,
              icon
            )
          `)
          .eq('id', missedLog.reminder_id)
          .single();

        if (reminderError || !reminder) {
          console.error('❌ 獲取提醒設定失敗:', reminderError?.message);
          continue;
        }

        // 檢查是否需要通知家屬
        if (!reminder.notify_family_if_missed) {
          continue;
        }

        // 檢查是否已經通知過家屬
        if (missedLog.family_notified) {
          continue;
        }

        // 獲取長輩資訊
        const { data: elder, error: elderError } = await sb
          .from('elders')
          .select('name')
          .eq('id', missedLog.elder_id)
          .single();

        if (elderError || !elder) {
          continue;
        }

        // 發送家屬通知
        const notifyResult = await notifyFamilyMissedReminder(
          elder,
          reminder,
          missedLog
        );

        if (notifyResult) {
          // 更新通知狀態
          await sb
            .from('daily_reminder_logs')
            .update({
              family_notified: true,
              family_notified_at: new Date().toISOString(),
            })
            .eq('id', missedLog.id);

          console.log(`✅ 已通知家屬: ${elder.name} 錯過 ${reminder.title}`);
        }
      } catch (notifyError) {
        console.error('❌ 通知家屬失敗:', notifyError.message);
      }
    }
  } catch (error) {
    console.error('❌ 檢查錯過提醒失敗:', error.message);
  }
}

/**
 * 通知家屬錯過提醒
 *
 * @param {Object} elder - 長輩資料
 * @param {Object} reminder - 提醒資料
 * @param {Object} missedLog - 錯過記錄
 * @returns {Promise<boolean>} 是否通知成功
 */
async function notifyFamilyMissedReminder(elder, reminder, missedLog) {
  try {
    const sb = getSupabase();

    // 獲取家屬的 FCM Token 和 Email
    const { data: familyMembers, error: familyError } = await sb
      .from('elder_family_relations')
      .select(`
        family_members!inner (
          id,
          name,
          email,
          fcm_token
        )
      `)
      .eq('elder_id', missedLog.elder_id)
      .eq('status', 'active')
      .eq('can_receive_alerts', true);

    if (familyError || !familyMembers || familyMembers.length === 0) {
      console.log(`⚠️  沒有可通知的家屬`);
      return false;
    }

    let notified = false;

    for (const relation of familyMembers) {
      const familyMember = relation.family_members;

      // FCM 推送
      if (familyMember.fcm_token) {
        const notification = {
          title: '⚠️ 長輩錯過提醒',
          body: `${elder.name} 錯過了「${reminder.title}」(${reminder.reminder_categories.name_zh})`,
        };

        const data = {
          type: 'missed_reminder',
          category: reminder.category,
          elderId: missedLog.elder_id,
          elderName: elder.name,
          reminderTitle: reminder.title,
          scheduledTime: missedLog.scheduled_time,
        };

        const pushResult = await sendPushNotification(
          familyMember.fcm_token,
          notification,
          data
        );

        if (pushResult.success) {
          notified = true;
          console.log(`📱 已推送通知家屬: ${familyMember.name}`);
        }
      }

      // Email 通知
      if (familyMember.email) {
        // TODO: 實作家屬錯過提醒 Email 模板
        // const emailResult = await sendMissedReminderEmailToFamily(...);
        console.log(`📧 TODO: 發送錯過提醒 Email 給家屬: ${familyMember.email}`);
      }
    }

    return notified;
  } catch (error) {
    console.error('❌ 通知家屬異常:', error.message);
    return false;
  }
}

/**
 * 手動觸發檢查 (用於測試或外部觸發)
 */
export async function manualCheckReminders() {
  console.log('🔄 手動觸發生活提醒檢查...');
  await checkAndSendReminders();
  await checkAndNotifyMissedReminders();
  console.log('✅ 手動檢查完成');
}

// ============================================================================
// 匯出
// ============================================================================

export default {
  startDailyReminderScheduler,
  stopDailyReminderScheduler,
  manualCheckReminders,
};
