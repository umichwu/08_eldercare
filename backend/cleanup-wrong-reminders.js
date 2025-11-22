/**
 * 清理錯誤的短期用藥提醒
 * （沒有勾選短期用藥選項的提醒）
 */

import { supabaseAdmin as supabase } from './config/supabase.js';

async function cleanup() {
  console.log('\n========================================');
  console.log('🧹 清理錯誤的用藥提醒');
  console.log('========================================\n');

  try {
    // 刪除最近建立的兩個錯誤提醒
    const reminderIds = [
      'a360760f-d11e-46b5-a626-0073a66d1049',
      'bbb0dd76-686d-423d-9ea5-6efce141524a'
    ];

    for (const id of reminderIds) {
      // 先刪除記錄
      const { data: logs, error: logError } = await supabase
        .from('medication_logs')
        .delete()
        .eq('medication_reminder_id', id)
        .select();

      if (logError) {
        console.error(`❌ 刪除記錄失敗 (${id}):`, logError.message);
        continue;
      }

      console.log(`✅ 已刪除 ${logs?.length || 0} 筆記錄`);

      // 再刪除提醒
      const { error: reminderError } = await supabase
        .from('medication_reminders')
        .delete()
        .eq('id', id);

      if (reminderError) {
        console.error(`❌ 刪除提醒失敗 (${id}):`, reminderError.message);
        continue;
      }

      console.log(`✅ 已刪除提醒: ${id}\n`);
    }

    console.log('========================================');
    console.log('✅ 清理完成！');
    console.log('========================================\n');
    console.log('現在請重新新增感冒藥，並務必勾選「短期用藥」選項！\n');

  } catch (error) {
    console.error('\n❌ 清理過程發生錯誤:', error);
  }
}

cleanup();
