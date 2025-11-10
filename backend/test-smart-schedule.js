/**
 * 測試智能排程功能
 *
 * 場景：今天 21:04 設定感冒藥，每日 3 次，療程 3 天
 * 期望：避開半夜時段，明天從早餐開始
 */

const API_BASE = 'http://localhost:3000/api';
const elderId = 'fe50db48-6d33-4777-803b-8b335625c9c2';

// 今天 21:04
const now = new Date();
now.setHours(21, 4, 0, 0);

console.log('🧪 測試智能排程功能');
console.log('='.repeat(60));
console.log(`📅 首次用藥時間: ${now.toLocaleString('zh-TW')}`);
console.log(`💊 每日次數: 3 次`);
console.log(`📆 療程天數: 3 天`);
console.log('='.repeat(60));
console.log('');

async function testSmartSchedule() {
  try {
    // 步驟 1: 建立藥物
    console.log('步驟 1: 建立感冒藥...');
    const medicationRes = await fetch(`${API_BASE}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId: elderId,
        medicationName: '智能排程測試感冒藥',
        dosage: '1顆',
        medicationType: 'shortterm',
        purpose: '測試智能排程功能'
      })
    });

    if (!medicationRes.ok) {
      throw new Error(`建立藥物失敗: ${medicationRes.status}`);
    }

    const medicationData = await medicationRes.json();
    const medicationId = medicationData.data.id;
    console.log(`✅ 藥物建立成功 (ID: ${medicationId})`);
    console.log('');

    // 步驟 2: 使用智能排程建立提醒
    console.log('步驟 2: 使用智能排程建立提醒...');
    const reminderRes = await fetch(`${API_BASE}/medication-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicationId: medicationId,
        elderId: elderId,
        useSmartSchedule: true, // 🔑 關鍵參數
        firstDoseDateTime: now.toISOString(),
        dosesPerDay: 3,
        treatmentDays: 3,
        isAntibiotic: false,
        timezone: 'Asia/Taipei'
      })
    });

    if (!reminderRes.ok) {
      const errorData = await reminderRes.json();
      throw new Error(`建立提醒失敗: ${JSON.stringify(errorData)}`);
    }

    const reminderData = await reminderRes.json();
    console.log(`✅ 智能排程建立成功`);
    console.log('');

    // 步驟 3: 查看生成的排程
    console.log('步驟 3: 查看生成的排程...');
    console.log('='.repeat(60));
    console.log(`📋 Cron 表達式: ${reminderData.data.cron_schedule}`);
    console.log(`⏰ 時區: ${reminderData.data.timezone}`);
    console.log('');

    const times = reminderData.data.reminder_times.times || [];
    console.log(`📅 用藥時間表 (共 ${times.length} 次):`);
    times.forEach((time, index) => {
      console.log(`   ${index + 1}. ${time}`);
    });

    if (reminderData.data.reminder_times.schedules) {
      console.log('');
      console.log('📆 詳細排程:');
      const schedules = reminderData.data.reminder_times.schedules;
      let currentDay = null;

      schedules.forEach((schedule, index) => {
        const date = new Date(schedule.dateTime);
        const day = date.toISOString().split('T')[0];

        if (day !== currentDay) {
          console.log('');
          console.log(`Day ${schedule.day} (${date.toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' })}):`);
          currentDay = day;
        }

        const time = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
        const marker = schedule.isFirstDose ? '🔵 (首次)' : '⭕';
        console.log(`   ${marker} ${time} - ${schedule.label}`);
      });
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('');

    // 驗證結果
    console.log('✨ 驗證結果:');

    const hasNightTime = times.some(time => {
      const hour = parseInt(time.split(':')[0]);
      return hour >= 0 && hour < 6;
    });

    if (hasNightTime) {
      console.log('❌ 失敗：排程包含半夜時段 (00:00 - 06:00)');
    } else {
      console.log('✅ 成功：沒有半夜時段');
    }

    const firstTime = times[0];
    const firstHour = parseInt(firstTime.split(':')[0]);
    if (firstHour === 21) {
      console.log('✅ 成功：第一次用藥在 21:04 (今晚)');
    }

    const hasBreakfast = times.some(time => time.startsWith('08:'));
    const hasLunch = times.some(time => time.startsWith('12:'));
    const hasDinner = times.some(time => time.startsWith('18:'));

    if (hasBreakfast && hasLunch && hasDinner) {
      console.log('✅ 成功：包含早中晚三個時段');
    }

    console.log('');
    console.log('🎉 智能排程測試完成！');

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

// 執行測試
testSmartSchedule();
