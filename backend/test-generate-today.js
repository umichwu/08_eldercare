/**
 * 測試生成今日用藥記錄
 */
import { generateTodayMedicationLogs } from './services/medicationScheduler.js';

console.log('🔄 開始生成今日用藥記錄...\n');

try {
  const result = await generateTodayMedicationLogs();

  console.log('\n📊 生成結果:');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`\n✅ 成功生成 ${result.count} 筆記錄`);
  } else {
    console.log(`\n❌ 生成失敗: ${result.error}`);
  }
} catch (error) {
  console.error('\n❌ 執行失敗:', error);
}
