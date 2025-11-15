/**
 * 修復助眠藥的提醒問題
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 修復助眠藥的提醒問題\n');
console.log('='.repeat(60));
console.log('');

// 目標助眠藥 ID
const TARGET_MED_ID = 'f82118cf-0654-4221-a0d2-c145519320bf';
const CORRECT_REMINDER_ID = '981a807d-9dc6-4192-a96d-5ba0f3a23006'; // 23:35 的提醒

async function fixSleepMedication() {
  console.log('步驟 1: 刪除錯誤的今日記錄\n');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 取得今日所有記錄
  const { data: todayLogs, error: fetchError } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('medication_id', TARGET_MED_ID)
    .gte('scheduled_time', today.toISOString())
    .lt('scheduled_time', tomorrow.toISOString())
    .order('scheduled_time', { ascending: true });

  if (fetchError) {
    console.error('❌ 查詢失敗:', fetchError.message);
    return false;
  }

  console.log(`📊 找到 ${todayLogs.length} 筆今日記錄:\n`);

  todayLogs.forEach((log, index) => {
    const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
    console.log(`  ${index + 1}. ${time} - ${log.status} (ID: ${log.id})`);
  });
  console.log('');

  // 找出要保留的記錄（晚上11:35）
  const correctLog = todayLogs.find(log => {
    const time = new Date(log.scheduled_time);
    return time.getHours() === 23 && time.getMinutes() === 35;
  });

  if (!correctLog) {
    console.log('⚠️  找不到正確的 23:35 記錄');
    return false;
  }

  console.log(`✅ 要保留的記錄: 下午11:35 (ID: ${correctLog.id})\n`);

  // 刪除其他記錄
  const logsToDelete = todayLogs.filter(log => log.id !== correctLog.id);

  if (logsToDelete.length > 0) {
    console.log(`🗑️  準備刪除 ${logsToDelete.length} 筆錯誤記錄:\n`);

    for (const log of logsToDelete) {
      const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const { error: deleteError } = await supabase
        .from('medication_logs')
        .delete()
        .eq('id', log.id);

      if (deleteError) {
        console.error(`   ❌ 刪除 ${time} 失敗:`, deleteError.message);
      } else {
        console.log(`   ✅ 已刪除 ${time} (${log.status})`);
      }
    }
    console.log('');
  } else {
    console.log('✅ 沒有需要刪除的記錄\n');
  }

  // 步驟 2: 啟用正確的提醒，停用其他提醒
  console.log('步驟 2: 設定提醒狀態\n');

  // 先停用所有提醒
  const { error: disableAllError } = await supabase
    .from('medication_reminders')
    .update({ is_active: false })
    .eq('medication_id', TARGET_MED_ID);

  if (disableAllError) {
    console.error('❌ 停用提醒失敗:', disableAllError.message);
    return false;
  }

  console.log('✅ 已停用所有舊提醒');

  // 啟用正確的提醒（23:35）
  const { error: enableError } = await supabase
    .from('medication_reminders')
    .update({ is_active: true })
    .eq('id', CORRECT_REMINDER_ID);

  if (enableError) {
    console.error('❌ 啟用提醒失敗:', enableError.message);
    return false;
  }

  console.log('✅ 已啟用正確的提醒 (23:35)');
  console.log('');

  // 步驟 3: 刪除不需要的舊提醒設定
  console.log('步驟 3: 刪除舊的提醒設定\n');

  const { data: allReminders, error: remError } = await supabase
    .from('medication_reminders')
    .select('*')
    .eq('medication_id', TARGET_MED_ID);

  if (remError) {
    console.error('❌ 查詢提醒失敗:', remError.message);
    return false;
  }

  console.log(`📊 找到 ${allReminders.length} 個提醒設定:\n`);

  for (const reminder of allReminders) {
    const times = reminder.reminder_times?.times || [];
    const isCorrect = reminder.id === CORRECT_REMINDER_ID;

    console.log(`  - ${times.join(', ')} ${isCorrect ? '✅ (保留)' : '❌ (將刪除)'}`);

    if (!isCorrect) {
      const { error: delError } = await supabase
        .from('medication_reminders')
        .delete()
        .eq('id', reminder.id);

      if (delError) {
        console.error(`    ❌ 刪除失敗:`, delError.message);
      } else {
        console.log(`    ✅ 已刪除`);
      }
    }
  }
  console.log('');

  return true;
}

async function verify() {
  console.log('步驟 4: 驗證修復結果\n');

  // 檢查提醒設定
  const { data: reminders, error: remError } = await supabase
    .from('medication_reminders')
    .select('*')
    .eq('medication_id', TARGET_MED_ID);

  if (remError) {
    console.error('❌ 查詢提醒失敗:', remError.message);
    return;
  }

  console.log(`📅 提醒設定數量: ${reminders.length}\n`);

  reminders.forEach(reminder => {
    const times = reminder.reminder_times?.times || [];
    console.log(`  ✅ ${times.join(', ')} - 啟用: ${reminder.is_active ? '是' : '否'}`);
  });
  console.log('');

  // 檢查今日記錄
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: logs, error: logError } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('medication_id', TARGET_MED_ID)
    .gte('scheduled_time', today.toISOString())
    .lt('scheduled_time', tomorrow.toISOString())
    .order('scheduled_time', { ascending: true });

  if (logError) {
    console.error('❌ 查詢記錄失敗:', logError.message);
    return;
  }

  console.log(`📝 今日用藥記錄數量: ${logs.length}\n`);

  logs.forEach(log => {
    const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
    console.log(`  ✅ ${time} - ${log.status}`);
  });
  console.log('');
}

async function main() {
  try {
    const success = await fixSleepMedication();

    if (success) {
      await verify();

      console.log('='.repeat(60));
      console.log('');
      console.log('🎉 修復完成！\n');
      console.log('現在助眠藥的提醒設定應該是：');
      console.log('  ✅ 只有一個提醒: 晚上 23:35 (11:35 PM)');
      console.log('  ✅ 今日時間軸只有一個時段');
      console.log('');
      console.log('請重新整理前端頁面確認結果！');
      console.log('');
    }

  } catch (error) {
    console.error('❌ 執行過程中發生錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
