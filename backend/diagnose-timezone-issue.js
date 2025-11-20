/**
 * 診斷時區問題 - 檢查為何出現 7:59am 的用藥時間
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cronParser from 'cron-parser';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseTimezoneIssue() {
  console.log('\n🔍 診斷時區問題...\n');

  // 1. 獲取所有用藥計畫
  const { data: medications, error: medError } = await supabase
    .from('medications')
    .select('*')
    .order('created_at', { ascending: false });

  if (medError) {
    console.error('❌ 獲取用藥計畫失敗:', medError);
    return;
  }

  console.log(`📋 找到 ${medications.length} 個用藥計畫:\n`);

  for (const med of medications) {
    console.log(`藥物: ${med.medication_name}`);
    console.log(`  ID: ${med.id}`);
    console.log(`  劑量: ${med.dosage}`);
    console.log(`  頻率: ${med.frequency}`);
    console.log('');
  }

  // 2. 獲取所有用藥提醒排程
  const { data: reminders, error: remError } = await supabase
    .from('medication_reminders')
    .select(`
      *,
      medications (
        id,
        medication_name,
        dosage,
        frequency
      )
    `)
    .order('created_at', { ascending: false });

  if (remError) {
    console.error('❌ 獲取提醒排程失敗:', remError);
    return;
  }

  console.log(`\n⏰ 找到 ${reminders.length} 個提醒排程:\n`);

  for (const reminder of reminders) {
    console.log(`藥物: ${reminder.medications?.medication_name || '未知'}`);
    console.log(`  Reminder ID: ${reminder.id}`);
    console.log(`  Cron 排程: ${reminder.cron_schedule}`);
    console.log(`  時區: ${reminder.timezone || 'Asia/Taipei'}`);
    console.log(`  啟用: ${reminder.is_active ? '是' : '否'}`);

    if (reminder.reminder_times) {
      console.log(`  提醒時間資訊:`, JSON.stringify(reminder.reminder_times, null, 2));
    }

    // 解析 cron 來看實際執行時間
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const cronExpression = cronParser.parseExpression(reminder.cron_schedule, {
        currentDate: today,
        endDate: tomorrow,
        tz: reminder.timezone || 'Asia/Taipei',
      });

      console.log(`  📅 今日執行時間:`);
      const times = [];
      while (true) {
        try {
          const next = cronExpression.next();
          const nextDate = next.toDate();
          if (nextDate >= tomorrow) break;
          times.push(nextDate);
        } catch {
          break;
        }
      }

      times.forEach(time => {
        const localTime = time.toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const isoTime = time.toISOString();
        console.log(`    - ${localTime} (台北時間) => ISO: ${isoTime}`);
      });

    } catch (error) {
      console.log(`  ⚠️ 無法解析 cron: ${error.message}`);
    }

    console.log('');
  }

  // 3. 檢查今日的用藥記錄
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: logs, error: logError } = await supabase
    .from('medication_logs')
    .select(`
      *,
      medications (
        medication_name
      )
    `)
    .gte('scheduled_time', today.toISOString())
    .lt('scheduled_time', tomorrow.toISOString())
    .order('scheduled_time');

  if (logError) {
    console.error('❌ 獲取今日記錄失敗:', logError);
    return;
  }

  console.log(`\n📝 今日用藥記錄 (${logs.length} 筆):\n`);

  for (const log of logs) {
    const scheduledDate = new Date(log.scheduled_time);
    const localTime = scheduledDate.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    console.log(`${log.medications?.medication_name || '未知藥物'}`);
    console.log(`  排程時間 (ISO): ${log.scheduled_time}`);
    console.log(`  排程時間 (台北): ${localTime}`);
    console.log(`  狀態: ${log.status}`);
    console.log('');
  }

  process.exit(0);
}

diagnoseTimezoneIssue();
