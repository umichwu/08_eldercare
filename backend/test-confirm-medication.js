/**
 * 測試確認服藥 API
 * 診斷 400 錯誤的原因
 */

import { supabaseAdmin as supabase } from './config/supabase.js';

async function testConfirmMedication() {
  console.log('\n========================================');
  console.log('🔍 診斷確認服藥功能');
  console.log('========================================\n');

  try {
    // 1. 查詢今天的 pending 記錄
    console.log('📋 Step 1: 查詢今天的 pending medication_logs...\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: logs, error: logsError } = await supabase
      .from('medication_logs')
      .select(`
        id,
        status,
        scheduled_time,
        actual_time,
        medication_id,
        elder_id,
        confirmed_by,
        confirmation_method,
        medications (
          medication_name
        )
      `)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', tomorrow.toISOString())
      .eq('status', 'pending')
      .order('scheduled_time', { ascending: true });

    if (logsError) {
      console.error('❌ 查詢失敗:', logsError.message);
      return;
    }

    if (!logs || logs.length === 0) {
      console.log('⚠️  沒有找到今天的 pending 記錄');
      console.log('\n建議: 請先在前端建立用藥提醒，或執行產生今日記錄的腳本\n');
      return;
    }

    console.log(`✅ 找到 ${logs.length} 筆 pending 記錄:\n`);
    logs.forEach((log, index) => {
      const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
      });
      console.log(`   ${index + 1}. ${log.medications?.medication_name || '未知藥物'} - ${time}`);
      console.log(`      ID: ${log.id}`);
      console.log(`      Elder ID: ${log.elder_id}`);
      console.log(`      Status: ${log.status}`);
    });

    // 2. 測試確認第一筆記錄
    console.log('\n📋 Step 2: 測試確認第一筆記錄...\n');

    const testLog = logs[0];
    console.log(`測試 Log ID: ${testLog.id}`);

    // 取得該長輩對應的 user_profile_id
    const { data: elder, error: elderError } = await supabase
      .from('elders')
      .select('user_profile_id')
      .eq('id', testLog.elder_id)
      .single();

    if (elderError || !elder) {
      console.error('❌ 找不到長輩的 user_profile:', elderError?.message);
      return;
    }

    console.log(`找到 user_profile_id: ${elder.user_profile_id}`);

    // 模擬前端送出的資料（修正後的格式）
    const confirmData = {
      confirmedBy: 'user',  // 字串類型
      confirmedByUserId: elder.user_profile_id,  // user_profile 的 UUID
      confirmationMethod: 'app',
      takenAt: new Date().toISOString()
    };

    console.log('送出資料:', JSON.stringify(confirmData, null, 2));

    // 計算延遲時間
    const actualTime = new Date();
    const scheduledTime = new Date(testLog.scheduled_time);
    const delayMinutes = Math.round((actualTime - scheduledTime) / 60000);

    let status = 'taken';
    if (delayMinutes > 30) {
      status = 'late';
    }

    console.log(`\n計算結果:`);
    console.log(`   排定時間: ${scheduledTime.toLocaleString('zh-TW')}`);
    console.log(`   實際時間: ${actualTime.toLocaleString('zh-TW')}`);
    console.log(`   延遲分鐘: ${delayMinutes}`);
    console.log(`   判定狀態: ${status}`);

    // 3. 執行更新
    console.log('\n📋 Step 3: 執行資料庫更新...\n');

    const { data: updateData, error: updateError } = await supabase
      .from('medication_logs')
      .update({
        actual_time: actualTime.toISOString(),
        status: status,
        delay_minutes: delayMinutes > 0 ? delayMinutes : 0,
        confirmed_by: confirmData.confirmedBy,  // 字串
        confirmed_by_user_id: confirmData.confirmedByUserId,  // UUID
        confirmation_method: confirmData.confirmationMethod,
        updated_at: actualTime.toISOString(),
      })
      .eq('id', testLog.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ 更新失敗:', updateError);
      console.error('\n錯誤詳情:');
      console.error('   Code:', updateError.code);
      console.error('   Message:', updateError.message);
      console.error('   Details:', updateError.details);
      console.error('   Hint:', updateError.hint);

      // 檢查常見問題
      console.log('\n🔍 可能的問題:');

      if (updateError.message.includes('null value')) {
        console.log('   ⚠️  可能是必填欄位為 null');
      }

      if (updateError.message.includes('foreign key')) {
        console.log('   ⚠️  可能是外鍵約束問題 (confirmed_by 的 user ID 不存在)');
      }

      if (updateError.message.includes('RLS')) {
        console.log('   ⚠️  可能是 RLS 權限問題');
      }

      if (updateError.code === '23505') {
        console.log('   ⚠️  唯一性約束違反 (重複的記錄)');
      }

      return;
    }

    console.log('✅ 更新成功!');
    console.log('\n更新後的記錄:');
    console.log(JSON.stringify(updateData, null, 2));

    // 4. 驗證結果
    console.log('\n📋 Step 4: 驗證結果...\n');

    const { data: verifyData, error: verifyError } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('id', testLog.id)
      .single();

    if (verifyError) {
      console.error('❌ 驗證失敗:', verifyError.message);
      return;
    }

    console.log('✅ 驗證成功!');
    console.log(`   狀態: ${verifyData.status}`);
    console.log(`   實際時間: ${verifyData.actual_time}`);
    console.log(`   延遲分鐘: ${verifyData.delay_minutes}`);
    console.log(`   確認者: ${verifyData.confirmed_by}`);
    console.log(`   確認方式: ${verifyData.confirmation_method}`);

  } catch (error) {
    console.error('\n❌ 執行錯誤:', error);
  }

  console.log('\n========================================');
  console.log('診斷完成');
  console.log('========================================\n');
}

testConfirmMedication();
