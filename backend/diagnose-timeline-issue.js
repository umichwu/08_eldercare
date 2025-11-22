/**
 * 診斷 Timeline 不顯示的問題
 */

import { supabaseAdmin as supabase } from './config/supabase.js';

async function diagnoseTimelineIssue() {
  console.log('\n========================================');
  console.log('🔍 診斷 Timeline 顯示問題');
  console.log('========================================\n');

  try {
    // 1. 檢查資料庫欄位是否存在
    console.log('📋 Step 1: 檢查資料庫欄位...\n');

    // 改用直接查詢的方式檢查欄位
    const { data: testLog, error: testError } = await supabase
      .from('medication_logs')
      .select('id, dose_sequence, dose_label')
      .limit(1)
      .maybeSingle();

    if (testError && testError.message.includes('dose_sequence')) {
      console.log('❌ 新欄位尚未建立！');
      console.log('   請先執行 database/add-short-term-medication-fields.sql\n');
      console.log('建議動作:');
      console.log('   1. 到 Supabase Dashboard -> SQL Editor');
      console.log('   2. 執行 add-short-term-medication-fields.sql');
      console.log('   3. 或暫時回復舊版程式碼\n');
      return;
    } else {
      console.log('✅ 資料庫欄位檢查通過\n');
    }

    // 2. 查詢今天的 medication_logs
    console.log('📋 Step 2: 查詢今天的用藥記錄...\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: logs, error: logsError } = await supabase
      .from('medication_logs')
      .select(`
        id,
        scheduled_time,
        actual_time,
        status,
        dose_sequence,
        dose_label,
        medication_id,
        elder_id,
        medications (
          medication_name,
          dosage
        )
      `)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', tomorrow.toISOString())
      .order('scheduled_time', { ascending: true });

    if (logsError) {
      console.error('❌ 查詢失敗:', logsError.message);
      console.error('   錯誤詳情:', logsError);
      return;
    }

    if (!logs || logs.length === 0) {
      console.log('⚠️  今天沒有用藥記錄！\n');
      console.log('可能原因:');
      console.log('   1. 沒有建立用藥提醒');
      console.log('   2. Scheduler 沒有產生今日記錄');
      console.log('   3. elder_id 不符\n');

      // 檢查是否有任何用藥記錄
      const { count: totalCount } = await supabase
        .from('medication_logs')
        .select('*', { count: 'exact', head: true });

      console.log(`📊 medication_logs 總記錄數: ${totalCount || 0}\n`);

      // 檢查是否有 medication_reminders
      const { data: reminders, error: remindersError } = await supabase
        .from('medication_reminders')
        .select('id, is_enabled, elder_id, medications(medication_name)')
        .eq('is_enabled', true);

      if (remindersError) {
        console.error('❌ 查詢提醒失敗:', remindersError.message);
      } else {
        console.log(`📋 啟用的提醒數量: ${reminders?.length || 0}`);
        if (reminders && reminders.length > 0) {
          reminders.forEach(r => {
            console.log(`   - ${r.medications?.medication_name || '未知'} (elder: ${r.elder_id})`);
          });
        }
        console.log('');
      }

      return;
    }

    console.log(`✅ 找到 ${logs.length} 筆今日用藥記錄:\n`);

    // 顯示每筆記錄
    logs.forEach((log, index) => {
      const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const medName = log.medications?.medication_name || '未知藥物';
      const label = log.dose_label || medName;
      const status = log.status || 'pending';

      console.log(`   ${index + 1}. ${time} - ${label}`);
      console.log(`      狀態: ${status}`);
      console.log(`      Elder ID: ${log.elder_id}`);
      console.log(`      序號: ${log.dose_sequence || 'N/A'}`);
      console.log('');
    });

    // 3. 檢查前端 API 會回傳什麼
    console.log('📋 Step 3: 模擬前端 API 查詢...\n');

    const testElderId = logs[0].elder_id;
    console.log(`使用 Elder ID: ${testElderId}\n`);

    const { data: apiData, error: apiError } = await supabase
      .from('medication_logs')
      .select(`
        id,
        scheduled_time,
        actual_time,
        status,
        notes,
        dose_sequence,
        dose_label,
        created_at,
        medications (
          id,
          medication_name,
          dosage,
          status
        )
      `)
      .eq('elder_id', testElderId)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', tomorrow.toISOString())
      .order('scheduled_time', { ascending: true });

    if (apiError) {
      console.error('❌ API 查詢失敗:', apiError.message);
      console.error('   這可能是前端看到的錯誤！\n');
      return;
    }

    console.log('✅ API 查詢成功！');
    console.log(`   回傳 ${apiData.length} 筆記錄\n`);

    if (apiData.length > 0) {
      console.log('📄 第一筆記錄範例:');
      console.log(JSON.stringify(apiData[0], null, 2));
    }

    // 4. 總結
    console.log('\n========================================');
    console.log('診斷總結');
    console.log('========================================\n');

    if (logs.length > 0 && apiData.length > 0) {
      console.log('✅ 資料庫有記錄，API 也能正常查詢');
      console.log('\n可能的前端問題:');
      console.log('   1. 檢查 elder_id 是否正確');
      console.log('   2. 檢查前端 Console 是否有 JavaScript 錯誤');
      console.log('   3. 檢查前端是否正確呼叫 API');
      console.log('   4. 檢查 Timeline 的渲染邏輯\n');
    } else if (logs.length === 0) {
      console.log('⚠️  資料庫沒有今日記錄');
      console.log('\n建議動作:');
      console.log('   1. 檢查是否有建立用藥提醒');
      console.log('   2. 檢查 Scheduler 是否正常運行');
      console.log('   3. 手動觸發一次 Scheduler\n');
    }

  } catch (error) {
    console.error('\n❌ 診斷過程發生錯誤:', error);
  }

  console.log('========================================\n');
}

diagnoseTimelineIssue();
