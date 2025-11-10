/**
 * 測試早上設定排程的情況
 *
 * 假設現在是早上 10:13，設定用藥排程
 * 應該跳過今天的 08:00（已過去）
 * 從今天的 12:00 開始
 */

import { generateShortTermSchedule } from './services/smartScheduleService.js';

console.log('='.repeat(60));
console.log('🧪 測試早上 10:13 設定排程');
console.log('='.repeat(60));
console.log('');

// 模擬早上 10:13 的情況
const mockNow = new Date('2025-11-10T10:13:00+08:00');
console.log(`假設當前時間: ${mockNow.toLocaleString('zh-TW')}`);
console.log('');

// 臨時替換 Date 以進行測試
const OriginalDate = Date;
global.Date = class extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(mockNow);
    } else {
      super(...args);
    }
  }

  static now() {
    return mockNow.getTime();
  }
};

const schedules = generateShortTermSchedule({
  dosesPerDay: 3,
  timingPlan: 'plan1', // 08:00, 12:00, 17:00
  treatmentDays: 3,
  startDate: new Date('2025-11-10') // 今天
});

// 恢復原始 Date
global.Date = OriginalDate;

console.log(`生成 ${schedules.length} 個用藥時間點：`);
console.log('');

schedules.forEach((schedule, index) => {
  const dateStr = schedule.dateTime.toLocaleString('zh-TW');
  const isPast = schedule.dateTime < mockNow;
  const status = isPast ? '❌ 已過去（不應該出現）' : '✅ 未來';
  const firstDoseMarker = schedule.isFirstDose ? ' 🔹 首次' : '';

  console.log(`${index + 1}. ${dateStr} - ${schedule.label}${firstDoseMarker} ${status}`);
});

console.log('');
console.log('='.repeat(60));

// 驗證結果
const todaySchedules = schedules.filter(s => {
  const scheduleDate = new Date(s.dateTime);
  return scheduleDate.toISOString().split('T')[0] === '2025-11-10';
});

console.log(`今天 (11/10) 的排程數量: ${todaySchedules.length}`);
console.log('預期: 2 個 (12:00 和 17:00，跳過 08:00)');
console.log('');

if (todaySchedules.length === 2) {
  console.log('✅ 正確！今天只有 12:00 和 17:00');
} else if (todaySchedules.length === 3) {
  console.log('❌ 錯誤！包含了已過去的 08:00');
} else {
  console.log(`❓ 未預期的數量: ${todaySchedules.length}`);
}

console.log('');

// 檢查首次用藥是否是今天 12:00
const firstDose = schedules.find(s => s.isFirstDose);
if (firstDose) {
  const firstTime = firstDose.dateTime.toLocaleString('zh-TW');
  console.log(`首次用藥: ${firstTime}`);

  if (firstTime.includes('11/10') && firstTime.includes('12:00')) {
    console.log('✅ 正確！首次用藥是今天 12:00');
  } else {
    console.log('❌ 首次用藥時間不正確');
  }
}

console.log('');
console.log('='.repeat(60));
