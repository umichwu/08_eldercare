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

// 查詢一筆提醒記錄，看看有哪些欄位
const { data, error } = await supabase
  .from('medication_reminders')
  .select('*')
  .limit(1)
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('medication_reminders 表的欄位:');
  console.log(Object.keys(data));
}
