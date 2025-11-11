/**
 * 測試時間提取功能
 */

// 複製時間提取函數
function extractTimes(text) {
    console.log('🕐 提取時間，輸入:', text);
    const times = [];

    // 方法1: 匹配「時段+數字」格式（早上9點、晚上9點）
    const periodRegex = /(早上|上午|中午|下午|晚上|深夜|凌晨)\s*(\d{1,2})\s*[點点]?/g;
    let match;

    while ((match = periodRegex.exec(text)) !== null) {
        const period = match[1];
        let hour = parseInt(match[2]);

        console.log(`  找到: ${period}${hour}點`);

        // 根據時段調整小時（24小時制）
        if (period === '下午') {
            if (hour >= 1 && hour <= 11) hour += 12;
        } else if (period === '晚上' || period === '深夜') {
            if (hour >= 1 && hour <= 11) hour += 12;
            else if (hour === 12) hour = 0; // 晚上12點 = 凌晨0點
        } else if (period === '凌晨') {
            if (hour === 12) hour = 0;
        } else if (period === '中午') {
            if (hour === 12) hour = 12;
            else hour = 12; // 中午預設12點
        }
        // 早上、上午不需要調整

        if (hour >= 0 && hour < 24) {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            times.push(timeStr);
            console.log(`  → 轉換為: ${timeStr}`);
        }
    }

    // 方法2: 如果方法1沒找到，嘗試匹配純數字格式（8點、9:30）
    if (times.length === 0) {
        const numRegex = /(\d{1,2})\s*[點点:：]\s*(\d{0,2})/g;
        while ((match = numRegex.exec(text)) !== null) {
            let hour = parseInt(match[1]);
            let minute = match[2] ? parseInt(match[2]) : 0;

            if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
                const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                times.push(timeStr);
                console.log(`  找到純數字: ${timeStr}`);
            }
        }
    }

    // 去重並排序
    const uniqueTimes = [...new Set(times)].sort();
    console.log(`✅ 共提取 ${uniqueTimes.length} 個時間:`, uniqueTimes);

    return uniqueTimes;
}

// 測試案例
console.log('='.repeat(60));
console.log('🧪 測試時間提取功能');
console.log('='.repeat(60));
console.log('');

const testCases = [
    { input: '早上9點晚上9點', expected: ['09:00', '21:00'] },
    { input: '早上8點和晚上6點', expected: ['08:00', '18:00'] },
    { input: '早上7點中午12點晚上7點', expected: ['07:00', '12:00', '19:00'] },
    { input: '上午9點下午2點', expected: ['09:00', '14:00'] },
    { input: '8點和18點', expected: ['08:00', '18:00'] },
    { input: '早上9點', expected: ['09:00'] },
    { input: '晚上10點', expected: ['22:00'] },
    { input: '下午3點半', expected: ['15:00'] }, // 注意：目前不支援「半」
];

let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, index) => {
    console.log(`測試 ${index + 1}: "${testCase.input}"`);
    const result = extractTimes(testCase.input);

    const passed = JSON.stringify(result) === JSON.stringify(testCase.expected);

    if (passed) {
        console.log(`✅ 通過！提取到: ${result.join(', ')}`);
        passCount++;
    } else {
        console.log(`❌ 失敗！`);
        console.log(`   預期: ${testCase.expected.join(', ')}`);
        console.log(`   實際: ${result.join(', ')}`);
        failCount++;
    }

    console.log('');
});

console.log('='.repeat(60));
console.log(`📊 測試結果: ${passCount} 通過, ${failCount} 失敗`);
console.log('='.repeat(60));
