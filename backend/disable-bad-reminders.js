import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (same as supabase.js)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function disableBadReminders() {
  console.log('🔧 正在停用有問題的提醒...');

  const badReminderIds = [
    '3f059e46-bd24-4248-89f8-76627a565925',
    '950735cd-de48-4802-a064-a22385d2de3c'
  ];

  const { data, error } = await supabase
    .from('medication_reminders')
    .update({
      is_enabled: false,
      updated_at: new Date().toISOString()
    })
    .in('id', badReminderIds)
    .select();

  if (error) {
    console.error('❌ 停用失敗:', error.message);
    process.exit(1);
  }

  console.log('✅ 成功停用提醒:', data.length, '筆');
  data.forEach(reminder => {
    console.log('  - ID:', reminder.id);
    console.log('    Medication ID:', reminder.medication_id);
    console.log('    Is Enabled:', reminder.is_enabled);
  });

  process.exit(0);
}

disableBadReminders();
