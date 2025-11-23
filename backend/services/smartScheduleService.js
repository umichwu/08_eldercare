/**
 * Smart Schedule Service - 智能用藥排程服務
 *
 * 功能：
 * - 使用預設時段方案，避開凌晨時段（00:00 - 06:00）
 * - 支援一日 2/3/4 次用藥
 * - 支援自訂時間
 */

/**
 * 預設時段方案
 */
export const TIMING_PRESETS = {
  // 一日三次
  three_times: {
    plan1: ['08:00', '12:00', '17:00'],
    plan2: ['09:00', '13:00', '18:00']
  },
  // 一日四次
  four_times: {
    plan1: ['08:00', '12:00', '17:00', '21:00'],
    plan2: ['09:00', '13:00', '18:00', '22:00']
  },
  // 一日兩次
  two_times: {
    plan1: ['08:00', '18:00'],
    plan2: ['09:00', '19:00']
  }
};

/**
 * 時段標籤對應
 */
const TIME_LABELS = {
  '08:00': '早餐後',
  '09:00': '早餐後',
  '12:00': '午餐後',
  '13:00': '午餐後',
  '17:00': '晚餐後',
  '18:00': '晚餐後',
  '19:00': '晚餐後',
  '21:00': '睡前',
  '22:00': '睡前'
};

/**
 * 根據時間取得標籤
 */
function getTimeLabel(timeString) {
  return TIME_LABELS[timeString] || '用藥時間';
}

/**
 * 生成短期用藥排程（使用預設時段或自訂時間）
 *
 * @param {Object} params - 參數
 * @param {number} params.dosesPerDay - 每日次數 (2, 3, 或 4)
 * @param {string} params.timingPlan - 時段方案 ('plan1', 'plan2', 或 'custom')
 * @param {Array<string>} params.customTimes - 自訂時間陣列 (如果 timingPlan === 'custom')
 * @param {number} params.treatmentDays - 療程天數
 * @param {string|Date} params.startDate - 開始日期（預設今天）
 * @param {number} params.totalDoses - 總劑量（可選，如果提供則產生到滿足此數量）
 * @returns {Array} - 排程陣列
 */
export function generateShortTermSchedule({
  dosesPerDay,
  timingPlan = 'plan1',
  customTimes = null,
  treatmentDays,
  startDate = new Date(),
  totalDoses = null
}) {
  const schedules = [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0); // 設定為當天 00:00

  // 決定使用哪個時間方案
  let dailyTimes = [];

  if (timingPlan === 'custom' && customTimes && customTimes.length > 0) {
    // 使用自訂時間
    dailyTimes = customTimes;
  } else {
    // 使用預設方案
    const frequencyKey = dosesPerDay === 2 ? 'two_times'
                       : dosesPerDay === 3 ? 'three_times'
                       : dosesPerDay === 4 ? 'four_times'
                       : 'three_times'; // 預設三次

    const plan = timingPlan === 'plan2' ? 'plan2' : 'plan1';
    dailyTimes = TIMING_PRESETS[frequencyKey][plan];
  }

  // 驗證時間格式並排序
  dailyTimes = dailyTimes
    .filter(time => /^\d{2}:\d{2}$/.test(time))
    .sort();

  // 生成每天的用藥時間
  let isFirstDoseSet = false; // 追蹤是否已設定首次用藥

  // ✅ 決定要產生多少天：如果有 totalDoses，則產生到滿足為止
  const maxDays = totalDoses ? Math.ceil(totalDoses / dailyTimes.length) + 1 : treatmentDays;

  for (let day = 0; day < maxDays; day++) {
    const currentDate = new Date(start);
    currentDate.setDate(currentDate.getDate() + day);

    for (let timeIndex = 0; timeIndex < dailyTimes.length; timeIndex++) {
      // ✅ 如果有 totalDoses 限制，且已達到數量，則停止
      if (totalDoses && schedules.length >= totalDoses) {
        break;
      }

      const time = dailyTimes[timeIndex];
      const [hour, minute] = time.split(':').map(Number);

      const scheduleDate = new Date(currentDate);
      scheduleDate.setHours(hour, minute, 0, 0);

      // ✅ 移除時間過濾：短期用藥應該產生所有排程的記錄
      // 即使某些時間已經過去，也應該記錄下來（狀態會在後續標記為 missed）

      const isFirstDose = !isFirstDoseSet;
      if (isFirstDose) {
        isFirstDoseSet = true;
      }

      schedules.push({
        dateTime: scheduleDate,
        time: time,
        label: isFirstDose ? `${getTimeLabel(time)} (首次)` : getTimeLabel(time),
        timeSlot: time,
        day: day + 1,
        isFirstDose: isFirstDose
      });
    }

    // ✅ 如果已達到 totalDoses，跳出外層迴圈
    if (totalDoses && schedules.length >= totalDoses) {
      break;
    }
  }

  // 按時間排序
  schedules.sort((a, b) => a.dateTime - b.dateTime);

  return schedules;
}

/**
 * 生成抗生素排程（嚴格每 N 小時）
 *
 * 抗生素需要嚴格間隔，不能用「餐後」的概念
 *
 * @param {Object} params - 參數
 * @param {string|Date} params.firstDoseDateTime - 首次用藥時間
 * @param {number} params.dosesPerDay - 每日次數
 * @param {number} params.treatmentDays - 療程天數
 * @returns {Array} - 排程陣列
 */
export function generateAntibioticSchedule({
  firstDoseDateTime,
  dosesPerDay,
  treatmentDays
}) {
  const schedules = [];
  const firstDose = new Date(firstDoseDateTime);

  // 計算間隔小時數
  const intervalHours = 24 / dosesPerDay;

  const totalDoses = treatmentDays * dosesPerDay;

  for (let i = 0; i < totalDoses; i++) {
    const scheduleDate = new Date(firstDose);
    scheduleDate.setHours(scheduleDate.getHours() + (i * intervalHours));

    const day = Math.floor(i / dosesPerDay) + 1;
    const time = `${scheduleDate.getHours().toString().padStart(2, '0')}:${scheduleDate.getMinutes().toString().padStart(2, '0')}`;

    schedules.push({
      dateTime: scheduleDate,
      time: time,
      label: `每 ${intervalHours} 小時`,
      timeSlot: 'antibiotic',
      day: day,
      isFirstDose: i === 0
    });
  }

  return schedules;
}

/**
 * 生成長期用藥排程（慢性病）
 *
 * @param {Object} params - 參數
 * @param {Array<string>} params.times - 用藥時間陣列，例如 ['08:00', '20:00']
 * @param {Date} params.startDate - 開始日期
 * @param {Date} params.endDate - 結束日期（可選）
 * @returns {Object} - Cron 排程資訊
 */
export function generateLongTermSchedule({
  times,
  startDate,
  endDate = null
}) {
  // 解析時間
  const parsedTimes = times.map(time => {
    const [hour, minute] = time.split(':').map(Number);
    return { hour, minute };
  });

  // 生成 cron 表達式
  const minutes = [...new Set(parsedTimes.map(t => t.minute))].join(',');
  const hours = [...new Set(parsedTimes.map(t => t.hour))].join(',');
  const cronSchedule = `${minutes} ${hours} * * *`;

  return {
    cronSchedule,
    times: parsedTimes,
    startDate,
    endDate,
    type: 'longterm'
  };
}

/**
 * 將排程轉換為 Cron 表達式
 *
 * @param {Array} schedules - 排程陣列
 * @param {string} timezone - 時區
 * @returns {Object} - Cron 排程資訊
 */
export function schedulesToCron(schedules, timezone = 'Asia/Taipei') {
  // 提取所有獨特的時間點
  const uniqueTimes = new Map();

  for (const schedule of schedules) {
    const timeKey = schedule.time;

    if (!uniqueTimes.has(timeKey)) {
      const [hour, minute] = schedule.time.split(':').map(Number);
      uniqueTimes.set(timeKey, { hour, minute });
    }
  }

  const times = Array.from(uniqueTimes.values());

  // 按時間排序
  times.sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
  });

  // 生成 cron 表達式
  const minutes = [...new Set(times.map(t => t.minute))].join(',');
  const hours = [...new Set(times.map(t => t.hour))].join(',');
  const cronSchedule = `${minutes} ${hours} * * *`;

  return {
    cronSchedule,
    timezone,
    reminderTimes: {
      times: times.map(t => `${t.hour.toString().padStart(2, '0')}:${t.minute.toString().padStart(2, '0')}`),
      schedules: schedules
    }
  };
}

/**
 * 預覽未來 N 天的用藥時間表
 *
 * @param {Array} schedules - 排程陣列
 * @param {number} days - 天數 (預設 3)
 * @param {boolean} includeAll - 是否包含已過時段（預設 true）
 * @returns {Array} - 分組的用藥時間表
 */
export function previewSchedule(schedules, days = 3, includeAll = true) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0); // 從今天 00:00 開始

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  // 過濾指定天數範圍的排程
  let upcomingSchedules;

  if (includeAll) {
    // 顯示完整 N 天（包含已過時段）
    upcomingSchedules = schedules.filter(s =>
      s.dateTime >= startDate && s.dateTime < endDate
    );
  } else {
    // 只顯示未來的時段
    upcomingSchedules = schedules.filter(s =>
      s.dateTime >= now && s.dateTime < endDate
    );
  }

  // 按日期分組
  const groupedByDate = {};

  for (const schedule of upcomingSchedules) {
    const dateKey = schedule.dateTime.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = {
        date: dateKey,
        dayOfWeek: schedule.dateTime.toLocaleDateString('zh-TW', { weekday: 'long' }),
        schedules: []
      };
    }

    // 判斷狀態
    let status = 'pending'; // 未到時間
    if (schedule.dateTime < now) {
      status = 'passed'; // 已過未服用
    }

    groupedByDate[dateKey].schedules.push({
      ...schedule, // 保留所有原始欄位（包含 medicationName, dosage 等）
      time: schedule.dateTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
      status: status
    });
  }

  // 轉換為陣列並排序
  return Object.values(groupedByDate).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export default {
  TIMING_PRESETS,
  generateShortTermSchedule,
  generateAntibioticSchedule,
  generateLongTermSchedule,
  schedulesToCron,
  previewSchedule
};
