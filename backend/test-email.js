/**
 * Email 通知測試腳本
 *
 * 使用方式：
 * node test-email.js
 */

import {
  sendTestEmail,
  sendMedicationReminderEmail,
  sendMissedMedicationAlert
} from './services/emailNotificationService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 取得當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數（從專案根目錄的 .env）
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 設定測試收件者 Email
const TEST_EMAIL = process.env.TEST_EMAIL || 'umichwu@gmail.com';

console.log('');
console.log('='.repeat(60));
console.log('📧 ElderCare Email 通知測試');
console.log('='.repeat(60));
console.log('');

/**
 * 測試 1: 發送測試 Email
 */
async function test1_SendTestEmail() {
  console.log('🧪 測試 1: 發送測試 Email');
  console.log(`   收件者: ${TEST_EMAIL}`);

  const result = await sendTestEmail(TEST_EMAIL);

  if (result.success) {
    console.log('   ✅ 測試 Email 發送成功!');
    console.log(`   📧 Message ID: ${result.data.id}`);
  } else {
    console.log('   ❌ 測試 Email 發送失敗');
    console.error(`   錯誤: ${result.error}`);
  }

  console.log('');
}

/**
 * 測試 2: 發送用藥提醒 Email (繁體中文)
 */
async function test2_SendMedicationReminder_ZhTW() {
  console.log('🧪 測試 2: 發送用藥提醒 Email (繁體中文)');
  console.log(`   收件者: ${TEST_EMAIL}`);

  const result = await sendMedicationReminderEmail({
    to: TEST_EMAIL,
    elderName: '王爺爺',
    medicationName: '降血壓藥 (Amlodipine)',
    dosage: '5mg，1 顆',
    scheduledTime: new Date().toISOString(),
    instructions: '飯後服用，多喝水',
    language: 'zh-TW'
  });

  if (result.success) {
    console.log('   ✅ 用藥提醒 Email 發送成功!');
    console.log(`   📧 Message ID: ${result.data.id}`);
  } else {
    console.log('   ❌ 用藥提醒 Email 發送失敗');
    console.error(`   錯誤: ${result.error}`);
  }

  console.log('');
}

/**
 * 測試 3: 發送用藥提醒 Email (簡體中文)
 */
async function test3_SendMedicationReminder_ZhCN() {
  console.log('🧪 測試 3: 發送用藥提醒 Email (簡體中文)');
  console.log(`   收件者: ${TEST_EMAIL}`);

  const result = await sendMedicationReminderEmail({
    to: TEST_EMAIL,
    elderName: '李奶奶',
    medicationName: '降血糖药 (Metformin)',
    dosage: '500mg，2 颗',
    scheduledTime: new Date().toISOString(),
    instructions: '饭前服用',
    language: 'zh-CN'
  });

  if (result.success) {
    console.log('   ✅ 用藥提醒 Email (簡中) 發送成功!');
    console.log(`   📧 Message ID: ${result.data.id}`);
  } else {
    console.log('   ❌ 用藥提醒 Email (簡中) 發送失敗');
    console.error(`   錯誤: ${result.error}`);
  }

  console.log('');
}

/**
 * 測試 4: 發送用藥提醒 Email (英文)
 */
async function test4_SendMedicationReminder_EN() {
  console.log('🧪 測試 4: 發送用藥提醒 Email (英文)');
  console.log(`   收件者: ${TEST_EMAIL}`);

  const result = await sendMedicationReminderEmail({
    to: TEST_EMAIL,
    elderName: 'John Smith',
    medicationName: 'Aspirin',
    dosage: '100mg, 1 tablet',
    scheduledTime: new Date().toISOString(),
    instructions: 'Take with food',
    language: 'en'
  });

  if (result.success) {
    console.log('   ✅ 用藥提醒 Email (英文) 發送成功!');
    console.log(`   📧 Message ID: ${result.data.id}`);
  } else {
    console.log('   ❌ 用藥提醒 Email (英文) 發送失敗');
    console.error(`   錯誤: ${result.error}`);
  }

  console.log('');
}

/**
 * 測試 5: 發送未服藥警告給家屬
 */
async function test5_SendMissedMedicationAlert() {
  console.log('🧪 測試 5: 發送未服藥警告 Email (給家屬)');
  console.log(`   收件者: ${TEST_EMAIL}`);

  // 設定一個過去的時間
  const pastTime = new Date();
  pastTime.setHours(pastTime.getHours() - 1);

  const result = await sendMissedMedicationAlert({
    to: TEST_EMAIL,
    elderName: '陳奶奶',
    medicationName: '降血壓藥 (Amlodipine)',
    scheduledTime: pastTime.toISOString(),
    familyMemberName: '陳小明',
    language: 'zh-TW'
  });

  if (result.success) {
    console.log('   ✅ 未服藥警告 Email 發送成功!');
    console.log(`   📧 Message ID: ${result.data.id}`);
  } else {
    console.log('   ❌ 未服藥警告 Email 發送失敗');
    console.error(`   錯誤: ${result.error}`);
  }

  console.log('');
}

/**
 * 執行所有測試
 */
async function runAllTests() {
  console.log('🚀 開始執行 Email 測試...');
  console.log('');

  // 檢查環境變數
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ 錯誤: RESEND_API_KEY 未設定');
    console.log('');
    console.log('請在 .env 檔案中設定:');
    console.log('RESEND_API_KEY=re_your_api_key_here');
    console.log('');
    process.exit(1);
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    console.warn('⚠️  警告: RESEND_FROM_EMAIL 未設定，將使用預設值');
    console.log('');
  }

  console.log('✅ 環境變數檢查通過');
  console.log(`   RESEND_API_KEY: ${process.env.RESEND_API_KEY.substring(0, 10)}...`);
  console.log(`   RESEND_FROM_EMAIL: ${process.env.RESEND_FROM_EMAIL || '未設定'}`);
  console.log('');
  console.log('-'.repeat(60));
  console.log('');

  try {
    // 執行各項測試 (每個測試間隔 2 秒，避免 API 限制)
    await test1_SendTestEmail();
    await sleep(2000);

    await test2_SendMedicationReminder_ZhTW();
    await sleep(2000);

    await test3_SendMedicationReminder_ZhCN();
    await sleep(2000);

    await test4_SendMedicationReminder_EN();
    await sleep(2000);

    await test5_SendMissedMedicationAlert();

    console.log('='.repeat(60));
    console.log('🎉 所有測試完成!');
    console.log('');
    console.log('請檢查您的信箱 (包含垃圾郵件資料夾):');
    console.log(`📬 ${TEST_EMAIL}`);
    console.log('='.repeat(60));
    console.log('');

  } catch (error) {
    console.error('❌ 測試過程發生錯誤:', error.message);
    process.exit(1);
  }
}

/**
 * 延遲函數
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 執行測試
runAllTests();
