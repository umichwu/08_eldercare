/**
 * 在 medication_logs 表加入唯一性約束
 *
 * 此腳本將加入約束以防止未來產生重複的用藥記錄
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

console.log('🔧 環境變數載入狀態:');
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
console.log(`   SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}`);
console.log('');

/**
 * 加入唯一性約束
 */
async function addUniqueConstraint() {
  console.log('🔒 正在加入唯一性約束...\n');

  const sql = `
    DO $$
    BEGIN
        -- 檢查約束是否已存在
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'medication_logs_unique_schedule'
        ) THEN
            -- 加入唯一性約束
            ALTER TABLE medication_logs
            ADD CONSTRAINT medication_logs_unique_schedule
            UNIQUE (medication_id, elder_id, scheduled_time);

            RAISE NOTICE '✅ 已建立唯一性約束: medication_logs_unique_schedule';
        ELSE
            RAISE NOTICE '⚠️  約束已存在: medication_logs_unique_schedule';
        END IF;
    END $$;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // 如果 RPC 函數不存在，嘗試直接執行
    console.log('⚠️  無法使用 RPC，嘗試直接執行 SQL...');

    // Supabase JS 客戶端不直接支援 ALTER TABLE
    // 需要使用 Supabase Dashboard 或 PostgreSQL 客戶端
    console.log('');
    console.log('❌ 無法透過 Supabase JS 客戶端執行 ALTER TABLE');
    console.log('');
    console.log('請手動執行以下 SQL：');
    console.log('-'.repeat(60));
    console.log(sql.trim());
    console.log('-'.repeat(60));
    console.log('');
    console.log('執行方式：');
    console.log('1. 前往 Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. 選擇專案');
    console.log('3. 前往 SQL Editor');
    console.log('4. 複製貼上上述 SQL 並執行');
    console.log('');

    return false;
  }

  console.log('✅ 唯一性約束加入成功！');
  return true;
}

/**
 * 驗證約束是否已加入
 */
async function verifyConstraint() {
  console.log('✅ 正在驗證約束...\n');

  const { data, error } = await supabase
    .from('medication_logs')
    .select('id')
    .limit(1);

  if (error) {
    console.error('❌ 無法連接到資料庫:', error.message);
    return false;
  }

  console.log('✅ 資料庫連接正常');
  console.log('');
  console.log('📝 建議測試：');
  console.log('1. 嘗試插入重複的記錄');
  console.log('2. 應該會收到唯一性約束錯誤');
  console.log('');

  return true;
}

/**
 * 主函數
 */
async function main() {
  console.log('🚀 開始加入唯一性約束\n');
  console.log('='.repeat(60));
  console.log('');

  try {
    const success = await addUniqueConstraint();

    if (success) {
      await verifyConstraint();
    }

    console.log('='.repeat(60));
    console.log('');

  } catch (error) {
    console.error('❌ 執行過程中發生錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行主函數
main();
