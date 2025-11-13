/**
 * Medication Scheduler - 用藥提醒排程服務
 *
 * 功能：
 * - 使用 node-cron 執行定時任務
 * - 每分鐘檢查是否有需要發送的提醒
 * - 自動生成今日用藥記錄
 * - 自動標記錯過的用藥
 * - 通知家屬錯過用藥的情況
 */

import cron from 'node-cron';
import cronParser from 'cron-parser';
import { createClient } from '@supabase/supabase-js';

const { parseExpression } = cronParser;
import {
  sendMedicationReminder,
  notifyFamilyMissedMedication,
} from './fcmService.js';
import {
  sendMedicationReminderEmail,
  sendMissedMedicationAlert,
} from './emailNotificationService.js';
import {
  createMedicationLog,
  autoMarkMissedMedications,
  getPendingMedicationLogs,
} from './medicationService.js';
import dotenv from 'dotenv';

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

let schedulerTask = null;
let missedCheckTask = null;

/**
 * 啟動用藥提醒排程器
 *
 * 每分鐘檢查一次是否有需要發送的提醒
 */
export function startMedicationScheduler() {
  if (schedulerTask) {
    console.log('⚠️  用藥提醒排程器已經在運行中');
    return;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('🕐 啟動用藥提醒排程器');
  console.log('='.repeat(60));

  // 每分鐘執行一次
  schedulerTask = cron.schedule('* * * * *', async () => {
    try {
      await checkAndSendReminders();
    } catch (error) {
      console.error('❌ 排程器執行錯誤:', error.message);
    }
  });

  // 每 5 分鐘檢查一次錯過的用藥
  missedCheckTask = cron.schedule('*/5 * * * *', async () => {
    try {
      await checkAndNotifyMissedMedications();
    } catch (error) {
      console.error('❌ 錯過用藥檢查錯誤:', error.message);
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
 * 停止用藥提醒排程器
 */
export function stopMedicationScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('🛑 用藥提醒排程器已停止');
  }

  if (missedCheckTask) {
    missedCheckTask.stop();
    missedCheckTask = null;
    console.log('🛑 錯過用藥檢查已停止');
  }
}

/**
 * 檢查並發送用藥提醒
 *
 * 流程：
 * 1. 獲取所有啟用的提醒排程
 * 2. 根據 cron 表達式判斷是否需要發送（包含補償機制）
 * 3. 檢查今日是否已有記錄，沒有則建立
 * 4. 發送 FCM 推送通知
 *
 * 補償機制：
 * - 檢查過去 5 分鐘內應該發送但未發送的提醒
 * - 避免因系統繁忙而錯過提醒
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
      .from('medication_reminders')
      .select(`
        *,
        medications (
          id,
          medication_name,
          dosage,
          elder_id,
          status
        )
      `)
      .eq('is_enabled', true)
      .eq('medications.status', 'active');

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
        // 檢查是否為短期用藥且已超過結束日期
        if (reminder.reminder_times?.endDate) {
          const endDate = new Date(reminder.reminder_times.endDate);
          endDate.setHours(23, 59, 59, 999); // 設定為當天結束

          if (now > endDate) {
            console.log(`⏭️  跳過已結束的短期用藥: ${reminder.medications.medication_name} (結束日期: ${reminder.reminder_times.endDate})`);

            // 自動停用已結束的提醒
            await sb
              .from('medication_reminders')
              .update({ is_enabled: false })
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
            console.log(`  ⏰ 處理當前提醒: ${reminder.medications.medication_name}`);
          } else {
            console.log(`  🔄 補償處理 ${minutesAgo} 分鐘前錯過的提醒: ${reminder.medications.medication_name}`);
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
    const medication = reminder.medications;

    // 檢查今天是否已經有這個時間點的記錄
    const sb = getSupabase();
    const { data: existingLogs, error: logError } = await sb
      .from('medication_logs')
      .select('id, status, push_sent')
      .eq('medication_id', medication.id)
      .eq('elder_id', reminder.elder_id)
      .gte('scheduled_time', new Date(scheduledTime.setHours(0, 0, 0, 0)).toISOString())
      .lt('scheduled_time', new Date(scheduledTime.setHours(23, 59, 59, 999)).toISOString());

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
      // 建立新的用藥記錄
      const logResult = await createMedicationLog({
        medicationId: medication.id,
        elderId: reminder.elder_id,
        scheduledTime: scheduledTime.toISOString(),
        status: 'pending',
      });

      if (!logResult.success) {
        console.error('❌ 建立用藥記錄失敗:', logResult.error);
        return;
      }

      logId = logResult.data.id;
    }

    // 發送 FCM 推送通知
    const pushResult = await sendMedicationReminder(reminder.elder_id, {
      medicationId: medication.id,
      medicationName: medication.medication_name,
      dosage: medication.dosage,
      scheduledTime: scheduledTime.toISOString(),
    });

    // 發送 Email 通知（如果長輩有設定 Email）
    let emailSent = false;
    const { data: elder } = await sb
      .from('elders')
      .select('name, email, preferred_language')
      .eq('id', reminder.elder_id)
      .single();

    if (elder?.email) {
      const emailResult = await sendMedicationReminderEmail({
        to: elder.email,
        elderName: elder.name,
        medicationName: medication.medication_name,
        dosage: medication.dosage,
        scheduledTime: scheduledTime.toISOString(),
        instructions: medication.instructions,
        language: elder.preferred_language || 'zh-TW'
      });

      emailSent = emailResult.success;

      if (emailResult.success) {
        console.log(`📧 Email 通知已發送: ${elder.email}`);
      }
    }

    // 更新記錄的推送狀態
    await sb
      .from('medication_logs')
      .update({
        push_sent: pushResult.success || emailSent,
        push_sent_at: new Date().toISOString(),
      })
      .eq('id', logId);

    if (pushResult.success || emailSent) {
      console.log(`✅ [${scheduledTime.getHours()}:${scheduledTime.getMinutes()}] 提醒已發送: ${medication.medication_name}`);

      // 更新提醒統計
      await sb
        .from('medication_reminders')
        .update({
          last_triggered_at: scheduledTime.toISOString(),
          total_reminders_sent: sb.sql`total_reminders_sent + 1`,
        })
        .eq('id', reminder.id);
    } else {
      console.error(`❌ 提醒發送失敗: ${medication.medication_name} - ${pushResult.error}`);
    }
  } catch (error) {
    console.error('❌ 處理提醒異常:', error.message);
  }
}

/**
 * 檢查並通知錯過的用藥
 *
 * 流程：
 * 1. 自動標記超過閾值時間的 pending 記錄為 missed
 * 2. 通知家屬有關錯過的用藥
 */
async function checkAndNotifyMissedMedications() {
  try {
    console.log('🔍 檢查錯過的用藥...');

    // 自動標記錯過的用藥（超過 30 分鐘）
    const markResult = await autoMarkMissedMedications(30);

    if (!markResult.success || !markResult.data || markResult.data.length === 0) {
      return;
    }

    console.log(`⚠️  發現 ${markResult.data.length} 筆錯過的用藥`);

    const sb = getSupabase();

    // 對每筆錯過的用藥，通知家屬
    for (const missedLog of markResult.data) {
      try {
        // 獲取藥物資訊
        const { data: medication, error: medError } = await sb
          .from('medications')
          .select('medication_name, dosage')
          .eq('id', missedLog.medication_id)
          .single();

        if (medError || !medication) {
          console.error('❌ 獲取藥物資訊失敗:', medError?.message);
          continue;
        }

        // 檢查是否需要通知家屬
        const { data: reminder, error: reminderError } = await sb
          .from('medication_reminders')
          .select('notify_family_if_missed')
          .eq('medication_id', missedLog.medication_id)
          .eq('elder_id', missedLog.elder_id)
          .single();

        if (reminderError || !reminder || !reminder.notify_family_if_missed) {
          continue;
        }

        // 檢查是否已經通知過家屬
        if (missedLog.family_notified) {
          continue;
        }

        // 發送家屬 FCM 推送通知
        const notifyResult = await notifyFamilyMissedMedication(missedLog.elder_id, {
          medicationId: missedLog.medication_id,
          medicationName: medication.medication_name,
          dosage: medication.dosage,
          scheduledTime: missedLog.scheduled_time,
        });

        // 發送家屬 Email 通知
        let emailSent = false;
        const { data: elder } = await sb
          .from('elders')
          .select('name')
          .eq('id', missedLog.elder_id)
          .single();

        if (elder) {
          // 獲取家屬的 Email
          const { data: familyMembers } = await sb
            .from('elder_family_relations')
            .select(`
              family_members!inner (
                id,
                name,
                email
              )
            `)
            .eq('elder_id', missedLog.elder_id)
            .eq('status', 'active')
            .eq('can_receive_alerts', true);

          if (familyMembers && familyMembers.length > 0) {
            for (const relation of familyMembers) {
              const familyMember = relation.family_members;
              if (familyMember.email) {
                const emailResult = await sendMissedMedicationAlert({
                  to: familyMember.email,
                  elderName: elder.name,
                  medicationName: medication.medication_name,
                  scheduledTime: missedLog.scheduled_time,
                  familyMemberName: familyMember.name,
                  language: 'zh-TW'
                });

                if (emailResult.success) {
                  emailSent = true;
                  console.log(`📧 已發送家屬警告 Email: ${familyMember.email}`);
                }
              }
            }
          }
        }

        // 更新通知狀態
        await sb
          .from('medication_logs')
          .update({
            family_notified: notifyResult.success || emailSent,
            family_notified_at: new Date().toISOString(),
          })
          .eq('id', missedLog.id);

        if (notifyResult.success || emailSent) {
          console.log(`✅ 已通知家屬: ${medication.medication_name} 錯過服用`);
        }
      } catch (notifyError) {
        console.error('❌ 通知家屬失敗:', notifyError.message);
      }
    }
  } catch (error) {
    console.error('❌ 檢查錯過用藥失敗:', error.message);
  }
}

/**
 * 手動觸發檢查 (用於測試或外部觸發)
 */
export async function manualCheckReminders() {
  console.log('🔄 手動觸發提醒檢查...');
  await checkAndSendReminders();
  await checkAndNotifyMissedMedications();
  console.log('✅ 手動檢查完成');
}

/**
 * 生成今日所有提醒的記錄
 *
 * @param {string} elderId - 長輩 ID (optional)
 * @returns {Promise<Object>} - 生成結果
 */
export async function generateTodayMedicationLogs(elderId = null) {
  try {
    console.log('📝 生成今日用藥記錄...');

    const sb = getSupabase();
    let query = sb
      .from('medication_reminders')
      .select(`
        *,
        medications (
          id,
          medication_name,
          dosage,
          status
        )
      `)
      .eq('is_enabled', true)
      .eq('medications.status', 'active');

    if (elderId) {
      query = query.eq('elder_id', elderId);
    }

    const { data: reminders, error } = await query;

    if (error) {
      console.error('❌ 獲取提醒排程失敗:', error.message);
      return { success: false, error: error.message };
    }

    if (!reminders || reminders.length === 0) {
      console.log('⚠️  沒有需要生成記錄的提醒排程');
      return { success: true, count: 0 };
    }

    const now = new Date(); // 當前時間
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let totalCreated = 0;

    for (const reminder of reminders) {
      try {
        // 檢查是否為短期用藥且已超過結束日期
        if (reminder.reminder_times?.endDate) {
          const endDate = new Date(reminder.reminder_times.endDate);
          endDate.setHours(23, 59, 59, 999);

          if (now > endDate) {
            console.log(`⏭️  跳過已結束的短期用藥: ${reminder.medications.medication_name}`);
            continue;
          }
        }

        // 解析 cron 表達式，獲取今天的所有執行時間
        const cronExpression = parseExpression(reminder.cron_schedule, {
          currentDate: today,
          endDate: tomorrow,
          tz: reminder.timezone || 'Asia/Taipei',
        });

        const todayTimes = [];
        while (true) {
          try {
            const next = cronExpression.next();
            const nextDate = next.toDate();
            if (nextDate >= tomorrow) break;

            // 只加入未來的時間點（不建立已經過去的記錄）
            if (nextDate >= now) {
              todayTimes.push(nextDate);
            }
          } catch {
            break;
          }
        }

        // 為每個時間點建立記錄（如果不存在）
        for (const scheduledTime of todayTimes) {
          const { data: existing, error: existError } = await sb
            .from('medication_logs')
            .select('id')
            .eq('medication_id', reminder.medications.id)
            .eq('elder_id', reminder.elder_id)
            .eq('scheduled_time', scheduledTime.toISOString())
            .maybeSingle();

          if (existError) {
            console.error('❌ 查詢現有記錄失敗:', existError.message);
            continue;
          }

          if (!existing) {
            const logResult = await createMedicationLog({
              medicationId: reminder.medications.id,
              elderId: reminder.elder_id,
              scheduledTime: scheduledTime.toISOString(),
              status: 'pending',
            });

            if (logResult.success) {
              totalCreated++;
            }
          }
        }
      } catch (cronError) {
        console.error(`❌ 處理提醒 ${reminder.id} 失敗:`, cronError.message);
      }
    }

    console.log(`✅ 今日用藥記錄生成完成: ${totalCreated} 筆新記錄`);
    return { success: true, count: totalCreated };
  } catch (error) {
    console.error('❌ 生成今日用藥記錄失敗:', error.message);
    return { success: false, error: error.message };
  }
}

export default {
  startMedicationScheduler,
  stopMedicationScheduler,
  manualCheckReminders,
  generateTodayMedicationLogs,
};
