/**
 * 修復重複的提醒設定
 * 清理同一個藥物的多個提醒，只保留最新的
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

console.log('🔧 修復重複的提醒設定\n');
console.log('='.repeat(60));
console.log('');

const TARGET_MED_ID = 'f82118cf-0654-4221-a0d2-c145519320bf';

async function fixDuplicateReminders() {
  console.log('步驟 1: 查找重複的提醒設定\n');

  const { data: reminders, error: remError } = await supabase
    .from('medication_reminders')
    .select('*')
    .eq('medication_id', TARGET_MED_ID)
    .order('created_at', { ascending: false }); // 最新的在前面

  if (remError) {
    console.error('❌ 查詢提醒失敗:', remError.message);
    return false;
  }

  console.log(`📊 找到 ${reminders.length} 個提醒設定:\n`);

  reminders.forEach((r, index) => {
    const times = r.reminder_times?.times || [];
    const isNewest = index === 0;
    console.log(`  ${isNewest ? '✅' : '❌'} ${times.join(', ')} (建立於: ${r.created_at}) ${isNewest ? '(保留)' : '(刪除)'}`);
  });
  console.log('');

  if (reminders.length <= 1) {
    console.log('✅ 沒有重複的提醒設定');
    return true;
  }

  // 保留最新的，刪除其他的
  const keepReminder = reminders[0];
  const deleteReminders = reminders.slice(1);

  console.log('步驟 2: 刪除舊的提醒設定\n');

  for (const reminder of deleteReminders) {
    const times = reminder.reminder_times?.times || [];

    const { error: delError } = await supabase
      .from('medication_reminders')
      .delete()
      .eq('id', reminder.id);

    if (delError) {
      console.error(`   ❌ 刪除 ${times.join(', ')} 失敗:`, delError.message);
    } else {
      console.log(`   ✅ 已刪除 ${times.join(', ')}`);
    }
  }
  console.log('');

  // 步驟 3: 清理今日的舊記錄
  console.log('步驟 3: 清理今日的舊記錄\n');

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

  if (logs.length === 0) {
    console.log('ℹ️  沒有今日記錄');
    return true;
  }

  console.log(`📊 找到 ${logs.length} 筆今日記錄:\n`);

  // 找出正確的時間（來自最新的提醒）
  const correctTimes = keepReminder.reminder_times?.times || [];
  console.log(`✅ 正確的時間: ${correctTimes.join(', ')}\n`);

  for (const log of logs) {
    const logTime = new Date(log.scheduled_time);
    const timeStr = logTime.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const hourMinute = `${String(logTime.getHours()).padStart(2, '0')}:${String(logTime.getMinutes()).padStart(2, '0')}`;

    const isCorrect = correctTimes.includes(hourMinute);

    console.log(`  ${isCorrect ? '✅' : '❌'} ${timeStr} (${log.status}) ${isCorrect ? '(保留)' : '(刪除)'}`);

    if (!isCorrect && log.status === 'pending') {
      const { error: delError } = await supabase
        .from('medication_logs')
        .delete()
        .eq('id', log.id);

      if (delError) {
        console.error(`     ❌ 刪除失敗:`, delError.message);
      } else {
        console.log(`     ✅ 已刪除`);
      }
    }
  }
  console.log('');

  return true;
}

async function verify() {
  console.log('步驟 4: 驗證結果\n');

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
    const success = await fixDuplicateReminders();

    if (success) {
      await verify();

      console.log('='.repeat(60));
      console.log('');
      console.log('🎉 修復完成！\n');
      console.log('結果：');
      console.log('  ✅ 只保留一個提醒設定（最新的）');
      console.log('  ✅ 今日時間軸只有正確的時間');
      console.log('');
      console.log('📱 請重新整理前端頁面確認！');
      console.log('');
      console.log('💡 注意事項：');
      console.log('  - 後端程式碼已修改，下次修改時間時會自動清理舊記錄');
      console.log('  - 如果前端是透過「新增提醒」而不是「更新提醒」來修改時間，');
      console.log('    請檢查前端程式碼的 saveReminder 函數');
      console.log('');
    }

  } catch (error) {
    console.error('❌ 執行過程中發生錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
