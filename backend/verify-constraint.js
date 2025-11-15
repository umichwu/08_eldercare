/**
 * 驗證唯一性約束是否已加入
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// 獲取當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入根目錄的 .env 檔案
config({ path: resolve(__dirname, '../.env') });

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 驗證唯一性約束\n');
console.log('='.repeat(60));
console.log('');

/**
 * 檢查是否有重複記錄
 */
async function checkDuplicates() {
  console.log('1️⃣ 檢查是否還有重複記錄...\n');

  const { data: logs, error } = await supabase
    .from('medication_logs')
    .select('medication_id, elder_id, scheduled_time');

  if (error) {
    console.error('   ❌ 查詢失敗:', error.message);
    return;
  }

  // 在本地計算重複
  const grouped = {};
  logs.forEach(log => {
    const key = `${log.medication_id}-${log.elder_id}-${log.scheduled_time}`;
    grouped[key] = (grouped[key] || 0) + 1;
  });

  const duplicates = Object.entries(grouped).filter(([_, count]) => count > 1);

  if (duplicates.length > 0) {
    console.log('   ⚠️  發現重複記錄:');
    duplicates.forEach(([key, count]) => {
      console.log(`      - ${key}: ${count} 筆`);
    });
    console.log('');
  } else {
    console.log('   ✅ 沒有重複記錄');
    console.log('');
  }

  return duplicates.length === 0;
}

/**
 * 測試插入重複記錄
 */
async function testUniqueConstraint() {
  console.log('2️⃣ 測試唯一性約束（嘗試插入重複記錄）...\n');

  // 先取得一個真實的 medication_id 和 elder_id 來測試
  const { data: sample, error: sampleError } = await supabase
    .from('medication_logs')
    .select('medication_id, elder_id')
    .limit(1)
    .single();

  if (sampleError || !sample) {
    console.log('   ⚠️  無法取得測試資料，跳過測試');
    console.log('');
    return null;
  }

  const testMedicationId = sample.medication_id;
  const testElderId = sample.elder_id;
  // 使用未來的時間以避免與現有記錄衝突
  const testTime = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  // 第一次插入
  console.log('   插入第一筆測試記錄...');

  const { data: first, error: error1 } = await supabase
    .from('medication_logs')
    .insert({
      medication_id: testMedicationId,
      elder_id: testElderId,
      scheduled_time: testTime,
      status: 'pending'
    })
    .select();

  if (error1) {
    console.log('   ❌ 無法插入測試記錄:', error1.message);
    return false;
  }

  console.log('   ✅ 第一筆記錄插入成功');
  console.log('');

  // 第二次插入（重複）
  console.log('   嘗試插入重複記錄...');

  const { data: second, error: error2 } = await supabase
    .from('medication_logs')
    .insert({
      medication_id: testMedicationId,
      elder_id: testElderId,
      scheduled_time: testTime,
      status: 'pending'
    })
    .select();

  let constraintExists = false;

  if (error2) {
    if (error2.message.includes('duplicate') ||
        error2.message.includes('unique') ||
        error2.message.includes('medication_logs_unique_schedule')) {
      console.log('   ✅ 完美！唯一性約束正常運作');
      console.log(`   ⚠️  錯誤訊息: ${error2.message}`);
      constraintExists = true;
    } else {
      console.log('   ⚠️  發生其他錯誤:', error2.message);
    }
  } else {
    console.log('   ❌ 警告：重複記錄可以插入！');
    console.log('   ❌ 唯一性約束尚未生效');
    console.log('');
    console.log('   請執行以下步驟：');
    console.log('   1. 前往 Supabase Dashboard > SQL Editor');
    console.log('   2. 執行以下 SQL:');
    console.log('');
    console.log('      ALTER TABLE medication_logs');
    console.log('      ADD CONSTRAINT medication_logs_unique_schedule');
    console.log('      UNIQUE (medication_id, elder_id, scheduled_time);');
    console.log('');
  }

  console.log('');

  // 清理測試記錄
  console.log('   清理測試記錄...');
  await supabase
    .from('medication_logs')
    .delete()
    .eq('medication_id', testMedicationId);
  console.log('   ✅ 測試記錄已清理');
  console.log('');

  return constraintExists;
}

/**
 * 顯示今日用藥記錄
 */
async function showTodayLogs() {
  console.log('3️⃣ 今日用藥記錄...\n');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: logs, error } = await supabase
    .from('medication_logs')
    .select(`
      id,
      scheduled_time,
      status,
      created_at,
      medications (
        medication_name
      )
    `)
    .gte('scheduled_time', today.toISOString())
    .lt('scheduled_time', tomorrow.toISOString())
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('   ❌ 查詢今日記錄失敗:', error.message);
    return;
  }

  if (logs.length === 0) {
    console.log('   📭 今日沒有用藥記錄');
  } else {
    console.log(`   📊 今日共有 ${logs.length} 筆用藥記錄:\n`);

    logs.forEach(log => {
      const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const statusIcon = {
        'pending': '⏳',
        'taken': '✅',
        'missed': '❌',
        'skipped': '⏭️'
      }[log.status] || '❓';

      console.log(`      ${statusIcon} ${time} - ${log.medications?.medication_name || '未知藥物'} (${log.status})`);
    });
  }

  console.log('');
}

/**
 * 顯示統計資訊
 */
async function showStatistics() {
  console.log('4️⃣ 資料庫統計...\n');

  const { count: totalCount, error: countError } = await supabase
    .from('medication_logs')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('   ❌ 計算總記錄數失敗:', countError.message);
    return;
  }

  console.log(`   📊 medication_logs 總記錄數: ${totalCount}`);

  // 計算今日記錄
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { count: todayCount, error: todayError } = await supabase
    .from('medication_logs')
    .select('*', { count: 'exact', head: true })
    .gte('scheduled_time', today.toISOString())
    .lt('scheduled_time', tomorrow.toISOString());

  if (!todayError) {
    console.log(`   📅 今日記錄數: ${todayCount}`);
  }

  // 計算各狀態的記錄數
  const { data: statusCounts, error: statusError } = await supabase
    .from('medication_logs')
    .select('status');

  if (!statusError) {
    const counts = {};
    statusCounts.forEach(log => {
      counts[log.status] = (counts[log.status] || 0) + 1;
    });

    console.log('   📈 狀態分布:');
    Object.entries(counts).forEach(([status, count]) => {
      const icon = {
        'pending': '⏳',
        'taken': '✅',
        'missed': '❌',
        'skipped': '⏭️'
      }[status] || '❓';
      console.log(`      ${icon} ${status}: ${count}`);
    });
  }

  console.log('');
}

/**
 * 主函數
 */
async function main() {
  try {
    // 檢查重複記錄
    const noDuplicates = await checkDuplicates();

    // 測試唯一性約束
    const constraintExists = await testUniqueConstraint();

    // 顯示今日記錄
    await showTodayLogs();

    // 顯示統計
    await showStatistics();

    console.log('='.repeat(60));
    console.log('');

    // 總結
    console.log('📝 驗證總結:\n');

    if (noDuplicates && (constraintExists === true)) {
      console.log('   ✅ 所有檢查通過！');
      console.log('   ✅ 沒有重複記錄');
      console.log('   ✅ 唯一性約束正常運作');
      console.log('');
      console.log('   🎉 修復完成！可以正常使用了');
    } else {
      console.log('   ⚠️  仍有問題需要處理:');

      if (!noDuplicates) {
        console.log('   ❌ 仍有重複記錄');
        console.log('      → 請重新執行: node fix-duplicate-medication-logs.js');
      }

      if (constraintExists === false) {
        console.log('   ❌ 唯一性約束尚未生效');
        console.log('      → 請前往 Supabase Dashboard > SQL Editor 執行:');
        console.log('');
        console.log('        ALTER TABLE medication_logs');
        console.log('        ADD CONSTRAINT medication_logs_unique_schedule');
        console.log('        UNIQUE (medication_id, elder_id, scheduled_time);');
      } else if (constraintExists === null) {
        console.log('   ⚠️  無法測試唯一性約束（測試資料不足）');
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('');

  } catch (error) {
    console.error('❌ 執行過程中發生錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
