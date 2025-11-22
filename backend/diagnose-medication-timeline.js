/**
 * 診斷用藥時間線問題
 * 直接透過 API 查詢資料
 */

const API_BASE_URL = 'https://eldercare-backend-8o4k.onrender.com';

async function diagnoseMedicationTimeline() {
    console.log('🔍 開始診斷用藥時間線問題...\n');

    try {
        // 1. 查詢所有用藥記錄（最近7天）
        console.log('📊 查詢用藥記錄...');
        const logsResponse = await fetch(`${API_BASE_URL}/api/medication-logs/all?limit=200`);
        const logsData = await logsResponse.json();

        if (!logsData.success) {
            throw new Error('無法取得用藥記錄: ' + logsData.message);
        }

        const logs = logsData.logs || [];
        console.log(`找到 ${logs.length} 筆用藥記錄\n`);

        // 2. 篩選問題記錄
        console.log('='.repeat(70));
        console.log('🔍 問題 1: 07:59 的助眠藥和降血壓藥');
        console.log('='.repeat(70));

        const problem759 = logs.filter(log => {
            const time = new Date(log.scheduled_time);
            const hours = time.getHours();
            const minutes = time.getMinutes();
            const medName = log.medication_name || '';

            return (hours === 7 && minutes === 59) &&
                   (medName.includes('助眠') || medName.includes('降血壓'));
        });

        if (problem759.length > 0) {
            console.log(`❌ 找到 ${problem759.length} 筆錯誤記錄：\n`);
            problem759.forEach((log, index) => {
                const time = new Date(log.scheduled_time);
                console.log(`[${index + 1}]`);
                console.log(`  Log ID: ${log.id}`);
                console.log(`  Medication ID: ${log.medication_id}`);
                console.log(`  藥物名稱: ${log.medication_name}`);
                console.log(`  排定時間: ${time.toLocaleString('zh-TW')}`);
                console.log(`  狀態: ${log.status}`);
                console.log(`  建立時間: ${new Date(log.created_at).toLocaleString('zh-TW')}`);
                console.log('');
            });
        } else {
            console.log('✅ 沒有找到 07:59 的助眠藥或降血壓藥\n');
        }

        console.log('='.repeat(70));
        console.log('🔍 問題 2: 12:00 的止痛藥');
        console.log('='.repeat(70));

        const problem1200 = logs.filter(log => {
            const time = new Date(log.scheduled_time);
            const hours = time.getHours();
            const minutes = time.getMinutes();
            const medName = log.medication_name || '';

            return (hours === 12 && minutes === 0) && medName.includes('止痛');
        });

        if (problem1200.length > 0) {
            console.log(`❌ 找到 ${problem1200.length} 筆錯誤記錄：\n`);
            problem1200.forEach((log, index) => {
                const time = new Date(log.scheduled_time);
                console.log(`[${index + 1}]`);
                console.log(`  Log ID: ${log.id}`);
                console.log(`  Medication ID: ${log.medication_id}`);
                console.log(`  藥物名稱: ${log.medication_name}`);
                console.log(`  排定時間: ${time.toLocaleString('zh-TW')}`);
                console.log(`  狀態: ${log.status}`);
                console.log(`  建立時間: ${new Date(log.created_at).toLocaleString('zh-TW')}`);
                console.log('');
            });
        } else {
            console.log('✅ 沒有找到 12:00 的止痛藥\n');
        }

        // 3. 查詢用藥提醒設定
        console.log('='.repeat(70));
        console.log('⏰ 查詢用藥提醒設定');
        console.log('='.repeat(70));

        // 取得所有涉及的 medication_id
        const medicationIds = new Set([
            ...problem759.map(log => log.medication_id),
            ...problem1200.map(log => log.medication_id)
        ]);

        if (medicationIds.size > 0) {
            console.log(`\n正在查詢 ${medicationIds.size} 個藥物的提醒設定...\n`);

            for (const medId of medicationIds) {
                const remindersResponse = await fetch(`${API_BASE_URL}/api/medication-reminders/medication/${medId}`);
                const remindersData = await remindersResponse.json();

                if (remindersData.success && remindersData.reminders) {
                    console.log(`Medication ID: ${medId}`);
                    remindersData.reminders.forEach(reminder => {
                        console.log(`  Reminder ID: ${reminder.id}`);
                        console.log(`  提醒時間: ${reminder.reminder_time}`);
                        console.log(`  是否啟用: ${reminder.is_active}`);
                        console.log(`  建立時間: ${new Date(reminder.created_at).toLocaleString('zh-TW')}`);
                    });
                    console.log('');
                }
            }
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
            console.log('1. 先檢查上述的 medication_reminders 設定是否正確');
            console.log('2. 刪除錯誤的 medication_logs 記錄');
            console.log('3. 修正 medication_reminders 的提醒時間');
            console.log('4. 重新生成今日用藥記錄\n');

            // 生成刪除 SQL（如果需要）
            if (problem759.length + problem1200.length > 0) {
                const allProblemIds = [...problem759, ...problem1200].map(log => `'${log.id}'`);
                console.log('如需刪除這些錯誤記錄，可使用以下 SQL：');
                console.log('```sql');
                console.log(`DELETE FROM medication_logs WHERE id IN (${allProblemIds.join(', ')});`);
                console.log('```\n');
            }

        } else {
            console.log('\n✅ 沒有發現問題記錄！\n');
        }

    } catch (error) {
        console.error('❌ 診斷失敗:', error.message);
        console.error('詳細錯誤:', error);
    }
}

// 執行診斷
diagnoseMedicationTimeline();
