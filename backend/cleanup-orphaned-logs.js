/**
 * 清理孤立的用藥記錄
 * （medication_reminder_id 為 null 的記錄）
 */

import { supabaseAdmin as supabase } from './config/supabase.js';

async function cleanup() {
  console.log('\n========================================');
  console.log('🧹 清理孤立的用藥記錄');
  console.log('========================================\n');

  try {
    // 查詢所有 medication_reminder_id 為 null 的記錄
    const { data: orphanedLogs, error: fetchError } = await supabase
      .from('medication_logs')
      .select('id, scheduled_time, status')
      .is('medication_reminder_id', null);

    if (fetchError) {
      console.error('❌ 查詢失敗:', fetchError.message);
      return;
    }

    console.log(`找到 ${orphanedLogs?.length || 0} 筆孤立記錄\n`);

    if (!orphanedLogs || orphanedLogs.length === 0) {
      console.log('✅ 沒有孤立記錄需要清理');
      return;
    }

    // 刪除所有孤立記錄
    const { data: deleted, error: deleteError } = await supabase
      .from('medication_logs')
      .delete()
      .is('medication_reminder_id', null)
      .select();

    if (deleteError) {
      console.error('❌ 刪除失敗:', deleteError.message);
      return;
    }

    console.log(`✅ 已刪除 ${deleted?.length || 0} 筆孤立記錄\n`);

    console.log('========================================');
    console.log('✅ 清理完成！');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ 清理過程發生錯誤:', error);
  }
}

cleanup();
