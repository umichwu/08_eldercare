/**
 * 清理過期的短期用藥
 *
 * 功能：
 * - 找出所有已過期的短期用藥
 * - 選擇性停用或刪除
 */

import { supabaseAdmin } from './config/supabase.js';

async function cleanupExpiredMedications() {
  console.log('🧹 開始清理過期的短期用藥...\n');

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    console.log(`📅 今天日期: ${today}\n`);

    // 查詢所有短期用藥的提醒
    const { data: reminders, error } = await supabaseAdmin
      .from('medication_reminders')
      .select(`
        id,
        is_short_term,
        is_enabled,
        reminder_times,
        medications (
          id,
          medication_name,
          status
        )
      `)
      .eq('is_short_term', true)
      .eq('is_enabled', true);

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    if (!reminders || reminders.length === 0) {
      console.log('✅ 沒有啟用的短期用藥提醒');
      return;
    }

    console.log(`📊 找到 ${reminders.length} 個短期用藥提醒\n`);

    const expiredReminders = [];

    for (const reminder of reminders) {
      if (reminder.reminder_times?.endDate) {
        const endDate = new Date(reminder.reminder_times.endDate);
        endDate.setHours(23, 59, 59, 999);

        if (now > endDate) {
          expiredReminders.push({
            reminderId: reminder.id,
            medicationId: reminder.medications.id,
            medicationName: reminder.medications.medication_name,
            endDate: reminder.reminder_times.endDate
          });

          console.log(`⚠️  已過期: ${reminder.medications.medication_name}`);
          console.log(`   結束日期: ${reminder.reminder_times.endDate}`);
          console.log(`   提醒 ID: ${reminder.id}\n`);
        }
      }
    }

    if (expiredReminders.length === 0) {
      console.log('✅ 沒有過期的短期用藥');
      return;
    }

    console.log(`\n📋 總共 ${expiredReminders.length} 個過期的短期用藥\n`);
    console.log('='.repeat(60));
    console.log('處理選項:');
    console.log('1. 停用提醒 (保留藥物記錄)');
    console.log('2. 刪除藥物和所有相關記錄');
    console.log('='.repeat(60));

    // 方案 1: 停用提醒
    console.log('\n執行方案 1: 停用過期的提醒...\n');

    for (const expired of expiredReminders) {
      const { error: updateError } = await supabaseAdmin
        .from('medication_reminders')
        .update({ is_enabled: false })
        .eq('id', expired.reminderId);

      if (updateError) {
        console.error(`❌ 停用失敗: ${expired.medicationName}`, updateError.message);
      } else {
        console.log(`✅ 已停用: ${expired.medicationName}`);
      }
    }

    console.log('\n✅ 清理完成');
    console.log('\n💡 提示:');
    console.log('   - 提醒已停用，但藥物記錄仍保留在資料庫');
    console.log('   - 用戶可以在「設定用藥時間」頁面看到這些藥物');
    console.log('   - 但不會出現在「今日用藥」頁面');
    console.log('   - 如需完全刪除，請在前端介面手動刪除\n');

  } catch (error) {
    console.error('❌ 清理過程發生錯誤:', error);
  }
}

// 執行清理
cleanupExpiredMedications()
  .then(() => {
    console.log('✅ 腳本執行完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 腳本執行失敗:', err);
    process.exit(1);
  });
