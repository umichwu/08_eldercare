/**
 * 測試 Timeline API 是否正常
 */

import { supabaseAdmin as supabase } from './config/supabase.js';

async function testTimelineAPI() {
  console.log('\n========================================');
  console.log('🔍 測試 Timeline API');
  console.log('========================================\n');

  try {
    // 1. 查詢所有長輩
    console.log('📋 Step 1: 查詢所有長輩...\n');

    const { data: elders, error: eldersError } = await supabase
      .from('elders')
      .select('id, name');

    if (eldersError) {
      console.error('❌ 查詢失敗:', eldersError.message);
      return;
    }

    if (!elders || elders.length === 0) {
      console.log('⚠️  沒有長輩資料');
      return;
    }

    console.log(`✅ 找到 ${elders.length} 位長輩:\n`);
    elders.forEach((elder, index) => {
      console.log(`   ${index + 1}. ${elder.name} (${elder.id})`);
    });

    // 2. 查詢今天的用藥記錄
    const testElder = elders[0];
    console.log(`\n📋 Step 2: 查詢 ${testElder.name} 的今日用藥記錄...\n`);

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
        notes,
        created_at,
        medications (
          id,
          medication_name,
          dosage,
          status
        )
      `)
      .eq('elder_id', testElder.id)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', tomorrow.toISOString())
      .order('scheduled_time', { ascending: true });

    if (logsError) {
      console.error('❌ 查詢失敗:', logsError.message);
      console.error('   這表示 API 查詢有問題！');
      return;
    }

    if (!logs || logs.length === 0) {
      console.log('⚠️  沒有今日用藥記錄\n');

      // 檢查是否有任何記錄
      const { count: totalCount } = await supabase
        .from('medication_logs')
        .select('*', { count: 'exact', head: true })
        .eq('elder_id', testElder.id);

      console.log(`📊 該長輩的總記錄數: ${totalCount || 0}\n`);

      if (totalCount > 0) {
        // 查詢最近的記錄
        const { data: recentLogs } = await supabase
          .from('medication_logs')
          .select('scheduled_time, medications(medication_name), status')
          .eq('elder_id', testElder.id)
          .order('scheduled_time', { ascending: false })
          .limit(5);

        console.log('最近的 5 筆記錄:');
        recentLogs.forEach(log => {
          const time = new Date(log.scheduled_time).toLocaleString('zh-TW');
          console.log(`   - ${time}: ${log.medications?.medication_name} (${log.status})`);
        });
        console.log('');
      }

      // 檢查是否有啟用的提醒
      const { data: reminders } = await supabase
        .from('medication_reminders')
        .select('id, medications(medication_name), is_enabled')
        .eq('elder_id', testElder.id)
        .eq('is_enabled', true);

      console.log(`📋 啟用的提醒數量: ${reminders?.length || 0}\n`);

      if (reminders && reminders.length > 0) {
        console.log('建議:');
        console.log('   1. Scheduler 可能還沒有產生今日記錄');
        console.log('   2. 等待 Scheduler 下一個執行週期');
        console.log('   3. 或手動觸發 Scheduler\n');
      } else {
        console.log('建議:');
        console.log('   1. 先建立用藥提醒');
        console.log('   2. 然後等待 Scheduler 產生記錄\n');
      }

      return;
    }

    console.log(`✅ 找到 ${logs.length} 筆今日用藥記錄:\n`);

    logs.forEach((log, index) => {
      const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const medName = log.medications?.medication_name || '未知';
      const status = log.status || 'pending';

      console.log(`   ${index + 1}. ${time} - ${medName}`);
      console.log(`      狀態: ${status}`);
      console.log(`      記錄 ID: ${log.id}`);
    });

    console.log('\n✅ API 查詢正常！\n');
    console.log('如果前端 Timeline 仍然空白，請檢查:');
    console.log('   1. 前端 Console 是否有 JavaScript 錯誤');
    console.log('   2. 前端是否使用了正確的 elder_id');
    console.log('   3. API_BASE_URL 是否正確');
    console.log('   4. 網路請求是否成功 (Network tab)\n');

  } catch (error) {
    console.error('\n❌ 測試過程發生錯誤:', error);
  }

  console.log('========================================\n');
}

testTimelineAPI();
