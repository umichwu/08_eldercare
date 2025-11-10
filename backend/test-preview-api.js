/**
 * 測試預覽 API
 *
 * 測試內容：
 * 1. 預覽 API (POST /api/medication-reminders/preview)
 * 2. 驗證回傳 3 天完整計畫
 * 3. 驗證沒有凌晨時段
 * 4. 測試不同的時段方案
 */

const API_BASE = 'http://localhost:3000/api';

console.log('🧪 測試預覽 API');
console.log('='.repeat(70));

async function testPreviewAPI(testName, params) {
  console.log(`\n📋 測試場景: ${testName}`);
  console.log('-'.repeat(70));

  try {
    const response = await fetch(`${API_BASE}/medication-reminders/preview?days=3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ 失敗:', result.error || result.message);
      return null;
    }

    const { preview, totalDays, cronSchedule, reminderTimes, scheduleDetails } = result.data;

    console.log(`✅ 預覽生成成功`);
    console.log(`📅 Cron: ${cronSchedule}`);
    console.log(`⏰ 提醒時間: ${reminderTimes.join(', ')}`);
    console.log(`\n📆 ${totalDays} 天用藥計畫:`);

    preview.forEach((day, idx) => {
      console.log(`\n  ${day.dayOfWeek} (${day.date}):`);
      day.schedules.forEach(schedule => {
        const statusIcon = schedule.status === 'passed' ? '⏸️' : '📋';
        console.log(`     ${statusIcon} ${schedule.time} - ${schedule.label}`);
      });
    });

    // 驗證
    console.log(`\n✨ 驗證結果:`);

    // 檢查天數
    if (totalDays === 3) {
      console.log(`  ✅ 顯示 3 天計畫`);
    } else {
      console.log(`  ❌ 天數錯誤: ${totalDays}`);
    }

    // 檢查凌晨時段
    let hasMidnight = false;
    preview.forEach(day => {
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

    // 檢查提醒時間數量
    const expectedTimes = params.dosesPerDay || 3;
    if (reminderTimes.length === expectedTimes) {
      console.log(`  ✅ 提醒時間數量正確: ${expectedTimes} 次`);
    } else {
      console.log(`  ❌ 提醒時間數量錯誤: 預期 ${expectedTimes}, 實際 ${reminderTimes.length}`);
    }

    return result.data;

  } catch (error) {
    console.error('❌ 測試錯誤:', error.message);
    return null;
  }
}

async function runAllTests() {
  console.log('\n\n');

  // 測試 1: 一日三次 - 方案 1
  await testPreviewAPI('一日三次 - 方案 1', {
    dosesPerDay: 3,
    timingPlan: 'plan1',
    treatmentDays: 3,
    startDate: new Date().toISOString().split('T')[0],
    medicationName: '測試藥物 A'
  });

  console.log('\n\n');

  // 測試 2: 一日三次 - 方案 2
  await testPreviewAPI('一日三次 - 方案 2', {
    dosesPerDay: 3,
    timingPlan: 'plan2',
    treatmentDays: 3,
    startDate: new Date().toISOString().split('T')[0],
    medicationName: '測試藥物 B'
  });

  console.log('\n\n');

  // 測試 3: 一日四次 - 方案 1
  await testPreviewAPI('一日四次 - 方案 1', {
    dosesPerDay: 4,
    timingPlan: 'plan1',
    treatmentDays: 3,
    startDate: new Date().toISOString().split('T')[0],
    medicationName: '測試藥物 C'
  });

  console.log('\n\n');

  // 測試 4: 自訂時間
  await testPreviewAPI('自訂時間', {
    dosesPerDay: 3,
    timingPlan: 'custom',
    customTimes: ['08:30', '13:30', '19:00'],
    treatmentDays: 3,
    startDate: new Date().toISOString().split('T')[0],
    medicationName: '測試藥物 D'
  });

  console.log('\n\n');

  // 測試 5: 明天開始
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await testPreviewAPI('明天開始 - 一日三次', {
    dosesPerDay: 3,
    timingPlan: 'plan1',
    treatmentDays: 3,
    startDate: tomorrow.toISOString().split('T')[0],
    medicationName: '測試藥物 E'
  });

  console.log('\n\n');
  console.log('='.repeat(70));
  console.log('🎉 所有測試完成！');
  console.log('='.repeat(70));
}

runAllTests();
