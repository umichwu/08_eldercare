/**
 * 透過建立臨時的 Postgres 函數來執行 ALTER TABLE
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

console.log('🚀 透過 API 加入唯一性約束\n');
console.log('='.repeat(60));
console.log('');

async function applyConstraint() {
  // 步驟 1: 建立臨時函數來執行 ALTER TABLE
  console.log('步驟 1: 建立臨時 SQL 函數...');

  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION add_medication_logs_constraint()
    RETURNS TEXT AS $$
    BEGIN
        -- 檢查約束是否已存在
        IF EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'medication_logs_unique_schedule'
        ) THEN
            RETURN '⚠️  約束已存在: medication_logs_unique_schedule';
        END IF;

        -- 加入唯一性約束
        ALTER TABLE medication_logs
        ADD CONSTRAINT medication_logs_unique_schedule
        UNIQUE (medication_id, elder_id, scheduled_time);

        RETURN '✅ 已成功建立唯一性約束: medication_logs_unique_schedule';
    END;
    $$ LANGUAGE plpgsql;
  `;

  // 使用 RPC 執行 SQL (透過 Postgres 的 EXECUTE)
  const { data: funcData, error: funcError } = await supabase.rpc('exec', {
    sql: createFunctionSQL
  });

  if (funcError) {
    console.log('   ⚠️  無法透過 RPC 執行（這是預期的）');
    console.log('');

    // 嘗試使用原始 SQL 查詢
    console.log('步驟 2: 嘗試直接執行 ALTER TABLE...');

    const alterTableSQL = `
      ALTER TABLE medication_logs
      ADD CONSTRAINT IF NOT EXISTS medication_logs_unique_schedule
      UNIQUE (medication_id, elder_id, scheduled_time);
    `;

    const { data: alterData, error: alterError } = await supabase.rpc('query', {
      query: alterTableSQL
    });

    if (alterError) {
      console.log('   ❌ 無法直接執行');
      console.log('');
      console.log('💡 解決方案:');
      console.log('');
      console.log('請使用以下任一方式手動執行：');
      console.log('');
      console.log('【方式 1】Supabase Dashboard (推薦) ✨');
      console.log('-'.repeat(60));
      console.log('1. 前往 https://supabase.com/dashboard');
      console.log('2. 選擇您的專案');
      console.log('3. 側邊欄 > SQL Editor');
      console.log('4. 點擊 "New query"');
      console.log('5. 貼上以下 SQL 並執行:');
      console.log('');
      console.log('   ALTER TABLE medication_logs');
      console.log('   ADD CONSTRAINT medication_logs_unique_schedule');
      console.log('   UNIQUE (medication_id, elder_id, scheduled_time);');
      console.log('');
      console.log('-'.repeat(60));
      console.log('');
      return false;
    }

    console.log('✅ 成功!');
    return true;
  }

  // 步驟 2: 執行函數
  console.log('步驟 2: 執行函數...');

  const { data, error } = await supabase.rpc('add_medication_logs_constraint');

  if (error) {
    console.error('❌ 執行失敗:', error.message);
    return false;
  }

  console.log(`✅ ${data}`);

  // 步驟 3: 清理臨時函數
  console.log('步驟 3: 清理臨時函數...');

  const { error: dropError } = await supabase.rpc('exec', {
    sql: 'DROP FUNCTION IF EXISTS add_medication_logs_constraint();'
  });

  if (!dropError) {
    console.log('✅ 臨時函數已清理');
  }

  return true;
}

async function verifyConstraint() {
  console.log('');
  console.log('🔍 驗證約束是否已加入...\n');

  // 嘗試插入重複記錄來測試
  const testMedicationId = 'test-' + Date.now();
  const testElderId = 'test-elder';
  const testTime = new Date().toISOString();

  console.log('測試插入第一筆記錄...');

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
    console.log('   ⚠️  無法插入測試記錄:', error1.message);
    return;
  }

  console.log('   ✅ 第一筆記錄插入成功');

  console.log('測試插入重複記錄（應該失敗）...');

  const { data: second, error: error2 } = await supabase
    .from('medication_logs')
    .insert({
      medication_id: testMedicationId,
      elder_id: testElderId,
      scheduled_time: testTime,
      status: 'pending'
    })
    .select();

  if (error2) {
    if (error2.message.includes('duplicate') || error2.message.includes('unique')) {
      console.log('   ✅ 完美！唯一性約束正常運作');
      console.log(`   錯誤訊息: ${error2.message}`);
    } else {
      console.log('   ⚠️  發生其他錯誤:', error2.message);
    }
  } else {
    console.log('   ❌ 警告：重複記錄仍可插入！約束可能未生效');
  }

  // 清理測試記錄
  console.log('清理測試記錄...');
  await supabase
    .from('medication_logs')
    .delete()
    .eq('medication_id', testMedicationId);

  console.log('   ✅ 測試記錄已清理');
}

async function main() {
  try {
    const success = await applyConstraint();

    if (success) {
      await verifyConstraint();
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
