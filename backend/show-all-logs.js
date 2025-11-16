/**
 * 顯示所有今明兩日的用藥記錄詳細資訊
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

async function showAllLogs() {
  try {
    console.log('📋 顯示所有今明兩日的用藥記錄...\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(today.getDate() + 2);

    const { data: logs, error } = await supabase
      .from('medication_logs')
      .select(`
        id,
        medication_id,
        elder_id,
        scheduled_time,
        status,
        created_at,
        medications (
          medication_name
        )
      `)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', twoDaysLater.toISOString())
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ 查詢失敗:', error);
      return;
    }

    console.log(`📊 找到 ${logs.length} 筆記錄\n`);

    logs.forEach((log, index) => {
      const medName = log.medications?.medication_name || '未知';
      const scheduledTime = new Date(log.scheduled_time);
      const localTime = scheduledTime.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      console.log(`[${index + 1}] ${medName}`);
      console.log(`    排定時間: ${localTime}`);
      console.log(`    ISO 時間: ${log.scheduled_time}`);
      console.log(`    狀態: ${log.status}`);
      console.log(`    ID: ${log.id}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ 執行失敗:', error);
  }
}

showAllLogs();
