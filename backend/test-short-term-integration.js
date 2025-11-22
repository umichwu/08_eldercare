/**
 * 短期用藥完整整合測試
 *
 * 測試流程：
 * 1. 建立短期用藥提醒
 * 2. 驗證記錄自動產生
 * 3. 檢查時間過濾正確
 * 4. 檢查序號標記正確
 */

import { supabaseAdmin as supabase } from './config/supabase.js';
import { generateShortTermMedicationLogs } from './services/generateShortTermLogs.js';

async function testShortTermIntegration() {
  console.log('\n========================================');
  console.log('🧪 短期用藥完整整合測試');
  console.log('========================================\n');

  try {
    // 1. 查詢測試用的 elder 和 medication
    console.log('📋 步驟 1: 查詢測試資料...\n');

    const { data: elders } = await supabase
      .from('elders')
      .select('id, name')
      .limit(1);

    if (!elders || elders.length === 0) {
      console.error('❌ 找不到長輩資料');
      return;
    }

    const { data: medications } = await supabase
      .from('medications')
      .select('id, medication_name')
      .eq('elder_id', elders[0].id)
      .limit(1);

    if (!medications || medications.length === 0) {
      console.error('❌ 找不到藥物資料');
      return;
    }

    const elderId = elders[0].id;
    const elderName = elders[0].name;
    const medicationId = medications[0].id;
    const medicationName = medications[0].medication_name;

    console.log(`✅ 測試長輩: ${elderName} (${elderId})`);
    console.log(`✅ 測試藥物: ${medicationName} (${medicationId})\n`);

    // 2. 建立短期用藥提醒
    console.log('📋 步驟 2: 建立短期用藥提醒...\n');

    const now = new Date();
    const currentHour = now.getHours();

    // 設定用藥時間：從當前小時的下一個小時開始，每 4 小時一次
    const startHour = (currentHour + 1) % 24;
    const times = [];
    for (let i = 0; i < 4; i++) {
      const hour = (startHour + i * 4) % 24;
      times.push(hour);
    }

    const cronSchedule = `0 ${times.join(',')} * * *`;
    const totalDoses = 12; // 3 天 × 4 次

    console.log(`   Cron: ${cronSchedule}`);
    console.log(`   時間: ${times.map(h => `${h}:00`).join(', ')}`);
    console.log(`   總次數: ${totalDoses}`);
    console.log(`   建立時間: ${now.toLocaleString('zh-TW')}\n`);

    const { data: reminder, error: reminderError } = await supabase
      .from('medication_reminders')
      .insert([{
        medication_id: medicationId,
        elder_id: elderId,
        cron_schedule: cronSchedule,
        timezone: 'Asia/Taipei',
        reminder_times: {
          times: times.map(h => `${h.toString().padStart(2, '0')}:00`),
          durationType: 'shortterm'
        },
        is_short_term: true,
        total_doses: totalDoses,
        doses_completed: 0,
        start_date: now.toISOString().split('T')[0],
        is_enabled: true,
      }])
      .select()
      .single();

    if (reminderError) {
      console.error('❌ 建立提醒失敗:', reminderError.message);
      return;
    }

    console.log(`✅ 提醒建立成功 (ID: ${reminder.id})\n`);

    // 3. 產生記錄
    console.log('📋 步驟 3: 產生短期用藥記錄...\n');

    const logsResult = await generateShortTermMedicationLogs({
      reminderId: reminder.id,
      medicationId: medicationId,
      elderId: elderId,
      medicationName: medicationName,
      cronSchedule: cronSchedule,
      totalDoses: totalDoses,
      startDate: now.toISOString().split('T')[0],
      timezone: 'Asia/Taipei'
    });

    if (!logsResult.success) {
      console.error('❌ 產生記錄失敗:', logsResult.error);
      return;
    }

    console.log(`✅ 成功產生 ${logsResult.count} 筆記錄\n`);

    // 4. 驗證記錄
    console.log('📋 步驟 4: 驗證產生的記錄...\n');

    const { data: logs, error: logsError } = await supabase
      .from('medication_logs')
      .select('dose_sequence, dose_label, scheduled_time, status')
      .eq('medication_reminder_id', reminder.id)
      .order('dose_sequence', { ascending: true });

    if (logsError) {
      console.error('❌ 查詢記錄失敗:', logsError.message);
      return;
    }

    console.log(`✅ 總共 ${logs.length} 筆記錄\n`);

    // 5. 檢查時間過濾
    console.log('📋 步驟 5: 檢查時間過濾...\n');

    let timeFilterOK = true;
    for (const log of logs) {
      const scheduledTime = new Date(log.scheduled_time);
      if (scheduledTime <= now) {
        console.error(`❌ 發現早於建立時間的記錄: ${log.dose_label} - ${scheduledTime.toLocaleString('zh-TW')}`);
        timeFilterOK = false;
      }
    }

    if (timeFilterOK) {
      console.log('✅ 時間過濾正確：所有記錄都在建立時間之後\n');
    } else {
      console.log('❌ 時間過濾有問題\n');
    }

    // 6. 檢查序號連續性
    console.log('📋 步驟 6: 檢查序號連續性...\n');

    let sequenceOK = true;
    for (let i = 0; i < logs.length; i++) {
      const expectedSequence = i + 1;
      const expectedLabel = `${medicationName}-${expectedSequence}`;

      if (logs[i].dose_sequence !== expectedSequence) {
        console.error(`❌ 序號錯誤: 期望 ${expectedSequence}, 實際 ${logs[i].dose_sequence}`);
        sequenceOK = false;
      }

      if (logs[i].dose_label !== expectedLabel) {
        console.error(`❌ 標籤錯誤: 期望 ${expectedLabel}, 實際 ${logs[i].dose_label}`);
        sequenceOK = false;
      }
    }

    if (sequenceOK) {
      console.log('✅ 序號連續性正確\n');
    } else {
      console.log('❌ 序號有問題\n');
    }

    // 7. 顯示前 5 筆記錄
    console.log('📋 步驟 7: 顯示前 5 筆記錄...\n');

    logs.slice(0, 5).forEach(log => {
      const time = new Date(log.scheduled_time).toLocaleString('zh-TW');
      console.log(`   [${log.dose_sequence}] ${log.dose_label} - ${time} (${log.status})`);
    });

    console.log('\n========================================');
    console.log('✅ 測試完成！');
    console.log('========================================\n');

    // 8. 清理測試資料
    console.log('🧹 清理測試資料...\n');

    await supabase
      .from('medication_logs')
      .delete()
      .eq('medication_reminder_id', reminder.id);

    await supabase
      .from('medication_reminders')
      .delete()
      .eq('id', reminder.id);

    console.log('✅ 清理完成\n');

  } catch (error) {
    console.error('\n❌ 測試過程發生錯誤:', error);
  }
}

// 執行測試
testShortTermIntegration();
