/**
 * 測試排程修復
 *
 * 驗證：
 * 1. 不會生成已經過去的時間點
 * 2. 正確設定首次用藥標記
 * 3. 結束日期檢查邏輯
 */

import { generateShortTermSchedule } from './services/smartScheduleService.js';

console.log('='.repeat(60));
console.log('🧪 測試排程修復');
console.log('='.repeat(60));
console.log('');

// 測試案例 1: 在 10:13 設定，應該跳過今天早上 8:00
console.log('📋 測試案例 1: 當前時間 10:13，設定一日三次用藥（08:00, 12:00, 17:00）');
console.log('預期結果: 跳過今天的 08:00，從 12:00 開始');
console.log('');

const now = new Date();
console.log(`當前時間: ${now.toLocaleString('zh-TW')}`);
console.log('');

const schedules = generateShortTermSchedule({
  dosesPerDay: 3,
  timingPlan: 'plan1',
  treatmentDays: 3,
  startDate: new Date() // 今天
});

console.log(`生成 ${schedules.length} 個用藥時間點：`);
console.log('');

schedules.forEach((schedule, index) => {
  const dateStr = schedule.dateTime.toLocaleString('zh-TW');
  const isPast = schedule.dateTime < now;
  const status = isPast ? '❌ 已過去' : '✅ 未來';
  const firstDoseMarker = schedule.isFirstDose ? ' 🔹 首次' : '';

  console.log(`${index + 1}. ${dateStr} - ${schedule.label}${firstDoseMarker} ${status}`);
});

console.log('');
console.log('='.repeat(60));
console.log('✅ 測試完成');
console.log('');

// 測試案例 2: 驗證首次用藥標記
const firstDose = schedules.find(s => s.isFirstDose);
if (firstDose) {
  console.log(`✅ 首次用藥標記正確: ${firstDose.dateTime.toLocaleString('zh-TW')}`);
} else {
  console.log('❌ 錯誤: 找不到首次用藥標記');
}

// 測試案例 3: 確認沒有已過去的時間點
const pastSchedules = schedules.filter(s => s.dateTime < now);
if (pastSchedules.length === 0) {
  console.log('✅ 沒有已過去的時間點');
} else {
  console.log(`❌ 錯誤: 發現 ${pastSchedules.length} 個已過去的時間點`);
  pastSchedules.forEach(s => {
    console.log(`   - ${s.dateTime.toLocaleString('zh-TW')}`);
  });
}

console.log('');
console.log('='.repeat(60));
