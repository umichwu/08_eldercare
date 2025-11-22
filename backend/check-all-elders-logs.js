/**
 * 檢查所有長輩的用藥記錄
 */

import { supabaseAdmin as supabase } from './config/supabase.js';

async function checkAllElders() {
  console.log('\n========================================');
  console.log('🔍 檢查所有長輩的用藥資料');
  console.log('========================================\n');

  const { data: elders } = await supabase
    .from('elders')
    .select('id, name');

  for (const elder of elders) {
    console.log(`\n長輩: ${elder.name}`);
    console.log('─'.repeat(40));

    // 1. 檢查提醒
    const { data: reminders } = await supabase
      .from('medication_reminders')
      .select('id, is_enabled, medications(medication_name)')
      .eq('elder_id', elder.id);

    console.log(`📋 提醒數量: ${reminders?.length || 0}`);
    if (reminders && reminders.length > 0) {
      reminders.forEach(r => {
        console.log(`   - ${r.medications?.medication_name} (${r.is_enabled ? '✅啟用' : '❌停用'})`);
      });
    }

    // 2. 檢查今日記錄
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: todayCount } = await supabase
      .from('medication_logs')
      .select('*', { count: 'exact', head: true })
      .eq('elder_id', elder.id)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', tomorrow.toISOString());

    console.log(`📊 今日記錄: ${todayCount || 0} 筆`);

    // 3. 檢查總記錄
    const { count: totalCount } = await supabase
      .from('medication_logs')
      .select('*', { count: 'exact', head: true })
      .eq('elder_id', elder.id);

    console.log(`📊 總記錄: ${totalCount || 0} 筆`);

    // 4. 顯示最近記錄
    if (totalCount > 0) {
      const { data: recentLogs } = await supabase
        .from('medication_logs')
        .select('scheduled_time, status, medications(medication_name)')
        .eq('elder_id', elder.id)
        .order('scheduled_time', { ascending: false })
        .limit(3);

      console.log(`\n最近 3 筆記錄:`);
      recentLogs.forEach(log => {
        const time = new Date(log.scheduled_time).toLocaleString('zh-TW');
        console.log(`   ${time}: ${log.medications?.medication_name} (${log.status})`);
      });
    }
  }

  console.log('\n========================================\n');
}

checkAllElders();
