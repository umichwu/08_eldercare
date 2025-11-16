/**
 * 診斷助眠藥的用藥記錄問題
 *
 * 檢查：
 * 1. medication_reminders 中是否有助眠藥
 * 2. medications 資料是否正確
 * 3. 今天的 medication_logs 是否有建立
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 讀取 .env 檔案
const envContent = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const sb = createClient(
  envVars.SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  console.log('🔍 開始診斷助眠藥問題...\n');

  try {
    // 1. 檢查所有藥物
    console.log('📋 步驟 1: 檢查所有藥物');
    const { data: medications, error: medError } = await sb
      .from('medications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (medError) {
      console.error('❌ 查詢藥物失敗:', medError.message);
      return;
    }

    console.log(`   找到 ${medications.length} 個藥物:\n`);
    medications.forEach(med => {
      console.log(`   - ${med.medication_name} (ID: ${med.id})`);
      console.log(`     狀態: ${med.status}`);
      console.log(`     建立時間: ${med.created_at}`);
      console.log('');
    });

    // 找出助眠藥
    const sleepMed = medications.find(m => m.medication_name.includes('助眠'));
    if (!sleepMed) {
      console.log('⚠️  沒有找到助眠藥！');
      return;
    }

    console.log(`✅ 找到助眠藥: ${sleepMed.medication_name} (ID: ${sleepMed.id})\n`);

    // 2. 檢查用藥提醒
    console.log('📋 步驟 2: 檢查用藥提醒設定');
    const { data: reminders, error: reminderError } = await sb
      .from('medication_reminders')
      .select(`
        *,
        medications (*)
      `)
      .eq('medication_id', sleepMed.id);

    if (reminderError) {
      console.error('❌ 查詢提醒失敗:', reminderError.message);
      return;
    }

    if (reminders.length === 0) {
      console.log('❌ 沒有找到助眠藥的提醒設定！');
      console.log('   這就是問題所在：藥物存在，但沒有設定提醒時間');
      return;
    }

    console.log(`   找到 ${reminders.length} 個提醒:\n`);
    reminders.forEach(reminder => {
      console.log(`   - 提醒 ID: ${reminder.id}`);
      console.log(`     Elder ID: ${reminder.elder_id}`);
      console.log(`     是否啟用: ${reminder.is_enabled}`);
      console.log(`     時間設定: ${reminder.time_settings}`);
      console.log(`     Cron 表達式: ${reminder.cron_expression}`);
      console.log('');
    });

    // 3. 檢查今天的用藥記錄
    console.log('📋 步驟 3: 檢查今天的用藥記錄');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`   今天: ${today.toISOString()}`);
    console.log(`   明天: ${tomorrow.toISOString()}\n`);

    const { data: logs, error: logError } = await sb
      .from('medication_logs')
      .select('*')
      .eq('medication_id', sleepMed.id)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', tomorrow.toISOString())
      .order('scheduled_time');

    if (logError) {
      console.error('❌ 查詢記錄失敗:', logError.message);
      return;
    }

    if (logs.length === 0) {
      console.log('❌ 今天沒有助眠藥的用藥記錄！');
      console.log('   這就是問題：提醒設定存在，但沒有生成記錄\n');

      // 檢查是否有任何記錄（歷史記錄）
      const { data: allLogs } = await sb
        .from('medication_logs')
        .select('*')
        .eq('medication_id', sleepMed.id)
        .order('scheduled_time', { ascending: false })
        .limit(5);

      if (allLogs && allLogs.length > 0) {
        console.log('   ℹ️  但是有歷史記錄:');
        allLogs.forEach(log => {
          console.log(`   - ${log.scheduled_time} (狀態: ${log.status})`);
        });
      } else {
        console.log('   ⚠️  完全沒有任何記錄（包括歷史記錄）');
      }
    } else {
      console.log(`✅ 今天有 ${logs.length} 筆記錄:\n`);
      logs.forEach(log => {
        console.log(`   - 時間: ${log.scheduled_time}`);
        console.log(`     狀態: ${log.status}`);
        console.log(`     Elder ID: ${log.elder_id}`);
        console.log('');
      });
    }

    // 4. 測試手動生成今日記錄
    console.log('\n📋 步驟 4: 測試手動生成今日記錄');
    console.log('   提示：如果上面沒有記錄，可以呼叫 POST /api/scheduler/generate-today-logs');
    console.log('   或者使用腳本: node test-generate-today.js');

  } catch (error) {
    console.error('❌ 診斷過程發生錯誤:', error);
  }
}

diagnose();
