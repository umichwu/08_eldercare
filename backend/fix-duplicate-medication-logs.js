/**
 * 修復重複的用藥記錄問題
 *
 * 此腳本將：
 * 1. 查看重複記錄的數量
 * 2. 刪除重複記錄，只保留最新的一筆
 * 3. 加入唯一性約束，防止未來產生重複記錄
 * 4. 驗證修復結果
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
  process.env.SUPABASE_SERVICE_ROLE_KEY // 使用 service role key 以獲得完整權限
);

console.log('🔧 環境變數載入狀態:');
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
console.log(`   SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}`);
console.log('');

/**
 * 查看重複記錄
 */
async function checkDuplicates() {
  console.log('📊 正在檢查重複記錄...\n');

  const { data, error } = await supabase.rpc('check_duplicate_medication_logs');

  if (error) {
    // 如果 RPC 函數不存在，使用直接查詢
    console.log('⚠️  使用直接查詢檢查重複記錄...');

    const { data: logs, error: queryError } = await supabase
      .from('medication_logs')
      .select('medication_id, elder_id, scheduled_time');

    if (queryError) {
      console.error('❌ 查詢失敗:', queryError.message);
      return null;
    }

    // 在本地計算重複
    const grouped = {};
    logs.forEach(log => {
      const key = `${log.medication_id}-${log.elder_id}-${log.scheduled_time}`;
      grouped[key] = (grouped[key] || 0) + 1;
    });

    const duplicates = Object.entries(grouped)
      .filter(([_, count]) => count > 1)
      .map(([key, count]) => {
        const [medication_id, elder_id, scheduled_time] = key.split('-');
        return { medication_id, elder_id, scheduled_time, duplicate_count: count };
      });

    if (duplicates.length > 0) {
      console.log('⚠️  發現重複記錄:');
      duplicates.forEach(dup => {
        console.log(`   - 用藥ID: ${dup.medication_id}, 長者ID: ${dup.elder_id}`);
        console.log(`     時間: ${dup.scheduled_time}, 重複次數: ${dup.duplicate_count}`);
      });
      console.log(`\n總共發現 ${duplicates.length} 組重複記錄\n`);
    } else {
      console.log('✅ 沒有發現重複記錄\n');
    }

    return duplicates;
  }

  return data;
}

/**
 * 刪除重複記錄
 */
async function deleteDuplicates() {
  console.log('🗑️  正在刪除重複記錄...\n');

  // 獲取所有記錄
  const { data: allLogs, error: fetchError } = await supabase
    .from('medication_logs')
    .select('id, medication_id, elder_id, scheduled_time, created_at')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ 獲取記錄失敗:', fetchError.message);
    return false;
  }

  // 分組並找出要刪除的記錄
  const grouped = {};
  allLogs.forEach(log => {
    const key = `${log.medication_id}-${log.elder_id}-${log.scheduled_time}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(log);
  });

  // 找出要刪除的 ID（保留每組最新的一筆）
  const idsToDelete = [];
  Object.values(grouped).forEach(logs => {
    if (logs.length > 1) {
      // 已經按 created_at DESC 排序，保留第一筆，刪除其他
      const toDelete = logs.slice(1).map(log => log.id);
      idsToDelete.push(...toDelete);
    }
  });

  if (idsToDelete.length === 0) {
    console.log('✅ 沒有需要刪除的重複記錄\n');
    return true;
  }

  console.log(`📌 找到 ${idsToDelete.length} 筆重複記錄需要刪除`);

  // 分批刪除（Supabase 有查詢限制）
  const batchSize = 100;
  let deletedCount = 0;

  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);

    const { error: deleteError } = await supabase
      .from('medication_logs')
      .delete()
      .in('id', batch);

    if (deleteError) {
      console.error(`❌ 刪除批次 ${i / batchSize + 1} 失敗:`, deleteError.message);
      return false;
    }

    deletedCount += batch.length;
    console.log(`   已刪除 ${deletedCount}/${idsToDelete.length} 筆記錄`);
  }

  console.log(`✅ 成功刪除 ${deletedCount} 筆重複記錄\n`);
  return true;
}

/**
 * 檢查約束是否存在
 */
async function checkConstraintExists() {
  const { data, error } = await supabase.rpc('check_medication_logs_constraint');

  if (error) {
    // 如果 RPC 不存在，返回 false（假設約束不存在）
    return false;
  }

  return data;
}

/**
 * 驗證修復結果
 */
async function verifyFix() {
  console.log('✅ 正在驗證修復結果...\n');

  const { count: totalCount, error: countError } = await supabase
    .from('medication_logs')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ 計算總記錄數失敗:', countError.message);
    return;
  }

  console.log(`📊 總記錄數: ${totalCount}`);

  // 再次檢查是否還有重複
  const duplicates = await checkDuplicates();

  if (!duplicates || duplicates.length === 0) {
    console.log('✅ 驗證通過：沒有重複記錄\n');
  } else {
    console.log('⚠️  警告：仍然存在重複記錄\n');
  }

  // 顯示今日記錄
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: todayLogs, error: todayError } = await supabase
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

  if (todayError) {
    console.error('❌ 查詢今日記錄失敗:', todayError.message);
    return;
  }

  console.log('📅 今日用藥記錄:');
  if (todayLogs.length === 0) {
    console.log('   沒有今日用藥記錄');
  } else {
    todayLogs.forEach(log => {
      const time = new Date(log.scheduled_time).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log(`   - ${time} ${log.medications?.medication_name || '未知藥物'} (${log.status})`);
    });
  }
  console.log('');
}

/**
 * 主函數
 */
async function main() {
  console.log('🚀 開始修復重複的用藥記錄問題\n');
  console.log('='.repeat(60));
  console.log('');

  try {
    // 步驟 1: 檢查重複記錄
    console.log('步驟 1/4: 檢查重複記錄');
    console.log('-'.repeat(60));
    const duplicates = await checkDuplicates();

    // 步驟 2: 刪除重複記錄
    console.log('步驟 2/4: 刪除重複記錄');
    console.log('-'.repeat(60));
    const deleteSuccess = await deleteDuplicates();

    if (!deleteSuccess) {
      console.error('❌ 刪除重複記錄失敗，中止執行');
      process.exit(1);
    }

    // 步驟 3: 加入唯一性約束
    console.log('步驟 3/4: 加入唯一性約束');
    console.log('-'.repeat(60));
    console.log('⚠️  唯一性約束需要在 Supabase SQL 編輯器中手動執行：');
    console.log('');
    console.log('ALTER TABLE medication_logs');
    console.log('ADD CONSTRAINT medication_logs_unique_schedule');
    console.log('UNIQUE (medication_id, elder_id, scheduled_time);');
    console.log('');
    console.log('請前往 Supabase Dashboard > SQL Editor 執行上述 SQL');
    console.log('');

    // 步驟 4: 驗證結果
    console.log('步驟 4/4: 驗證修復結果');
    console.log('-'.repeat(60));
    await verifyFix();

    console.log('='.repeat(60));
    console.log('✅ 修復流程完成！');
    console.log('');
    console.log('📝 後續步驟:');
    console.log('   1. 前往 Supabase Dashboard > SQL Editor');
    console.log('   2. 執行上述的 ALTER TABLE 命令以加入唯一性約束');
    console.log('   3. 重新整理前端頁面驗證結果');
    console.log('');

  } catch (error) {
    console.error('❌ 執行過程中發生錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行主函數
main();
