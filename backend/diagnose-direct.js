/**
 * 直接查詢 Supabase 診斷用藥時間線問題
 */

import { supabaseAdmin } from './config/supabase.js';

async function diagnoseMedicationTimeline() {
    console.log('🔍 開始診斷用藥時間線問題...\n');

    try {
        // 1. 查詢所有最近的用藥記錄
        console.log('📊 查詢最近的用藥記錄...');
        const { data: logs, error: logsError } = await supabaseAdmin
            .from('medication_logs')
            .select(`
                id,
                elder_id,
                medication_id,
                scheduled_time,
                actual_time,
                status,
                created_at,
                medications (
                    id,
                    medication_name,
                    dosage
                )
            `)
            .order('scheduled_time', { ascending: false })
            .limit(200);

        if (logsError) {
            throw new Error('查詢失敗: ' + logsError.message);
        }

        console.log(`找到 ${logs.length} 筆用藥記錄\n`);

        // 2. 篩選問題記錄 - 07:59 的助眠藥和降血壓藥
        console.log('='.repeat(70));
        console.log('🔍 問題 1: 07:59 的助眠藥和降血壓藥');
        console.log('='.repeat(70));

        const problem759 = logs.filter(log => {
            const time = new Date(log.scheduled_time);
            const hours = time.getUTCHours() + 8; // 轉換為台北時區 UTC+8
            const minutes = time.getUTCMinutes();
            const medName = log.medications?.medication_name || '';

            return ((hours === 7 || hours === 31) && minutes === 59) && // 31 = 7 + 24 (跨日)
                   (medName.includes('助眠') || medName.includes('降血壓'));
        });

        if (problem759.length > 0) {
            console.log(`\n❌ 找到 ${problem759.length} 筆錯誤記錄：\n`);
            problem759.forEach((log, index) => {
                const time = new Date(log.scheduled_time);
                console.log(`[${index + 1}]`);
                console.log(`  Log ID: ${log.id}`);
                console.log(`  Elder ID: ${log.elder_id}`);
                console.log(`  Medication ID: ${log.medication_id}`);
                console.log(`  藥物名稱: ${log.medications?.medication_name || '未知'}`);
                console.log(`  排定時間 (UTC): ${time.toISOString()}`);
                console.log(`  排定時間 (台北): ${new Date(time.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)}`);
                console.log(`  狀態: ${log.status}`);
                console.log(`  建立時間: ${new Date(log.created_at).toISOString()}`);
                console.log('');
            });

            // 取得相關的 medication_reminders
            const medicationIds = [...new Set(problem759.map(log => log.medication_id))];
            console.log(`\n查詢 ${medicationIds.length} 個藥物的提醒設定...\n`);

            for (const medId of medicationIds) {
                const { data: reminders } = await supabaseAdmin
                    .from('medication_reminders')
                    .select('*')
                    .eq('medication_id', medId);

                if (reminders && reminders.length > 0) {
                    console.log(`Medication ID: ${medId}`);
                    reminders.forEach(reminder => {
                        console.log(`  Reminder ID: ${reminder.id}`);
                        console.log(`  提醒時間: ${reminder.reminder_time}`);
                        console.log(`  是否啟用: ${reminder.is_active}`);
                        console.log(`  建立時間: ${new Date(reminder.created_at).toISOString()}`);
                    });
                    console.log('');
                }
            }
        } else {
            console.log('\n✅ 沒有找到 07:59 的助眠藥或降血壓藥\n');
        }

        // 3. 篩選問題記錄 - 12:00 的止痛藥
        console.log('='.repeat(70));
        console.log('🔍 問題 2: 12:00 的止痛藥');
        console.log('='.repeat(70));

        const problem1200 = logs.filter(log => {
            const time = new Date(log.scheduled_time);
            const hours = time.getUTCHours() + 8; // 轉換為台北時區
            const minutes = time.getUTCMinutes();
            const medName = log.medications?.medication_name || '';

            return ((hours === 12 || hours === 36) && minutes === 0) && // 36 = 12 + 24
                   medName.includes('止痛');
        });

        if (problem1200.length > 0) {
            console.log(`\n❌ 找到 ${problem1200.length} 筆錯誤記錄：\n`);
            problem1200.forEach((log, index) => {
                const time = new Date(log.scheduled_time);
                console.log(`[${index + 1}]`);
                console.log(`  Log ID: ${log.id}`);
                console.log(`  Elder ID: ${log.elder_id}`);
                console.log(`  Medication ID: ${log.medication_id}`);
                console.log(`  藥物名稱: ${log.medications?.medication_name || '未知'}`);
                console.log(`  排定時間 (UTC): ${time.toISOString()}`);
                console.log(`  排定時間 (台北): ${new Date(time.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)}`);
                console.log(`  狀態: ${log.status}`);
                console.log(`  建立時間: ${new Date(log.created_at).toISOString()}`);
                console.log('');
            });

            // 取得相關的 medication_reminders
            const medicationIds = [...new Set(problem1200.map(log => log.medication_id))];
            console.log(`\n查詢 ${medicationIds.length} 個藥物的提醒設定...\n`);

            for (const medId of medicationIds) {
                const { data: reminders } = await supabaseAdmin
                    .from('medication_reminders')
                    .select('*')
                    .eq('medication_id', medId);

                if (reminders && reminders.length > 0) {
                    console.log(`Medication ID: ${medId}`);
                    reminders.forEach(reminder => {
                        console.log(`  Reminder ID: ${reminder.id}`);
                        console.log(`  提醒時間: ${reminder.reminder_time}`);
                        console.log(`  是否啟用: ${reminder.is_active}`);
                        console.log(`  建立時間: ${new Date(reminder.created_at).toISOString()}`);
                    });
                    console.log('');
                }
            }
        } else {
            console.log('\n✅ 沒有找到 12:00 的止痛藥\n');
        }

        // 4. 總結與建議
        console.log('='.repeat(70));
        console.log('💡 診斷總結與建議');
        console.log('='.repeat(70));

        const totalProblems = problem759.length + problem1200.length;

        if (totalProblems > 0) {
            console.log(`\n❌ 共發現 ${totalProblems} 筆錯誤記錄\n`);
            console.log('可能的原因：');
            console.log('1. medication_reminders 表中有錯誤的提醒時間設定');
            console.log('2. 舊的 medication_logs 在修改提醒時間後沒有被清除');
            console.log('3. generate-today-logs API 重複生成了記錄\n');

            console.log('建議的修復步驟：');
            console.log('1. 檢查上述的 medication_reminders 設定是否正確');
            console.log('2. 刪除錯誤的 medication_logs 記錄');
            console.log('3. 修正 medication_reminders 的提醒時間');
            console.log('4. 重新生成今日用藥記錄\n');

            // 生成刪除 SQL
            const allProblemIds = [...problem759, ...problem1200].map(log => `'${log.id}'`);
            if (allProblemIds.length > 0) {
                console.log('可使用以下 SQL 刪除這些錯誤記錄：');
                console.log('```sql');
                console.log(`DELETE FROM medication_logs WHERE id IN (${allProblemIds.join(', ')});`);
                console.log('```\n');
            }

        } else {
            console.log('\n✅ 沒有發現問題記錄！\n');
        }

    } catch (error) {
        console.error('❌ 診斷失敗:', error.message);
        console.error(error);
    }
}

// 執行診斷
diagnoseMedicationTimeline().catch(console.error);
