/**
 * 刪除今明兩日的所有用藥記錄，準備重新生成
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

async function deleteAllTodayTomorrowLogs() {
  try {
    console.log('🗑️  刪除今明兩日的所有用藥記錄...\n');

    // 計算今明兩日的時間範圍
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(today.getDate() + 2);

    console.log(`時間範圍: ${today.toISOString()} ~ ${twoDaysLater.toISOString()}\n`);

    // 先查詢有多少筆
    const { data: logs, error: queryError } = await supabase
      .from('medication_logs')
      .select('id, scheduled_time')
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', twoDaysLater.toISOString());

    if (queryError) {
      console.error('❌ 查詢失敗:', queryError);
      return;
    }

    console.log(`找到 ${logs.length} 筆記錄將被刪除\n`);

    if (logs.length === 0) {
      console.log('✅ 沒有需要刪除的記錄');
      return;
    }

    // 執行刪除
    const { error: deleteError } = await supabase
      .from('medication_logs')
      .delete()
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', twoDaysLater.toISOString());

    if (deleteError) {
      console.error('❌ 刪除失敗:', deleteError);
      return;
    }

    console.log(`✅ 成功刪除 ${logs.length} 筆記錄`);

  } catch (error) {
    console.error('❌ 執行失敗:', error);
  }
}

deleteAllTodayTomorrowLogs();
