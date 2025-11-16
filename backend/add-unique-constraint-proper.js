/**
 * 在 medication_logs 表新增唯一性約束
 * 防止 (medication_id, elder_id, scheduled_time) 重複
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addUniqueConstraint() {
  try {
    console.log('🔧 在 medication_logs 表新增唯一性約束...\n');

    // 使用 Supabase 的 RPC 功能執行 SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- 先刪除舊的約束（如果存在）
        ALTER TABLE medication_logs
        DROP CONSTRAINT IF EXISTS unique_medication_elder_time;

        -- 新增唯一性約束
        ALTER TABLE medication_logs
        ADD CONSTRAINT unique_medication_elder_time
        UNIQUE (medication_id, elder_id, scheduled_time);
      `
    });

    if (error) {
      console.error('❌ 執行失敗:', error);
      console.log('\n嘗試使用直接 SQL 執行...\n');

      // 如果 RPC 失敗，嘗試直接使用 Supabase SQL Editor
      console.log('請在 Supabase SQL Editor 中執行以下 SQL:');
      console.log('---');
      console.log(`
-- 先刪除舊的約束（如果存在）
ALTER TABLE medication_logs
DROP CONSTRAINT IF EXISTS unique_medication_elder_time;

-- 新增唯一性約束
ALTER TABLE medication_logs
ADD CONSTRAINT unique_medication_elder_time
UNIQUE (medication_id, elder_id, scheduled_time);
      `);
      console.log('---');
      return;
    }

    console.log('✅ 唯一性約束新增成功！');
    console.log('   約束名稱: unique_medication_elder_time');
    console.log('   約束欄位: (medication_id, elder_id, scheduled_time)');

  } catch (error) {
    console.error('❌ 執行失敗:', error);
  }
}

addUniqueConstraint();
