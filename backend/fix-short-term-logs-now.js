/**
 * 立即修復短期用藥記錄
 *
 * 此腳本會：
 * 1. 找到所有短期用藥提醒
 * 2. 刪除早於建立時間的記錄
 * 3. 重新產生完整的記錄（含序號）
 */

import { supabaseAdmin as supabase } from './config/supabase.js';
import { generateShortTermMedicationLogs } from './services/generateShortTermLogs.js';

async function fixShortTermLogs() {
  console.log('\n========================================');
  console.log('🔧 修復短期用藥記錄');
  console.log('========================================\n');

  try {
    // 1. 查詢所有短期用藥提醒
    const { data: reminders, error: remindersError } = await supabase
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
        is_enabled,
        medications (
          medication_name
        )
      `)
      .eq('is_short_term', true);

    if (remindersError) {
      console.error('❌ 查詢失敗:', remindersError.message);
      return;
    }

    if (!reminders || reminders.length === 0) {
      console.log('⚠️  沒有找到短期用藥提醒\n');
      return;
    }

    console.log(`✅ 找到 ${reminders.length} 個短期用藥提醒\n`);

    for (const reminder of reminders) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`處理: ${reminder.medications.medication_name}`);
      console.log(`Reminder ID: ${reminder.id}`);
      console.log(`總次數: ${reminder.total_doses}`);
      console.log(`建立時間: ${new Date(reminder.created_at).toLocaleString('zh-TW')}`);
      console.log(`${'='.repeat(60)}\n`);

      // 2. 刪除該提醒的所有舊記錄
      const { data: deletedLogs, error: deleteError } = await supabase
        .from('medication_logs')
        .delete()
        .eq('medication_reminder_id', reminder.id)
        .select();

      if (deleteError) {
        console.error(`❌ 刪除舊記錄失敗:`, deleteError.message);
        continue;
      }

      console.log(`🗑️  已刪除 ${deletedLogs?.length || 0} 筆舊記錄\n`);

      // 3. 重新產生記錄
      const result = await generateShortTermMedicationLogs({
        reminderId: reminder.id,
        medicationId: reminder.medication_id,
        elderId: reminder.elder_id,
        medicationName: reminder.medications.medication_name,
        cronSchedule: reminder.cron_schedule,
        totalDoses: reminder.total_doses,
        startDate: reminder.start_date || reminder.created_at,
        timezone: reminder.timezone || 'Asia/Taipei'
      });

      if (!result.success) {
        console.error(`❌ 產生記錄失敗:`, result.error);
        continue;
      }

      console.log(`✅ 成功產生 ${result.count} 筆新記錄\n`);

      // 4. 驗證結果
      const { count: newCount } = await supabase
        .from('medication_logs')
        .select('*', { count: 'exact', head: true })
        .eq('medication_reminder_id', reminder.id);

      console.log(`📊 驗證: 現在有 ${newCount} 筆記錄`);

      // 5. 顯示前幾筆
      const { data: sampleLogs } = await supabase
        .from('medication_logs')
        .select('dose_sequence, dose_label, scheduled_time, status')
        .eq('medication_reminder_id', reminder.id)
        .order('dose_sequence', { ascending: true })
        .limit(5);

      if (sampleLogs && sampleLogs.length > 0) {
        console.log('\n前 5 筆記錄:');
        sampleLogs.forEach(log => {
          const time = new Date(log.scheduled_time).toLocaleString('zh-TW');
          console.log(`   ${log.dose_label} - ${time} (${log.status})`);
        });
      }
    }

    console.log('\n========================================');
    console.log('✅ 修復完成！');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ 修復過程發生錯誤:', error);
  }
}

// 執行修復
fixShortTermLogs();
