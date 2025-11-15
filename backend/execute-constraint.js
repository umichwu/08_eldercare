/**
 * 直接執行 ALTER TABLE 加入唯一性約束
 * 使用 pg 模組連接到 Supabase PostgreSQL
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Client } = pg;

// 獲取當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入根目錄的 .env 檔案
config({ path: resolve(__dirname, '../.env') });

console.log('🚀 準備加入唯一性約束\n');
console.log('='.repeat(60));
console.log('');

// 從 Supabase URL 建構 PostgreSQL 連線字串
const supabaseUrl = process.env.SUPABASE_URL;
const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);

if (!urlMatch) {
  console.error('❌ 無法解析 Supabase URL');
  process.exit(1);
}

const projectRef = urlMatch[1];

// Supabase 的 PostgreSQL 連線資訊
// 格式: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
console.log('📊 Supabase 專案資訊:');
console.log(`   專案參考: ${projectRef}`);
console.log('');

console.log('⚠️  注意: 需要 Supabase 資料庫密碼才能直接連線');
console.log('');
console.log('由於安全考量，建議使用以下方式手動執行：');
console.log('');
console.log('方法 1: 使用 Supabase Dashboard');
console.log('-'.repeat(60));
console.log('1. 前往 https://supabase.com/dashboard');
console.log(`2. 選擇專案 (${projectRef})`);
console.log('3. 前往 SQL Editor');
console.log('4. 新建查詢並執行以下 SQL:');
console.log('');
console.log(`
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'medication_logs_unique_schedule'
    ) THEN
        ALTER TABLE medication_logs
        ADD CONSTRAINT medication_logs_unique_schedule
        UNIQUE (medication_id, elder_id, scheduled_time);

        RAISE NOTICE '✅ 已建立唯一性約束';
    ELSE
        RAISE NOTICE '⚠️  約束已存在';
    END IF;
END $$;
`);
console.log('-'.repeat(60));
console.log('');
console.log('方法 2: 使用 psql (需要資料庫密碼)');
console.log('-'.repeat(60));
console.log(`psql "postgresql://postgres:[YOUR-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres" -f migrations/add_medication_logs_unique_constraint.sql`);
console.log('-'.repeat(60));
console.log('');
console.log('方法 3: 使用 Supabase CLI');
console.log('-'.repeat(60));
console.log('npx supabase db push --db-url "postgresql://..."');
console.log('-'.repeat(60));
console.log('');

console.log('='.repeat(60));
console.log('');
console.log('📝 Migration 檔案已準備好:');
console.log('   backend/migrations/add_medication_logs_unique_constraint.sql');
console.log('');
