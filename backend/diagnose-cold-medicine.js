/**
 * 診斷腳本：檢查「感冒藥」為什麼沒有出現在今日用藥
 */

import { supabaseAdmin } from './config/supabase.js';

async function diagnoseColdMedicine() {
  console.log('🔍 開始診斷「感冒藥」問題...\n');

  try {
    // 1. 查詢所有包含「感冒」的藥物
    console.log('📊 步驟 1: 查詢所有感冒藥...');
    const { data: medications, error: medError } = await supabaseAdmin
      .from('medications')
      .select('*')
      .ilike('medication_name', '%感冒%');

    if (medError) {
      console.error('❌ 查詢藥物失敗:', medError.message);
      return;
    }

    if (!medications || medications.length === 0) {
      console.log('⚠️  沒有找到感冒藥記錄');
      return;
    }

    console.log(`✅ 找到 ${medications.length} 個感冒藥:\n`);
    medications.forEach((med, index) => {
      console.log(`   ${index + 1}. ${med.medication_name}`);
      console.log(`      ID: ${med.id}`);
      console.log(`      狀態: ${med.status}`);
      console.log(`      長輩 ID: ${med.elder_id}`);
      console.log(`      建立時間: ${med.created_at}\n`);
    });

    // 2. 對每個感冒藥，查詢其提醒設定
    for (const med of medications) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 檢查藥物: ${med.medication_name} (ID: ${med.id})`);
      console.log('='.repeat(60));

      // 查詢提醒排程
      const { data: reminders, error: reminderError } = await supabaseAdmin
        .from('medication_reminders')
        .select('*')
        .eq('medication_id', med.id);

      if (reminderError) {
        console.error('❌ 查詢提醒失敗:', reminderError.message);
        continue;
      }

      if (!reminders || reminders.length === 0) {
        console.log('⚠️  沒有找到提醒設定');
        continue;
      }

      console.log(`\n✅ 找到 ${reminders.length} 個提醒設定:\n`);

      for (const reminder of reminders) {
        console.log(`   提醒 ID: ${reminder.id}`);
        console.log(`   是否啟用: ${reminder.is_enabled ? '✅ 是' : '❌ 否'}`);
        console.log(`   是否為短期用藥: ${reminder.is_short_term ? '✅ 是' : '❌ 否'}`);

        if (reminder.is_short_term) {
          console.log(`   總次數: ${reminder.total_doses || '未設定'}`);
          console.log(`   已完成次數: ${reminder.doses_completed || 0}`);
          console.log(`   開始日期: ${reminder.start_date || '未設定'}`);

          if (reminder.reminder_times?.endDate) {
            const endDate = new Date(reminder.reminder_times.endDate);
            const now = new Date();
            const isExpired = now > endDate;
            console.log(`   結束日期: ${reminder.reminder_times.endDate} ${isExpired ? '❌ 已過期' : '✅ 未過期'}`);
          }
        }

        console.log(`   Cron 排程: ${reminder.cron_schedule}`);
        console.log(`   提醒時間: ${JSON.stringify(reminder.reminder_times, null, 2)}`);
        console.log(`   建立時間: ${reminder.created_at}\n`);

        // 查詢這個提醒的用藥記錄
        const { data: logs, error: logError } = await supabaseAdmin
          .from('medication_logs')
          .select('*')
          .eq('medication_reminder_id', reminder.id)
          .order('scheduled_time', { ascending: true });

        if (logError) {
          console.error('   ❌ 查詢記錄失敗:', logError.message);
          continue;
        }

        if (!logs || logs.length === 0) {
          console.log('   ⚠️  沒有找到任何用藥記錄');
          console.log('   ❗ 問題可能原因：');
          if (reminder.is_short_term) {
            console.log('      - 短期用藥記錄可能在建立提醒時未正確產生');
            console.log('      - 建議執行修復腳本補充記錄');
          } else {
            console.log('      - 記錄可能尚未產生');
            console.log('      - 需要等待排程器執行或手動觸發生成');
          }
        } else {
          console.log(`   ✅ 找到 ${logs.length} 筆用藥記錄:\n`);

          // 檢查今天的記錄
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

          const todayLogs = logs.filter(log => {
            const logDate = new Date(log.scheduled_time);
            const logDateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
            return logDateStr === todayStr;
          });

          console.log(`   📅 今天 (${todayStr}) 的記錄: ${todayLogs.length} 筆`);

          if (todayLogs.length > 0) {
            todayLogs.forEach((log, i) => {
              const time = new Date(log.scheduled_time);
              console.log(`      ${i + 1}. ${time.toLocaleString('zh-TW')} - 狀態: ${log.status}`);
            });
          } else {
            console.log('      ⚠️  沒有今天的記錄');
          }

          // 顯示所有記錄的日期範圍
          if (logs.length > 0) {
            const firstLog = new Date(logs[0].scheduled_time);
            const lastLog = new Date(logs[logs.length - 1].scheduled_time);
            console.log(`\n   📊 記錄日期範圍:`);
            console.log(`      開始: ${firstLog.toLocaleDateString('zh-TW')} ${firstLog.toLocaleTimeString('zh-TW')}`);
            console.log(`      結束: ${lastLog.toLocaleDateString('zh-TW')} ${lastLog.toLocaleTimeString('zh-TW')}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 診斷完成');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 診斷過程發生錯誤:', error);
  }
}

// 執行診斷
diagnoseColdMedicine()
  .then(() => {
    console.log('\n✅ 腳本執行完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 腳本執行失敗:', err);
    process.exit(1);
  });
