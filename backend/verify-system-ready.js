/**
 * 驗證系統是否準備好進行短期用藥測試
 */

import { supabaseAdmin as supabase } from './config/supabase.js';

async function verify() {
  console.log('\n========================================');
  console.log('✅ 系統就緒狀態檢查');
  console.log('========================================\n');

  let allGood = true;

  try {
    // 1. 檢查是否有孤立記錄
    const { data: orphaned, error: orphanedError } = await supabase
      .from('medication_logs')
      .select('id')
      .is('medication_reminder_id', null);

    if (orphanedError) {
      console.error('❌ 查詢失敗:', orphanedError.message);
      allGood = false;
    } else {
      if (orphaned && orphaned.length > 0) {
        console.log(`⚠️  發現 ${orphaned.length} 筆孤立記錄`);
        allGood = false;
      } else {
        console.log('✅ 沒有孤立記錄');
      }
    }

    // 2. 檢查是否有錯誤的短期用藥（is_short_term=false 但有 dose_sequence）
    const { data: wrongReminders, error: wrongError } = await supabase
      .from('medication_reminders')
      .select('id, is_short_term, total_doses')
      .eq('is_short_term', false)
      .not('total_doses', 'is', null);

    if (wrongError) {
      console.error('❌ 查詢失敗:', wrongError.message);
      allGood = false;
    } else {
      if (wrongReminders && wrongReminders.length > 0) {
        console.log(`⚠️  發現 ${wrongReminders.length} 個錯誤配置的提醒`);
        allGood = false;
      } else {
        console.log('✅ 沒有錯誤配置的提醒');
      }
    }

    // 3. 檢查今天之後是否有沒有序號的記錄
    const today = new Date().toISOString().split('T')[0];
    const { data: noSequence, error: sequenceError } = await supabase
      .from('medication_logs')
      .select('id, scheduled_time, medication_reminder_id')
      .is('dose_sequence', null)
      .gte('scheduled_time', today);

    if (sequenceError) {
      console.error('❌ 查詢失敗:', sequenceError.message);
      allGood = false;
    } else {
      if (noSequence && noSequence.length > 0) {
        console.log(`⚠️  發現 ${noSequence.length} 筆今天之後沒有序號的記錄`);
        allGood = false;
      } else {
        console.log('✅ 今天之後的記錄都有序號');
      }
    }

    console.log('\n========================================');
    if (allGood) {
      console.log('🎉 系統完全就緒！可以開始測試短期用藥功能');
      console.log('========================================\n');
      console.log('📝 測試步驟：');
      console.log('1. 訪問 https://08-eldercare.vercel.app/medications.html');
      console.log('2. 按 Ctrl+Shift+R 清除瀏覽器快取');
      console.log('3. 點擊「➕ 新增用藥時間」');
      console.log('4. 選擇藥物（例如：感冒藥）');
      console.log('5. 新增時間：9:00, 13:00, 18:00, 22:00');
      console.log('6. ✅ 勾選「⏱️ 短期用藥」選項（關鍵！）');
      console.log('7. 設定總次數：12');
      console.log('8. 點擊「儲存設定」');
      console.log('9. 檢查 Timeline 應該只有未來的時間，且有序號標記\n');
    } else {
      console.log('⚠️  系統尚未完全就緒，請先處理上述問題');
      console.log('========================================\n');
    }

  } catch (error) {
    console.error('\n❌ 檢查過程發生錯誤:', error);
  }
}

verify();
