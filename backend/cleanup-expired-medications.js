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

    // 查詢所有短期用藥的提醒（包含已停用但藥物狀態還是 active 的）
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
      .eq('medications.status', 'active'); // 只處理狀態還是 active 的藥物

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    if (!reminders || reminders.length === 0) {
      console.log('✅ 沒有啟用的短期用藥提醒');
      return;
    }

    console.log(`📊 找到 ${reminders.length} 個狀態為 active 的短期用藥\n`);

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
    console.log('自動處理：將過期的短期用藥標記為已過期 (expired)');
    console.log('='.repeat(60));

    console.log('\n🔄 開始處理過期的短期用藥...\n');

    for (const expired of expiredReminders) {
      // 1. 停用提醒
      const { error: reminderError } = await supabaseAdmin
        .from('medication_reminders')
        .update({ is_enabled: false })
        .eq('id', expired.reminderId);

      if (reminderError) {
        console.error(`❌ 停用提醒失敗: ${expired.medicationName}`, reminderError.message);
        continue;
      }

      // 2. 將藥物狀態改為 expired (過期)
      const { error: medicationError } = await supabaseAdmin
        .from('medications')
        .update({ status: 'expired' })
        .eq('id', expired.medicationId);

      if (medicationError) {
        console.error(`❌ 更新藥物狀態失敗: ${expired.medicationName}`, medicationError.message);
      } else {
        console.log(`✅ 已處理: ${expired.medicationName}`);
        console.log(`   - 提醒已停用`);
        console.log(`   - 狀態改為 expired\n`);
      }
    }

    console.log('✅ 清理完成');
    console.log('\n💡 處理結果:');
    console.log('   - 過期的短期用藥已標記為 expired');
    console.log('   - 提醒已停用');
    console.log('   - 不會再出現在「設定用藥時間」頁面 (因為預設只顯示 active 狀態)');
    console.log('   - 用藥記錄保留在資料庫中供統計使用\n');

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
