/**
 * 使用 Supabase Management API 新增唯一性約束
 */
import fetch from 'node-fetch';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function addUniqueConstraint() {
  try {
    console.log('🔧 新增唯一性約束到 medication_logs 表...\n');

    const sql = `
-- 先檢查是否已有此約束
DO $$
BEGIN
  -- 嘗試刪除舊約束（如果存在）
  ALTER TABLE medication_logs DROP CONSTRAINT IF EXISTS unique_medication_elder_time;

  -- 新增唯一性約束
  ALTER TABLE medication_logs
  ADD CONSTRAINT unique_medication_elder_time
  UNIQUE (medication_id, elder_id, scheduled_time);

  RAISE NOTICE '✅ 唯一性約束已新增';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ 新增約束失敗: %', SQLERRM;
END
$$;
`;

    console.log('執行 SQL:');
    console.log(sql);
    console.log('\n');

    // 使用 Supabase REST API 執行 SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 呼叫失敗:', response.status, errorText);
      console.log('\n⚠️  請手動在 Supabase SQL Editor 執行以下 SQL:\n');
      console.log(sql);
      return;
    }

    const result = await response.json();
    console.log('✅ 執行結果:', result);
    console.log('\n✅ 唯一性約束已成功新增！');

  } catch (error) {
    console.error('❌ 執行失敗:', error.message);
    console.log('\n請手動在 Supabase Dashboard > SQL Editor 執行以下 SQL:\n');
    console.log(`
-- 先刪除舊的約束（如果存在）
ALTER TABLE medication_logs DROP CONSTRAINT IF EXISTS unique_medication_elder_time;

-- 新增唯一性約束
ALTER TABLE medication_logs
ADD CONSTRAINT unique_medication_elder_time
UNIQUE (medication_id, elder_id, scheduled_time);
    `);
  }
}

addUniqueConstraint();
