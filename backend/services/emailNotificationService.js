/**
 * Email Notification Service - 使用 Resend 發送 Email 通知
 *
 * 功能：
 * - 發送用藥提醒 Email
 * - 發送未服藥警告給家屬
 * - 支援多語言（繁中、簡中、英文）
 */

import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 取得當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數（從專案根目錄的 .env）
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
} else {
  dotenv.config();
}

// 初始化 Resend（如果沒有 API Key 則返回 null）
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('⚠️  RESEND_API_KEY 未設定，Email 通知功能將無法使用');
}

/**
 * 發送用藥提醒 Email
 *
 * @param {Object} reminderData - 提醒資料
 * @returns {Promise<Object>} - 發送結果
 */
export async function sendMedicationReminderEmail(reminderData) {
  if (!resend) {
    console.warn('⚠️  Resend 未初始化，跳過 Email 發送');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const {
      to,
      elderName,
      medicationName,
      dosage,
      scheduledTime,
      instructions,
      language = 'zh-TW'
    } = reminderData;

    // 驗證必要參數
    if (!to || !elderName || !medicationName) {
      return { success: false, error: 'Missing required parameters' };
    }

    // 根據語言選擇內容
    const content = getEmailContent(language, {
      elderName,
      medicationName,
      dosage,
      scheduledTime,
      instructions
    });

    // 發送 Email
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'ElderCare <noreply@yourdomain.com>',
      to: to,
      subject: content.subject,
      html: content.html
    });

    console.log('✅ Email 發送成功:', result?.data?.id || result?.id || 'success');
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Email 發送失敗:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 發送未服藥警告給家屬
 *
 * @param {Object} alertData - 警告資料
 * @returns {Promise<Object>} - 發送結果
 */
export async function sendMissedMedicationAlert(alertData) {
  if (!resend) {
    console.warn('⚠️  Resend 未初始化，跳過 Email 發送');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const {
      to,
      elderName,
      medicationName,
      scheduledTime,
      familyMemberName,
      language = 'zh-TW'
    } = alertData;

    // 驗證必要參數
    if (!to || !elderName || !medicationName) {
      return { success: false, error: 'Missing required parameters' };
    }

    // 根據語言選擇內容
    const content = getMissedAlertContent(language, {
      elderName,
      medicationName,
      scheduledTime,
      familyMemberName
    });

    // 發送 Email
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'ElderCare <noreply@yourdomain.com>',
      to: to,
      subject: content.subject,
      html: content.html
    });

    console.log('✅ 家屬警告 Email 發送成功:', result.id);
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ 家屬警告 Email 發送失敗:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 發送測試 Email
 *
 * @param {string} to - 收件者 Email
 * @returns {Promise<Object>} - 發送結果
 */
export async function sendTestEmail(to) {
  if (!resend) {
    console.warn('⚠️  Resend 未初始化，跳過 Email 發送');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'ElderCare <noreply@yourdomain.com>',
      to: to,
      subject: '✅ ElderCare 測試郵件',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #667eea; text-align: center;">✅ 測試成功！</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            恭喜！您的 ElderCare Email 通知系統已經成功設定。
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            這代表您可以開始接收用藥提醒通知了。
          </p>
          <div style="margin-top: 30px; padding: 20px; background: #f5f7fa; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              發送時間：${new Date().toLocaleString('zh-TW')}
            </p>
          </div>
        </div>
      `
    });

    console.log('✅ 測試 Email 發送成功:', result.id);
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ 測試 Email 發送失敗:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 發送 App 邀請 Email
 *
 * @param {Object} invitationData - 邀請資料
 * @returns {Promise<Object>} - 發送結果
 */
export async function sendAppInvitationEmail(invitationData) {
  if (!resend) {
    console.warn('⚠️  Resend 未初始化，跳過 Email 發送');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const {
      to,
      inviterName,
      inviterEmail,
      message,
      appUrl = 'https://08-eldercare.vercel.app',
      language = 'zh-TW'
    } = invitationData;

    // 驗證必要參數
    if (!to || !inviterName) {
      return { success: false, error: 'Missing required parameters' };
    }

    // 根據語言選擇內容
    const content = getInvitationEmailContent(language, {
      inviterName,
      inviterEmail,
      message,
      appUrl
    });

    // 發送 Email
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'ElderCare <noreply@yourdomain.com>',
      to: to,
      subject: content.subject,
      html: content.html
    });

    console.log('✅ 邀請 Email 發送成功:', result?.data?.id || result?.id || 'success');
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ 邀請 Email 發送失敗:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 取得用藥提醒 Email 內容
 */
function getEmailContent(language, data) {
  const { elderName, medicationName, dosage, scheduledTime, instructions } = data;

  const timeStr = scheduledTime
    ? new Date(scheduledTime).toLocaleString('zh-TW', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '現在';

  const templates = {
    'zh-TW': {
      subject: `💊 用藥提醒 - ${medicationName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <h1 style="color: #667eea; margin-bottom: 20px; font-size: 28px;">
              💊 用藥提醒
            </h1>

            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 10px;">
              親愛的 <strong>${elderName}</strong>，您好！
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              現在是服藥時間，請記得按時服藥喔！
            </p>

            <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; border-left: 4px solid #667eea;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">藥物名稱</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${medicationName}</td>
                </tr>
                ${dosage ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">劑量</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${dosage}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">時間</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${timeStr}</td>
                </tr>
              </table>
            </div>

            ${instructions ? `
            <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⚠️ 注意事項：</strong><br>
                ${instructions}
              </p>
            </div>
            ` : ''}

            <p style="font-size: 16px; line-height: 1.6; color: #333; margin-top: 30px;">
              請記得服藥後在 App 中標記為「已服用」。<br>
              祝您身體健康、平安喜樂！
            </p>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                這是系統自動發送的郵件，請勿直接回覆<br>
                ElderCare - 長輩陪伴助手
              </p>
            </div>
          </div>
        </div>
      `
    },
    'zh-CN': {
      subject: `💊 用药提醒 - ${medicationName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <h1 style="color: #667eea; margin-bottom: 20px; font-size: 28px;">
              💊 用药提醒
            </h1>

            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 10px;">
              亲爱的 <strong>${elderName}</strong>，您好！
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              现在是服药时间，请记得按时服药哦！
            </p>

            <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; border-left: 4px solid #667eea;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">药物名称</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${medicationName}</td>
                </tr>
                ${dosage ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">剂量</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${dosage}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">时间</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${timeStr}</td>
                </tr>
              </table>
            </div>

            ${instructions ? `
            <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⚠️ 注意事项：</strong><br>
                ${instructions}
              </p>
            </div>
            ` : ''}

            <p style="font-size: 16px; line-height: 1.6; color: #333; margin-top: 30px;">
              请记得服药后在 App 中标记为「已服用」。<br>
              祝您身体健康、平安喜乐！
            </p>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                这是系统自动发送的邮件，请勿直接回复<br>
                ElderCare - 长辈陪伴助手
              </p>
            </div>
          </div>
        </div>
      `
    },
    'en': {
      subject: `💊 Medication Reminder - ${medicationName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <h1 style="color: #667eea; margin-bottom: 20px; font-size: 28px;">
              💊 Medication Reminder
            </h1>

            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 10px;">
              Dear <strong>${elderName}</strong>,
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              It's time to take your medication!
            </p>

            <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; border-left: 4px solid #667eea;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Medication</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${medicationName}</td>
                </tr>
                ${dosage ? `
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Dosage</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${dosage}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Time</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${timeStr}</td>
                </tr>
              </table>
            </div>

            ${instructions ? `
            <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⚠️ Instructions:</strong><br>
                ${instructions}
              </p>
            </div>
            ` : ''}

            <p style="font-size: 16px; line-height: 1.6; color: #333; margin-top: 30px;">
              Please mark as "Taken" in the app after taking your medication.<br>
              Stay healthy and take care!
            </p>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                This is an automated email, please do not reply<br>
                ElderCare - Your Companion Assistant
              </p>
            </div>
          </div>
        </div>
      `
    }
  };

  return templates[language] || templates['zh-TW'];
}

/**
 * 取得未服藥警告 Email 內容
 */
function getMissedAlertContent(language, data) {
  const { elderName, medicationName, scheduledTime, familyMemberName } = data;

  const timeStr = scheduledTime
    ? new Date(scheduledTime).toLocaleString('zh-TW', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '排定時間';

  const templates = {
    'zh-TW': {
      subject: `⚠️ 用藥提醒：${elderName} 可能錯過服藥`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px;">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <h1 style="color: #dc3545; margin-bottom: 20px; font-size: 28px;">
              ⚠️ 用藥提醒
            </h1>

            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 10px;">
              親愛的 <strong>${familyMemberName || '家屬'}</strong>，您好！
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              <strong>${elderName}</strong> 可能錯過了以下用藥：
            </p>

            <div style="margin: 30px 0; padding: 25px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">藥物名稱</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${medicationName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">排定時間</td>
                  <td style="padding: 8px 0; color: #333; font-size: 16px; font-weight: 600;">${timeStr}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">狀態</td>
                  <td style="padding: 8px 0; color: #dc3545; font-size: 16px; font-weight: 600;">未服用</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 16px; line-height: 1.6; color: #333; margin-top: 30px;">
              建議您與長輩聯繫，確認是否已經服藥。<br>
              如果已經服藥，請協助在 App 中標記為「已服用」。
            </p>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                這是系統自動發送的郵件，請勿直接回覆<br>
                ElderCare - 長輩陪伴助手
              </p>
            </div>
          </div>
        </div>
      `
    }
  };

  return templates[language] || templates['zh-TW'];
}

/**
 * 取得邀請 Email 內容
 */
function getInvitationEmailContent(language, data) {
  const { inviterName, inviterEmail, message, appUrl } = data;

  const templates = {
    'zh-TW': {
      subject: `${inviterName} 邀請您加入 ElderCare`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <h1 style="color: #667eea; margin-bottom: 20px; font-size: 28px; text-align: center;">
              👋 您收到一個邀請！
            </h1>

            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 10px;">
              您好！
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              <strong>${inviterName}</strong> ${inviterEmail ? `(${inviterEmail})` : ''} 邀請您加入 <strong>ElderCare</strong> - 長輩陪伴助手！
            </p>

            ${message ? `
            <div style="margin: 30px 0; padding: 20px; background: #f5f7fa; border-radius: 8px; border-left: 4px solid #667eea;">
              <p style="margin: 0; font-size: 14px; color: #666; font-weight: 600;">來自邀請者的訊息：</p>
              <p style="margin: 10px 0 0 0; font-size: 16px; color: #333; line-height: 1.6;">${message}</p>
            </div>
            ` : ''}

            <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px;">
              <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 18px;">✨ 關於 ElderCare</h3>
              <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">
                <li>💊 用藥提醒與管理</li>
                <li>👥 群組聊天與社交功能</li>
                <li>📅 日程安排與追蹤</li>
                <li>🙏 靈性關懷與支持</li>
                <li>📍 位置分享與安全提醒</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}"
                 style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                立即加入 ElderCare
              </a>
            </div>

            <p style="font-size: 14px; line-height: 1.6; color: #666; text-align: center;">
              點擊上方按鈕或複製以下連結到瀏覽器：<br>
              <a href="${appUrl}" style="color: #667eea; word-break: break-all;">${appUrl}</a>
            </p>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                這是由您的朋友 ${inviterName} 發送的邀請郵件<br>
                ElderCare - 長輩陪伴助手
              </p>
            </div>
          </div>
        </div>
      `
    },
    'zh-CN': {
      subject: `${inviterName} 邀请您加入 ElderCare`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <h1 style="color: #667eea; margin-bottom: 20px; font-size: 28px; text-align: center;">
              👋 您收到一个邀请！
            </h1>

            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 10px;">
              您好！
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              <strong>${inviterName}</strong> ${inviterEmail ? `(${inviterEmail})` : ''} 邀请您加入 <strong>ElderCare</strong> - 长辈陪伴助手！
            </p>

            ${message ? `
            <div style="margin: 30px 0; padding: 20px; background: #f5f7fa; border-radius: 8px; border-left: 4px solid #667eea;">
              <p style="margin: 0; font-size: 14px; color: #666; font-weight: 600;">来自邀请者的消息：</p>
              <p style="margin: 10px 0 0 0; font-size: 16px; color: #333; line-height: 1.6;">${message}</p>
            </div>
            ` : ''}

            <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px;">
              <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 18px;">✨ 关于 ElderCare</h3>
              <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">
                <li>💊 用药提醒与管理</li>
                <li>👥 群组聊天与社交功能</li>
                <li>📅 日程安排与追踪</li>
                <li>🙏 灵性关怀与支持</li>
                <li>📍 位置分享与安全提醒</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}"
                 style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                立即加入 ElderCare
              </a>
            </div>

            <p style="font-size: 14px; line-height: 1.6; color: #666; text-align: center;">
              点击上方按钮或复制以下链接到浏览器：<br>
              <a href="${appUrl}" style="color: #667eea; word-break: break-all;">${appUrl}</a>
            </p>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                这是由您的朋友 ${inviterName} 发送的邀请邮件<br>
                ElderCare - 长辈陪伴助手
              </p>
            </div>
          </div>
        </div>
      `
    },
    'en': {
      subject: `${inviterName} invited you to join ElderCare`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <h1 style="color: #667eea; margin-bottom: 20px; font-size: 28px; text-align: center;">
              👋 You've got an invitation!
            </h1>

            <p style="font-size: 18px; line-height: 1.6; color: #333; margin-bottom: 10px;">
              Hello!
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              <strong>${inviterName}</strong> ${inviterEmail ? `(${inviterEmail})` : ''} invited you to join <strong>ElderCare</strong> - Your Companion Assistant!
            </p>

            ${message ? `
            <div style="margin: 30px 0; padding: 20px; background: #f5f7fa; border-radius: 8px; border-left: 4px solid #667eea;">
              <p style="margin: 0; font-size: 14px; color: #666; font-weight: 600;">Message from the inviter:</p>
              <p style="margin: 10px 0 0 0; font-size: 16px; color: #333; line-height: 1.6;">${message}</p>
            </div>
            ` : ''}

            <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px;">
              <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 18px;">✨ About ElderCare</h3>
              <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">
                <li>💊 Medication reminders and management</li>
                <li>👥 Group chat and social features</li>
                <li>📅 Schedule planning and tracking</li>
                <li>🙏 Spiritual care and support</li>
                <li>📍 Location sharing and safety alerts</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}"
                 style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Join ElderCare Now
              </a>
            </div>

            <p style="font-size: 14px; line-height: 1.6; color: #666; text-align: center;">
              Click the button above or copy this link to your browser:<br>
              <a href="${appUrl}" style="color: #667eea; word-break: break-all;">${appUrl}</a>
            </p>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                This invitation was sent by your friend ${inviterName}<br>
                ElderCare - Your Companion Assistant
              </p>
            </div>
          </div>
        </div>
      `
    }
  };

  return templates[language] || templates['zh-TW'];
}

/**
 * 發送生活提醒 Email
 *
 * @param {Object} reminderData - 提醒資料
 * @returns {Promise<Object>} { success: boolean, messageId: string, error: string }
 */
export async function sendDailyReminderEmail(reminderData) {
  try {
    const {
      to,
      elderName,
      category,
      categoryName,
      categoryIcon,
      title,
      description,
      reminderNote,
      scheduledTime,
      categorySpecificData,
      language = 'zh-TW'
    } = reminderData;

    const scheduledDate = new Date(scheduledTime);
    const formattedTime = scheduledDate.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // 根據類別產生特定內容
    let additionalInfo = '';
    if (categorySpecificData) {
      switch (category) {
        case 'water':
          additionalInfo = `<p>🎯 目標水量：${categorySpecificData.targetAmount || 250} ${categorySpecificData.unit || 'ml'}</p>`;
          break;
        case 'exercise':
          additionalInfo = `<p>🎯 運動類型：${categorySpecificData.exerciseType === 'walking' ? '散步' : '運動'}</p>
                           <p>⏱️  建議時長：${categorySpecificData.targetDuration || 30} 分鐘</p>`;
          break;
        case 'meal':
          additionalInfo = `<p>🍽️  用餐時段：${categorySpecificData.mealType === 'breakfast' ? '早餐' : categorySpecificData.mealType === 'lunch' ? '午餐' : categorySpecificData.mealType === 'dinner' ? '晚餐' : '點心'}</p>
                           <p>📝 ${categorySpecificData.timing === 'before' ? '飯前' : '飯後'}</p>`;
          break;
        case 'sleep':
          additionalInfo = `<p>🛏️  建議就寢時間：${categorySpecificData.targetTime || '22:00'}</p>`;
          break;
        case 'appointment':
          additionalInfo = `<p>🏥 醫院：${categorySpecificData.hospital || '（未設定）'}</p>
                           <p>👨‍⚕️ 醫生：${categorySpecificData.doctor || '（未設定）'}</p>`;
          break;
      }
    }

    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: '長輩照護系統 - 生活提醒'
      },
      subject: `${categoryIcon} ${categoryName}提醒 - ${title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Microsoft JhengHei', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 2px solid #e0e0e0;
              border-top: none;
              border-radius: 0 0 10px 10px;
            }
            .reminder-box {
              background: #f8f9fa;
              padding: 20px;
              border-left: 4px solid #667eea;
              margin: 20px 0;
              border-radius: 5px;
            }
            .time {
              font-size: 24px;
              font-weight: bold;
              color: #667eea;
              margin: 10px 0;
            }
            .info {
              margin: 15px 0;
              padding: 10px;
              background: #e8f5e9;
              border-radius: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="icon">${categoryIcon}</div>
            <h1>${categoryName}提醒</h1>
            <p>親愛的 ${elderName}，該${categoryName}囉！</p>
          </div>
          <div class="content">
            <div class="reminder-box">
              <h2>${title}</h2>
              ${description ? `<p>${description}</p>` : ''}
              ${reminderNote ? `<p style="color: #667eea; font-weight: bold;">💡 ${reminderNote}</p>` : ''}
            </div>

            <div class="time">
              ⏰ 提醒時間：${formattedTime}
            </div>

            ${additionalInfo ? `<div class="info">${additionalInfo}</div>` : ''}

            <p style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
              📱 請記得在 App 中確認完成，讓家人放心！
            </p>
          </div>

          <div class="footer">
            <p>此郵件由長輩照護系統自動發送</p>
            <p>如有問題，請聯繫您的家人或照護人員</p>
          </div>
        </body>
        </html>
      `
    };

    const result = await sg.send(msg);

    console.log(`✅ 生活提醒 Email 已發送: ${to} (${categoryName})`);
    return {
      success: true,
      messageId: result[0].headers['x-message-id']
    };
  } catch (error) {
    console.error('❌ 發送生活提醒 Email 失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  sendMedicationReminderEmail,
  sendMissedMedicationAlert,
  sendTestEmail,
  sendAppInvitationEmail,
  sendDailyReminderEmail
};
