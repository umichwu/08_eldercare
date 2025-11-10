const API_BASE = 'http://localhost:3000/api';
const elderId = 'fe50db48-6d33-4777-803b-8b335625c9c2';

// 今天 10:13am
const now = new Date();
now.setHours(10, 13, 0, 0);

console.log('🧪 測試 10:13am 設定用藥');
console.log('='.repeat(60));
console.log('📅 首次用藥時間:', now.toLocaleString('zh-TW'));
console.log('💊 每日次數: 3 次');
console.log('📆 療程天數: 3 天');
console.log('='.repeat(60));

async function test() {
  try {
    // 建立藥物
    const medRes = await fetch(`${API_BASE}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId,
        medicationName: '10:13 測試藥物',
        dosage: '1顆',
        medicationType: 'shortterm'
      })
    });
    const medData = await medRes.json();
    console.log('✅ 藥物建立成功');

    // 建立智能排程
    const remRes = await fetch(`${API_BASE}/medication-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicationId: medData.data.id,
        elderId,
        useSmartSchedule: true,
        firstDoseDateTime: now.toISOString(),
        dosesPerDay: 3,
        treatmentDays: 3
      })
    });
    const remData = await remRes.json();

    console.log('');
    console.log('📅 生成的排程:');
    console.log('='.repeat(60));

    const schedules = remData.data.reminder_times.schedules;
    let currentDay = null;

    schedules.forEach(s => {
      const date = new Date(s.dateTime);
      const day = date.toISOString().split('T')[0];

      if (day !== currentDay) {
        console.log('');
        console.log(date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' }) + ':');
        currentDay = day;
      }

      const time = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
      const marker = s.isFirstDose ? '🔵 (首次)' : '⭕';
      console.log('   ' + marker + ' ' + time + ' - ' + s.label);
    });

    console.log('');
    console.log('='.repeat(60));
    console.log('');
    console.log('✨ 驗證:');

    // 檢查是否有凌晨時段
    const hasMidnight = schedules.some(s => {
      const hour = new Date(s.dateTime).getHours();
      return hour >= 0 && hour < 6;
    });

    if (hasMidnight) {
      console.log('❌ 失敗：包含凌晨時段');
    } else {
      console.log('✅ 成功：沒有凌晨時段');
    }

    // 檢查是否包含今天上午10:13之前的時段
    const hasPastTime = schedules.some(s => {
      const scheduleTime = new Date(s.dateTime);
      return scheduleTime < now;
    });

    if (hasPastTime) {
      console.log('❌ 失敗：包含已過去的時段');
      schedules.forEach(s => {
        const scheduleTime = new Date(s.dateTime);
        if (scheduleTime < now) {
          console.log('   ⚠️ ', scheduleTime.toLocaleString('zh-TW'));
        }
      });
    } else {
      console.log('✅ 成功：沒有已過去的時段');
    }

    console.log('✅ 成功：首次用藥在 10:13');

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

test();
