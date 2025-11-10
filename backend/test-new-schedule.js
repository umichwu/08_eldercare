/**
 * 測試新的智能排程系統
 *
 * 測試內容：
 * 1. 一日三次 - 方案 1 (08:00, 12:00, 17:00)
 * 2. 一日三次 - 方案 2 (09:00, 13:00, 18:00)
 * 3. 一日四次 - 方案 1 (08:00, 12:00, 17:00, 21:00)
 * 4. 自訂時間 (08:30, 13:30, 19:00)
 * 5. 驗證沒有凌晨時段
 * 6. 驗證 3 天預覽顯示完整
 */

const API_BASE = 'http://localhost:3000/api';
const elderId = 'fe50db48-6d33-4777-803b-8b335625c9c2';

console.log('🧪 測試新的智能排程系統');
console.log('='.repeat(70));

async function testScheduleScenario(name, params) {
  console.log(`\n📋 測試場景: ${name}`);
  console.log('-'.repeat(70));

  try {
    // 建立藥物
    const medRes = await fetch(`${API_BASE}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId,
        medicationName: `測試藥物 - ${name}`,
        dosage: '1顆',
        medicationType: 'shortterm'
      })
    });
    const medData = await medRes.json();
    const medicationId = medData.data.id;

    // 建立智能排程
    const remRes = await fetch(`${API_BASE}/medication-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicationId,
        elderId,
        useSmartSchedule: true,
        ...params
      })
    });
    const remData = await remRes.json();

    if (!remData.data) {
      console.error('❌ 失敗:', remData.error || remData.message);
      return null;
    }

    const reminderId = remData.data.id;

    // 取得 3 天預覽
    const previewRes = await fetch(`${API_BASE}/medication-reminders/${reminderId}/schedule-preview?days=3`);
    const previewData = await previewRes.json();

    if (!previewData.data) {
      console.error('❌ 預覽失敗:', previewData.error || previewData.message);
      return null;
    }

    // 顯示結果
    console.log(`✅ 藥物建立: ${medicationId}`);
    console.log(`✅ 提醒建立: ${reminderId}`);
    console.log(`📅 Cron: ${previewData.data.reminder.cronSchedule}`);
    console.log(`\n📆 3 天用藥計畫:`);

    previewData.data.preview.forEach((day, idx) => {
      console.log(`\n  ${day.dayOfWeek} (${day.date}):`);
      day.schedules.forEach(schedule => {
        const statusIcon = schedule.status === 'passed' ? '⏸️' : '📋';
        console.log(`     ${statusIcon} ${schedule.time} - ${schedule.label}`);
      });
    });

    // 驗證
    console.log(`\n✨ 驗證結果:`);

    // 檢查天數
    if (previewData.data.totalDays === 3) {
      console.log(`  ✅ 顯示 3 天計畫`);
    } else {
      console.log(`  ❌ 天數錯誤: ${previewData.data.totalDays}`);
    }

    // 檢查凌晨時段
    let hasMidnight = false;
    previewData.data.preview.forEach(day => {
      day.schedules.forEach(schedule => {
        const hour = parseInt(schedule.time.split(':')[0]);
        if (hour >= 0 && hour < 6) {
          hasMidnight = true;
          console.log(`  ❌ 發現凌晨時段: ${schedule.time}`);
        }
      });
    });

    if (!hasMidnight) {
      console.log(`  ✅ 沒有凌晨時段 (00:00-06:00)`);
    }

    return reminderId;

  } catch (error) {
    console.error('❌ 測試錯誤:', error.message);
    return null;
  }
}

async function runAllTests() {
  console.log('\n\n');

  // 測試 1: 一日三次 - 方案 1
  await testScheduleScenario('一日三次 - 方案 1', {
    dosesPerDay: 3,
    timingPlan: 'plan1',
    treatmentDays: 3
  });

  console.log('\n\n');

  // 測試 2: 一日三次 - 方案 2
  await testScheduleScenario('一日三次 - 方案 2', {
    dosesPerDay: 3,
    timingPlan: 'plan2',
    treatmentDays: 3
  });

  console.log('\n\n');

  // 測試 3: 一日四次 - 方案 1
  await testScheduleScenario('一日四次 - 方案 1', {
    dosesPerDay: 4,
    timingPlan: 'plan1',
    treatmentDays: 3
  });

  console.log('\n\n');

  // 測試 4: 自訂時間
  await testScheduleScenario('自訂時間', {
    dosesPerDay: 3,
    timingPlan: 'custom',
    customTimes: ['08:30', '13:30', '19:00'],
    treatmentDays: 3
  });

  console.log('\n\n');
  console.log('='.repeat(70));
  console.log('🎉 所有測試完成！');
  console.log('='.repeat(70));
}

runAllTests();
