/**
 * 通知服務測試腳本
 * 用於測試 Email 和 SMS 通知功能
 *
 * 使用方法：
 * node test-notification-service.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    sendEmail,
    sendTemplateEmail,
    sendSMS,
    sendFriendInvitation,
    sendWelcomeEmail,
    getNotificationServiceStatus
} from './services/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('='.repeat(70));
console.log('📧 ElderCare 通知服務測試');
console.log('='.repeat(70));
console.log('');

// 檢查服務狀態
const status = getNotificationServiceStatus();

console.log('📊 服務狀態:');
console.log('');
console.log('  Email 服務 (SendGrid):');
console.log(`    狀態: ${status.email.configured ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`    提供商: ${status.email.provider}`);
console.log(`    寄件人: ${status.email.fromEmail}`);
console.log('');
console.log('  SMS 服務 (Twilio):');
console.log(`    狀態: ${status.sms.configured ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`    提供商: ${status.sms.provider}`);
console.log(`    發送號碼: ${status.sms.fromPhone}`);
console.log('');
console.log('='.repeat(70));
console.log('');

// 測試配置
const TEST_CONFIG = {
    // 修改為您的測試 Email
    testEmail: process.env.TEST_EMAIL || 'your-email@example.com',

    // 修改為您的測試電話（包含國碼）
    testPhone: process.env.TEST_PHONE || '+886912345678',

    // 測試資料
    inviterName: '測試使用者',
    invitationCode: 'TEST1234',
    displayName: '張小明'
};

console.log('⚙️  測試配置:');
console.log(`  測試 Email: ${TEST_CONFIG.testEmail}`);
console.log(`  測試電話: ${TEST_CONFIG.testPhone}`);
console.log('');
console.log('='.repeat(70));
console.log('');

// 主測試函數
async function runTests() {
    console.log('🧪 開始測試...');
    console.log('');

    // 測試 1: 基本 Email 發送
    if (status.email.configured) {
        console.log('測試 1: 發送基本 Email');
        console.log('-'.repeat(70));

        try {
            const result = await sendEmail({
                to: TEST_CONFIG.testEmail,
                subject: 'ElderCare 測試郵件',
                html: '<h1>測試成功！</h1><p>如果您收到這封郵件，表示 Email 服務運作正常。</p>',
                text: '測試成功！如果您收到這封郵件，表示 Email 服務運作正常。'
            });

            console.log(`結果: ${result ? '✅ 成功' : '❌ 失敗'}`);
        } catch (error) {
            console.error('❌ 錯誤:', error.message);
        }

        console.log('');
    } else {
        console.log('⏭️  跳過測試 1: Email 服務未配置');
        console.log('');
    }

    // 測試 2: 使用模板發送歡迎郵件
    if (status.email.configured) {
        console.log('測試 2: 發送歡迎郵件（使用模板）');
        console.log('-'.repeat(70));

        try {
            const result = await sendWelcomeEmail({
                email: TEST_CONFIG.testEmail,
                displayName: TEST_CONFIG.displayName
            });

            console.log(`結果: ${result ? '✅ 成功' : '❌ 失敗'}`);
        } catch (error) {
            console.error('❌ 錯誤:', error.message);
        }

        console.log('');
    } else {
        console.log('⏭️  跳過測試 2: Email 服務未配置');
        console.log('');
    }

    // 測試 3: 發送 SMS
    if (status.sms.configured) {
        console.log('測試 3: 發送 SMS');
        console.log('-'.repeat(70));

        try {
            const result = await sendSMS({
                to: TEST_CONFIG.testPhone,
                message: 'ElderCare 測試簡訊：如果您收到這則訊息，表示 SMS 服務運作正常。'
            });

            console.log(`結果: ${result ? '✅ 成功' : '❌ 失敗'}`);
        } catch (error) {
            console.error('❌ 錯誤:', error.message);
        }

        console.log('');
    } else {
        console.log('⏭️  跳過測試 3: SMS 服務未配置');
        console.log('');
    }

    // 測試 4: 發送好友邀請（Email + SMS）
    console.log('測試 4: 發送好友邀請（Email + SMS）');
    console.log('-'.repeat(70));

    try {
        const results = await sendFriendInvitation({
            email: status.email.configured ? TEST_CONFIG.testEmail : null,
            phone: status.sms.configured ? TEST_CONFIG.testPhone : null,
            inviterName: TEST_CONFIG.inviterName,
            invitationCode: TEST_CONFIG.invitationCode,
            message: '這是一則測試邀請訊息，請忽略。'
        });

        console.log(`Email 發送: ${results.emailSent ? '✅ 成功' : '❌ 失敗/跳過'}`);
        console.log(`SMS 發送: ${results.smsSent ? '✅ 成功' : '❌ 失敗/跳過'}`);
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('');
    console.log('✅ 測試完成！');
    console.log('');
    console.log('💡 提示:');
    console.log('  - 請檢查您的 Email 收件匣（包含垃圾郵件）');
    console.log('  - 請檢查您的手機簡訊');
    console.log('  - 如果服務未配置，相關測試會自動跳過');
    console.log('');
    console.log('📝 配置說明:');
    console.log('  1. 複製 .env.example 為 .env');
    console.log('  2. 填入您的 SendGrid 和 Twilio 憑證');
    console.log('  3. 設定 TEST_EMAIL 和 TEST_PHONE 環境變數');
    console.log('  4. 重新執行此測試腳本');
    console.log('');
    console.log('📖 完整文檔: backend/NOTIFICATION_SERVICE_DOCUMENTATION.md');
    console.log('');
    console.log('='.repeat(70));
}

// 執行測試
runTests().catch(error => {
    console.error('');
    console.error('💥 測試過程發生錯誤:');
    console.error(error);
    console.error('');
    process.exit(1);
});
