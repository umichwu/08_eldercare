/**
 * 測試 3 天用藥計畫預覽 API
 */

const API_BASE = 'http://localhost:3000/api';
const elderId = 'fe50db48-6d33-4777-803b-8b335625c9c2';

console.log('🧪 測試 3 天用藥計畫預覽 API');
console.log('='.repeat(60));

async function testSchedulePreview() {
  try {
    // Step 1: 建立測試用藥
    console.log('\n步驟 1: 建立測試感冒藥...');
    const now = new Date();
    now.setHours(14, 30, 0, 0); // 下午 2:30

    const medRes = await fetch(`${API_BASE}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId,
        medicationName: '預覽測試感冒藥',
        dosage: '1顆',
        medicationType: 'shortterm',
        purpose: '測試 3 天計畫預覽'
      })
    });

    const medData = await medRes.json();
    const medicationId = medData.data.id;
    console.log(`✅ 藥物建立成功 (ID: ${medicationId})`);

    // Step 2: 建立智能排程
    console.log('\n步驟 2: 建立智能排程提醒...');
    const remRes = await fetch(`${API_BASE}/medication-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicationId,
        elderId,
        useSmartSchedule: true,
        firstDoseDateTime: now.toISOString(),
        dosesPerDay: 3,
        treatmentDays: 3
      })
    });

    const remData = await remRes.json();
    const reminderId = remData.data.id;
    console.log(`✅ 提醒建立成功 (ID: ${reminderId})`);

    // Step 3: 測試單一提醒的預覽
    console.log('\n步驟 3: 取得單一提醒的 3 天預覽...');
    const previewRes = await fetch(`${API_BASE}/medication-reminders/${reminderId}/schedule-preview?days=3`);
    const previewData = await previewRes.json();

    console.log('\n📅 API 回應:');
    console.log(JSON.stringify(previewData, null, 2));

    if (!previewData.data) {
      throw new Error(`API 回傳錯誤: ${previewData.error || previewData.message}`);
    }

    console.log('\n📅 單一提醒預覽結果:');
    console.log('='.repeat(60));
    console.log(`藥物: ${previewData.data.reminder.medicationName}`);
    console.log(`劑量: ${previewData.data.reminder.dosage}`);
    console.log(`總天數: ${previewData.data.totalDays}`);
    console.log('');

    previewData.data.preview.forEach((day, idx) => {
      console.log(`\n${day.dayOfWeek} (${day.date}):`);
      day.schedules.forEach(schedule => {
        console.log(`   ⏰ ${schedule.time} - ${schedule.label}`);
      });
    });

    // Step 4: 測試長輩的所有用藥預覽
    console.log('\n\n步驟 4: 取得長輩的所有用藥預覽...');
    const elderPreviewRes = await fetch(`${API_BASE}/elders/${elderId}/schedule-preview?days=3`);
    const elderPreviewData = await elderPreviewRes.json();

    console.log('\n📅 長輩所有用藥預覽:');
    console.log('='.repeat(60));
    console.log(`總藥物數: ${elderPreviewData.data.totalMedications}`);
    console.log(`總天數: ${elderPreviewData.data.totalDays}`);
    console.log('');

    elderPreviewData.data.preview.forEach((day, idx) => {
      console.log(`\n${day.dayOfWeek} (${day.date}):`);
      day.schedules.forEach(schedule => {
        const medName = schedule.medicationName || '未知藥物';
        const dosage = schedule.dosage || '';
        console.log(`   💊 ${schedule.time} - ${medName} ${dosage} (${schedule.label})`);
      });
    });

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ 所有測試通過！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    console.error(error);
  }
}

testSchedulePreview();
