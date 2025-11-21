// ============================================================================
// ElderCare Companion - 通知服務
// ============================================================================
// 版本: 1.0 (2025-01-21)
// 功能: 統一的 Email 和 SMS 通知服務
// ============================================================================

import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 初始化 SendGrid
// ============================================================================

let sendgridConfigured = false;

if (process.env.SENDGRID_API_KEY) {
    try {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        sendgridConfigured = true;
        console.log('✅ SendGrid 已配置');
    } catch (error) {
        console.error('❌ SendGrid 配置失敗:', error.message);
    }
} else {
    console.warn('⚠️  未配置 SENDGRID_API_KEY，Email 功能將無法使用');
}

// ============================================================================
// 初始化 Twilio
// ============================================================================

let twilioClient = null;
let twilioConfigured = false;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
        twilioClient = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
        twilioConfigured = true;
        console.log('✅ Twilio 已配置');
    } catch (error) {
        console.error('❌ Twilio 配置失敗:', error.message);
    }
} else {
    console.warn('⚠️  未配置 Twilio，SMS 功能將無法使用');
}

// ============================================================================
// Email 模板載入
// ============================================================================

/**
 * 載入 HTML Email 模板
 * @param {string} templateName - 模板名稱
 * @returns {string} HTML 內容
 */
function loadEmailTemplate(templateName) {
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);

    try {
        if (fs.existsSync(templatePath)) {
            return fs.readFileSync(templatePath, 'utf-8');
        } else {
            console.warn(`⚠️  找不到 Email 模板: ${templateName}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ 載入 Email 模板失敗 (${templateName}):`, error.message);
        return null;
    }
}

/**
 * 替換模板變數
 * @param {string} template - HTML 模板
 * @param {object} variables - 變數對象
 * @returns {string} 替換後的 HTML
 */
function replaceTemplateVariables(template, variables) {
    let result = template;

    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, variables[key] || '');
    });

    return result;
}

// ============================================================================
// Email 發送函數
// ============================================================================

/**
 * 發送 Email
 * @param {object} options - Email 選項
 * @param {string} options.to - 收件人 Email
 * @param {string} options.subject - 主旨
 * @param {string} options.html - HTML 內容
 * @param {string} options.text - 純文字內容（選填）
 * @returns {Promise<boolean>} 是否成功
 */
export async function sendEmail({ to, subject, html, text }) {
    if (!sendgridConfigured) {
        console.warn('⚠️  SendGrid 未配置，跳過發送 Email');
        return false;
    }

    try {
        const msg = {
            to,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@eldercare.app',
            subject,
            html,
            text: text || subject
        };

        console.log(`📧 發送 Email 給: ${to}`);
        const result = await sgMail.send(msg);
        console.log('✅ Email 發送成功');
        return true;
    } catch (error) {
        console.error('❌ Email 發送失敗:', error);

        if (error.response) {
            console.error('錯誤詳情:', error.response.body);
        }

        return false;
    }
}

/**
 * 使用模板發送 Email
 * @param {object} options - Email 選項
 * @param {string} options.to - 收件人 Email
 * @param {string} options.subject - 主旨
 * @param {string} options.templateName - 模板名稱
 * @param {object} options.variables - 模板變數
 * @returns {Promise<boolean>} 是否成功
 */
export async function sendTemplateEmail({ to, subject, templateName, variables }) {
    const template = loadEmailTemplate(templateName);

    if (!template) {
        console.error('❌ 無法載入 Email 模板');
        return false;
    }

    const html = replaceTemplateVariables(template, variables);

    return await sendEmail({
        to,
        subject,
        html,
        text: subject
    });
}

// ============================================================================
// SMS 發送函數
// ============================================================================

/**
 * 發送 SMS
 * @param {object} options - SMS 選項
 * @param {string} options.to - 收件人電話（包含國碼，例如 +886912345678）
 * @param {string} options.message - 訊息內容
 * @returns {Promise<boolean>} 是否成功
 */
export async function sendSMS({ to, message }) {
    if (!twilioConfigured) {
        console.warn('⚠️  Twilio 未配置，跳過發送 SMS');
        return false;
    }

    try {
        // 確保電話號碼包含國碼
        const phoneNumber = to.startsWith('+') ? to : `+886${to.replace(/^0/, '')}`;

        console.log(`📱 發送 SMS 給: ${phoneNumber}`);

        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
        });

        console.log('✅ SMS 發送成功, SID:', result.sid);
        return true;
    } catch (error) {
        console.error('❌ SMS 發送失敗:', error);

        if (error.code) {
            console.error('錯誤代碼:', error.code);
            console.error('錯誤訊息:', error.message);
        }

        return false;
    }
}

// ============================================================================
// 好友邀請通知
// ============================================================================

/**
 * 發送好友邀請 Email
 * @param {object} invitation - 邀請資訊
 * @param {string} invitation.email - 收件人 Email
 * @param {string} invitation.inviterName - 邀請者姓名
 * @param {string} invitation.invitationCode - 邀請碼
 * @param {string} invitation.message - 邀請訊息（選填）
 * @returns {Promise<boolean>} 是否成功
 */
export async function sendFriendInvitationEmail({ email, inviterName, invitationCode, message }) {
    const appUrl = process.env.FRONTEND_URL || 'https://08-eldercare.vercel.app';
    const invitationUrl = `${appUrl}/register.html?invitation=${invitationCode}`;

    return await sendTemplateEmail({
        to: email,
        subject: `${inviterName} 邀請您加入 ElderCare Companion`,
        templateName: 'friend-invitation',
        variables: {
            inviterName,
            invitationCode,
            invitationUrl,
            customMessage: message || '',
            appUrl,
            currentYear: new Date().getFullYear()
        }
    });
}

/**
 * 發送好友邀請 SMS
 * @param {object} invitation - 邀請資訊
 * @param {string} invitation.phone - 收件人電話
 * @param {string} invitation.inviterName - 邀請者姓名
 * @param {string} invitation.invitationCode - 邀請碼
 * @returns {Promise<boolean>} 是否成功
 */
export async function sendFriendInvitationSMS({ phone, inviterName, invitationCode }) {
    const appUrl = process.env.FRONTEND_URL || 'https://08-eldercare.vercel.app';
    const shortUrl = `${appUrl}?i=${invitationCode}`;

    const message = `${inviterName} 邀請您加入 ElderCare！\n` +
                   `邀請碼: ${invitationCode}\n` +
                   `立即註冊: ${shortUrl}`;

    return await sendSMS({
        to: phone,
        message
    });
}

/**
 * 發送好友邀請（自動選擇 Email 或 SMS）
 * @param {object} invitation - 邀請資訊
 * @returns {Promise<object>} { emailSent, smsSent }
 */
export async function sendFriendInvitation(invitation) {
    const results = {
        emailSent: false,
        smsSent: false
    };

    // 發送 Email
    if (invitation.email) {
        results.emailSent = await sendFriendInvitationEmail({
            email: invitation.email,
            inviterName: invitation.inviterName,
            invitationCode: invitation.invitationCode,
            message: invitation.message
        });
    }

    // 發送 SMS
    if (invitation.phone) {
        results.smsSent = await sendFriendInvitationSMS({
            phone: invitation.phone,
            inviterName: invitation.inviterName,
            invitationCode: invitation.invitationCode
        });
    }

    return results;
}

// ============================================================================
// 其他通知函數
// ============================================================================

/**
 * 發送歡迎 Email
 * @param {object} user - 使用者資訊
 * @returns {Promise<boolean>} 是否成功
 */
export async function sendWelcomeEmail({ email, displayName }) {
    return await sendTemplateEmail({
        to: email,
        subject: '歡迎加入 ElderCare Companion！',
        templateName: 'welcome',
        variables: {
            displayName,
            appUrl: process.env.FRONTEND_URL || 'https://08-eldercare.vercel.app',
            currentYear: new Date().getFullYear()
        }
    });
}

/**
 * 發送好友請求通知 Email
 * @param {object} notification - 通知資訊
 * @returns {Promise<boolean>} 是否成功
 */
export async function sendFriendRequestNotification({ email, displayName, requesterName }) {
    return await sendTemplateEmail({
        to: email,
        subject: `${requesterName} 想要加您為好友`,
        templateName: 'friend-request',
        variables: {
            displayName,
            requesterName,
            appUrl: process.env.FRONTEND_URL || 'https://08-eldercare.vercel.app',
            currentYear: new Date().getFullYear()
        }
    });
}

// ============================================================================
// 狀態檢查
// ============================================================================

/**
 * 檢查通知服務狀態
 * @returns {object} 服務狀態
 */
export function getNotificationServiceStatus() {
    return {
        email: {
            configured: sendgridConfigured,
            provider: 'SendGrid',
            fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@eldercare.app'
        },
        sms: {
            configured: twilioConfigured,
            provider: 'Twilio',
            fromPhone: process.env.TWILIO_PHONE_NUMBER || 'N/A'
        }
    };
}

// ============================================================================
// 導出
// ============================================================================

export default {
    sendEmail,
    sendTemplateEmail,
    sendSMS,
    sendFriendInvitation,
    sendFriendInvitationEmail,
    sendFriendInvitationSMS,
    sendWelcomeEmail,
    sendFriendRequestNotification,
    getNotificationServiceStatus
};
