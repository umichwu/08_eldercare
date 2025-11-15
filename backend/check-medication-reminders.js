/**
 * 檢查助眠藥的提醒設定
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

console.log('🔍 檢查助眠藥的提醒設定\n');
console.log('='.repeat(60));
console.log('');

async function checkSleepMedication() {
  // 查找助眠藥
  const { data: medications, error: medError } = await supabase
    .from('medications')
    .select('*')
    .ilike('medication_name', '%助眠%');

  if (medError) {
    console.error('❌ 查詢用藥失敗:', medError.message);
    return;
  }

  if (!medications || medications.length === 0) {
    console.log('⚠️  找不到助眠藥');
    return;
  }

  console.log(`📊 找到 ${medications.length} 個助眠藥:\n`);

  for (const med of medications) {
    console.log(`藥物 ID: ${med.id}`);
    console.log(`藥物名稱: ${med.medication_name}`);
    console.log(`長者 ID: ${med.elder_id}`);
    console.log('');

    // 查詢此藥物的所有提醒設定
    const { data: reminders, error: remError } = await supabase
      .from('medication_reminders')
      .select('*')
      .eq('medication_id', med.id)
      .order('created_at', { ascending: false });

    if (remError) {
      console.error('❌ 查詢提醒失敗:', remError.message);
      continue;
    }

    console.log(`📅 提醒設定數量: ${reminders.length}\n`);

    reminders.forEach((reminder, index) => {
      console.log(`  提醒 #${index + 1}:`);
      console.log(`    ID: ${reminder.id}`);
      console.log(`    啟用: ${reminder.is_active ? '✅' : '❌'}`);
      console.log(`    Cron 排程: ${reminder.cron_schedule}`);
      console.log(`    提醒時間: ${JSON.stringify(reminder.reminder_times)}`);
      console.log(`    建立時間: ${reminder.created_at}`);
      console.log(`    更新時間: ${reminder.updated_at}`);
      console.log('');
    });

    // 查詢今日的用藥記錄
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: logs, error: logError } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('medication_id', med.id)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', tomorrow.toISOString())
      .order('scheduled_time', { ascending: true });

    if (logError) {
      console.error('❌ 查詢記錄失敗:', logError.message);
      continue;
    }

    console.log(`📝 今日用藥記錄數量: ${logs.length}\n`);

    logs.forEach((log, index) => {
      const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log(`  記錄 #${index + 1}:`);
      console.log(`    ID: ${log.id}`);
      console.log(`    時間: ${time}`);
      console.log(`    狀態: ${log.status}`);
      console.log(`    建立時間: ${log.created_at}`);
      console.log('');
    });

    console.log('-'.repeat(60));
    console.log('');
  }
}

async function main() {
  try {
    await checkSleepMedication();

    console.log('='.repeat(60));
    console.log('');
    console.log('💡 分析建議:\n');
    console.log('如果發現多個提醒設定：');
    console.log('1. 檢查是否有多個 is_active=true 的提醒');
    console.log('2. 刪除不需要的舊提醒');
    console.log('3. 確保只有一個提醒是啟用的');
    console.log('');
    console.log('如果發現多個今日記錄：');
    console.log('1. 檢查 cron_schedule 是否正確');
    console.log('2. 可能是舊的設定產生的記錄');
    console.log('3. 可以手動刪除錯誤的記錄');
    console.log('');

  } catch (error) {
    console.error('❌ 執行過程中發生錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
