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

// 載入環境變數
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
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

    console.log('✅ Email 發送成功:', result.id);
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

export default {
  sendMedicationReminderEmail,
  sendMissedMedicationAlert,
  sendTestEmail
};
