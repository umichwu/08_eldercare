/**
 * 執行資料庫 migration
 * 使用 Supabase Postgres REST API 執行 SQL
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

// 獲取當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入根目錄的 .env 檔案
config({ path: resolve(__dirname, '../.env') });

// 讀取 migration SQL
const migrationSQL = readFileSync(
  resolve(__dirname, 'migrations/add_medication_logs_unique_constraint.sql'),
  'utf-8'
);

console.log('🚀 準備執行 Migration\n');
console.log('='.repeat(60));
console.log('Migration SQL:');
console.log('-'.repeat(60));
console.log(migrationSQL);
console.log('-'.repeat(60));
console.log('');

// 從 Supabase URL 提取專案參考和區域
const supabaseUrl = process.env.SUPABASE_URL;
const urlParts = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);

if (!urlParts) {
  console.error('❌ 無法解析 Supabase URL');
  process.exit(1);
}

const projectRef = urlParts[1];

console.log('📊 Supabase 專案資訊:');
console.log(`   專案參考: ${projectRef}`);
console.log(`   URL: ${supabaseUrl}`);
console.log('');

// 使用 Supabase Management API
const apiUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

console.log('🔧 執行 Migration...\n');

// 使用 fetch 執行 SQL
try {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: migrationSQL })
  });

  if (!response.ok) {
    console.error('❌ Migration 執行失敗');
    console.error(`   狀態碼: ${response.status}`);
    console.error(`   狀態文字: ${response.statusText}`);

    const errorText = await response.text();
    console.error(`   錯誤詳情: ${errorText}`);
    console.log('');
    console.log('⚠️  請手動在 Supabase Dashboard > SQL Editor 中執行上述 SQL');
    console.log('');
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ Migration 執行成功！');
  console.log('');
  console.log('結果:', JSON.stringify(result, null, 2));

} catch (error) {
  console.error('❌ 執行過程中發生錯誤:', error.message);
  console.log('');
  console.log('⚠️  請手動在 Supabase Dashboard > SQL Editor 中執行 migration SQL');
  console.log('');
  console.log('執行方式：');
  console.log('1. 前往 https://supabase.com/dashboard');
  console.log(`2. 選擇專案 (${projectRef})`);
  console.log('3. 前往 SQL Editor');
  console.log('4. 新建查詢');
  console.log('5. 複製貼上 migrations/add_medication_logs_unique_constraint.sql 的內容');
  console.log('6. 點擊 Run');
  console.log('');
}
