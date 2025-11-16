/**
 * 檢查並顯示資料庫中的重複用藥記錄
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

async function checkDuplicateLogs() {
  try {
    console.log('🔍 檢查資料庫中的重複記錄...\n');

    // 查詢今日和明日的所有用藥記錄
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(today.getDate() + 2);

    const { data: logs, error } = await supabase
      .from('medication_logs')
      .select(`
        id,
        medication_id,
        elder_id,
        scheduled_time,
        status,
        created_at,
        medications (
          medication_name
        )
      `)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', twoDaysLater.toISOString())
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ 查詢失敗:', error);
      return;
    }

    console.log(`📊 找到 ${logs.length} 筆記錄\n`);

    // 按藥物和時間分組，找出重複
    const grouped = {};

    logs.forEach(log => {
      const key = `${log.medication_id}_${log.scheduled_time}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(log);
    });

    // 找出重複的記錄
    let duplicateCount = 0;
    const duplicateGroups = [];

    for (const [key, group] of Object.entries(grouped)) {
      if (group.length > 1) {
        duplicateCount += group.length;
        duplicateGroups.push(group);

        const medName = group[0].medications?.medication_name || '未知';
        const scheduledTime = new Date(group[0].scheduled_time).toLocaleString('zh-TW');

        console.log(`⚠️  重複記錄: ${medName} - ${scheduledTime}`);
        console.log(`   共 ${group.length} 筆重複:`);
        group.forEach((log, index) => {
          console.log(`   [${index + 1}] ID: ${log.id}, Status: ${log.status}, Created: ${new Date(log.created_at).toLocaleString('zh-TW')}`);
        });
        console.log('');
      }
    }

    if (duplicateCount === 0) {
      console.log('✅ 沒有發現重複記錄');
    } else {
      console.log(`\n⚠️  總共發現 ${duplicateCount} 筆重複記錄在 ${duplicateGroups.length} 組中`);

      // 列出所有記錄以供檢查
      console.log('\n📋 所有今明兩日的記錄:');
      logs.forEach(log => {
        const medName = log.medications?.medication_name || '未知';
        const scheduledTime = new Date(log.scheduled_time).toLocaleString('zh-TW');
        console.log(`   ${medName} - ${scheduledTime} (ID: ${log.id}, Status: ${log.status})`);
      });
    }

    // 檢查 medication_reminders
    console.log('\n\n🔍 檢查 medication_reminders 設定...\n');

    const { data: reminders, error: reminderError } = await supabase
      .from('medication_reminders')
      .select(`
        id,
        medication_id,
        elder_id,
        cron_schedule,
        is_enabled,
        reminder_times,
        medications (
          medication_name
        )
      `)
      .eq('is_enabled', true);

    if (reminderError) {
      console.error('❌ 查詢提醒失敗:', reminderError);
      return;
    }

    console.log(`📊 找到 ${reminders.length} 個啟用的提醒:\n`);

    reminders.forEach(reminder => {
      const medName = reminder.medications?.medication_name || '未知';
      console.log(`📌 ${medName}:`);
      console.log(`   Reminder ID: ${reminder.id}`);
      console.log(`   Medication ID: ${reminder.medication_id}`);
      console.log(`   Cron: ${reminder.cron_schedule}`);
      console.log(`   Times: ${JSON.stringify(reminder.reminder_times)}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ 執行失敗:', error);
  }
}

checkDuplicateLogs();
