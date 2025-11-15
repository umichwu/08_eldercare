/**
 * 清理助眠藥的錯誤記錄和舊提醒
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

console.log('🔧 清理助眠藥的錯誤資料\n');
console.log('='.repeat(60));
console.log('');

const TARGET_MED_ID = 'f82118cf-0654-4221-a0d2-c145519320bf';
const CORRECT_TIME = '23:35'; // 晚上 11:35

async function cleanup() {
  // 步驟 1: 刪除舊的提醒設定（保留 23:35）
  console.log('步驟 1: 清理舊的提醒設定\n');

  const { data: reminders, error: remError } = await supabase
    .from('medication_reminders')
    .select('*')
    .eq('medication_id', TARGET_MED_ID);

  if (remError) {
    console.error('❌ 查詢提醒失敗:', remError.message);
    return false;
  }

  console.log(`📊 找到 ${reminders.length} 個提醒設定:\n`);

  let correctReminderId = null;

  for (const reminder of reminders) {
    const times = reminder.reminder_times?.times || [];
    const timeStr = times.join(', ');
    const isCorrect = times.includes(CORRECT_TIME);

    console.log(`  - ${timeStr} ${isCorrect ? '✅ (保留)' : '❌ (刪除)'}`);

    if (isCorrect) {
      correctReminderId = reminder.id;
    } else {
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

  if (!correctReminderId) {
    console.log('⚠️  找不到 23:35 的提醒設定！');
    return false;
  }

  // 步驟 2: 清理今日錯誤的記錄（保留 23:35）
  console.log('步驟 2: 清理今日錯誤的記錄\n');

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
    return false;
  }

  console.log(`📊 找到 ${logs.length} 筆今日記錄:\n`);

  for (const log of logs) {
    const logTime = new Date(log.scheduled_time);
    const timeStr = logTime.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const isCorrect = logTime.getHours() === 23 && logTime.getMinutes() === 35;

    console.log(`  - ${timeStr} (${log.status}) ${isCorrect ? '✅ (保留)' : '❌ (刪除)'}`);

    if (!isCorrect) {
      const { error: delError } = await supabase
        .from('medication_logs')
        .delete()
        .eq('id', log.id);

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
  console.log('步驟 3: 驗證結果\n');

  // 檢查提醒設定
  const { data: reminders, error: remError } = await supabase
    .from('medication_reminders')
    .select('*')
    .eq('medication_id', TARGET_MED_ID);

  if (!remError && reminders) {
    console.log(`📅 提醒設定: ${reminders.length} 個\n`);
    reminders.forEach(r => {
      const times = r.reminder_times?.times || [];
      console.log(`  ✅ ${times.join(', ')}`);
    });
    console.log('');
  }

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
    .lt('scheduled_time', tomorrow.toISOString());

  if (!logError && logs) {
    console.log(`📝 今日記錄: ${logs.length} 筆\n`);
    logs.forEach(log => {
      const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log(`  ✅ ${time} - ${log.status}`);
    });
    console.log('');
  }
}

async function main() {
  try {
    const success = await cleanup();

    if (success) {
      await verify();

      console.log('='.repeat(60));
      console.log('');
      console.log('🎉 清理完成！\n');
      console.log('結果：');
      console.log('  ✅ 助眠藥只保留一個提醒時間: 23:35 (晚上11:35)');
      console.log('  ✅ 今日時間軸只有一個時段');
      console.log('');
      console.log('📱 請重新整理前端頁面確認！');
      console.log('');
    }

  } catch (error) {
    console.error('❌ 執行過程中發生錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
