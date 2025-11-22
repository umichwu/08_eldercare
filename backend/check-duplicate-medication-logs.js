/**
 * 檢查重複的用藥記錄
 * 找出 07:59 的助眠藥和降血壓藥，以及 12:00 的止痛藥
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rxquczgjsgkeqemhngnb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cXVjemdqc2drZXFlbWhuZ25iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzQzNTY4MiwiZXhwIjoyMDUzMDExNjgyfQ.wOEf_CqLM-Nxl0E3i2Z0l36KXx9IhAKuB8CRqvLSEJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkDuplicateLogs() {
    console.log('🔍 開始檢查重複用藥記錄...\n');

    try {
        // 1. 查詢所有 medication_logs
        const { data: logs, error: logsError } = await supabase
            .from('medication_logs')
            .select(`
                *,
                medications (
                    id,
                    medication_name,
                    dosage,
                    elder_id
                )
            `)
            .order('scheduled_time', { ascending: false })
            .limit(100);

        if (logsError) throw logsError;

        console.log(`📊 總共 ${logs.length} 筆用藥記錄\n`);

        // 2. 查詢所有 medication_reminders
        const { data: reminders, error: remindersError } = await supabase
            .from('medication_reminders')
            .select(`
                *,
                medications (
                    id,
                    medication_name,
                    dosage,
                    elder_id
                )
            `)
            .order('medication_id');

        if (remindersError) throw remindersError;

        console.log(`⏰ 總共 ${reminders.length} 筆用藥提醒設定\n`);

        // 3. 找出問題記錄
        console.log('='.repeat(60));
        console.log('🔍 問題 1: 07:59 的助眠藥和降血壓藥');
        console.log('='.repeat(60));

        const problem759 = logs.filter(log => {
            const time = new Date(log.scheduled_time);
            const hourMin = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
            const medName = log.medications?.medication_name || log.medication_name;
            return hourMin === '07:59' && (medName?.includes('助眠') || medName?.includes('降血壓'));
        });

        problem759.forEach(log => {
            console.log(`
  Log ID: ${log.id}
  Medication ID: ${log.medication_id}
  Medication Name: ${log.medications?.medication_name || log.medication_name}
  Scheduled Time: ${log.scheduled_time}
  Status: ${log.status}
  Created At: ${log.created_at}
            `);
        });

        console.log('\n' + '='.repeat(60));
        console.log('🔍 問題 2: 12:00 的止痛藥');
        console.log('='.repeat(60));

        const problem1200 = logs.filter(log => {
            const time = new Date(log.scheduled_time);
            const hourMin = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
            const medName = log.medications?.medication_name || log.medication_name;
            return hourMin === '12:00' && medName?.includes('止痛');
        });

        problem1200.forEach(log => {
            console.log(`
  Log ID: ${log.id}
  Medication ID: ${log.medication_id}
  Medication Name: ${log.medications?.medication_name || log.medication_name}
  Scheduled Time: ${log.scheduled_time}
  Status: ${log.status}
  Created At: ${log.created_at}
            `);
        });

        // 4. 檢查對應的提醒設定
        console.log('\n' + '='.repeat(60));
        console.log('⏰ 檢查提醒設定');
        console.log('='.repeat(60));

        console.log('\n--- 助眠藥提醒設定 ---');
        const sleepReminders = reminders.filter(r =>
            r.medications?.medication_name?.includes('助眠')
        );
        sleepReminders.forEach(r => {
            console.log(`
  Reminder ID: ${r.id}
  Medication: ${r.medications?.medication_name}
  Time: ${r.reminder_time}
  Is Active: ${r.is_active}
  Created At: ${r.created_at}
            `);
        });

        console.log('\n--- 降血壓藥提醒設定 ---');
        const bpReminders = reminders.filter(r =>
            r.medications?.medication_name?.includes('降血壓')
        );
        bpReminders.forEach(r => {
            console.log(`
  Reminder ID: ${r.id}
  Medication: ${r.medications?.medication_name}
  Time: ${r.reminder_time}
  Is Active: ${r.is_active}
  Created At: ${r.created_at}
            `);
        });

        console.log('\n--- 止痛藥提醒設定 ---');
        const painReminders = reminders.filter(r =>
            r.medications?.medication_name?.includes('止痛')
        );
        painReminders.forEach(r => {
            console.log(`
  Reminder ID: ${r.id}
  Medication: ${r.medications?.medication_name}
  Time: ${r.reminder_time}
  Is Active: ${r.is_active}
  Created At: ${r.created_at}
            `);
        });

        // 5. 建議解決方案
        console.log('\n' + '='.repeat(60));
        console.log('💡 建議解決方案');
        console.log('='.repeat(60));

        if (problem759.length > 0 || problem1200.length > 0) {
            console.log(`
1. 刪除錯誤的 medication_logs:
   - 07:59 的助眠藥和降血壓藥 (${problem759.length} 筆)
   - 12:00 的止痛藥 (${problem1200.length} 筆)

2. 檢查並修正 medication_reminders:
   - 助眠藥應該是 22:00 (睡前)
   - 降血壓藥應該是 08:00 (早上)
   - 止痛藥應該根據實際需求設定

3. 重新生成今日用藥記錄
            `);

            console.log('\n是否要執行刪除？（需手動確認）');
            console.log(`
刪除指令:
DELETE FROM medication_logs WHERE id IN (${[...problem759, ...problem1200].map(l => `'${l.id}'`).join(', ')});
            `);
        } else {
            console.log('✅ 沒有發現問題記錄');
        }

    } catch (error) {
        console.error('❌ 檢查失敗:', error);
    }
}

// 執行
checkDuplicateLogs();
