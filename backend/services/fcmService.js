/**
 * FCM Service - Firebase Cloud Messaging 推送通知服務
 *
 * 功能：
 * - 初始化 Firebase Admin SDK
 * - 發送單一/多個裝置推送通知
 * - 處理 FCM Token 註冊和管理
 * - 發送用藥提醒和家屬通知
 */

import admin from '../config/firebase.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 載入環境變數
// 在本地開發：從根目錄的 .env 載入
// 在 Render：環境變數已經在 Dashboard 設定，dotenv.config() 不會覆蓋現有變數
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
} else {
  // 生產環境：環境變數應該由平台提供（Render Dashboard）
  dotenv.config(); // 嘗試載入，但不強制要求檔案存在
}

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 檢查 Firebase 是否已初始化
 */
function isFirebaseInitialized() {
  try {
    return admin.apps.length > 0;
  } catch {
    return false;
  }
}

/**
 * 發送推送通知到單一裝置
 *
 * @param {string} fcmToken - FCM 裝置 Token
 * @param {Object} notification - 通知內容
 * @param {string} notification.title - 通知標題
 * @param {string} notification.body - 通知內容
 * @param {Object} data - 額外資料 (optional)
 * @returns {Promise<Object>} - 發送結果
 */
export async function sendPushNotification(fcmToken, notification, data = {}) {
  if (!isFirebaseInitialized()) {
    console.warn('⚠️  Firebase 未初始化，無法發送推送通知');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!fcmToken) {
    console.warn('⚠️  FCM Token 為空，無法發送推送通知');
    return { success: false, error: 'Empty FCM token' };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      // Android 特定設定
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'medication_reminders',
        },
      },
      // iOS 特定設定
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ 推送通知發送成功:', response);

    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ 推送通知發送失敗:', error.message);

    // 處理無效的 Token
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.warn('⚠️  FCM Token 無效或已過期，建議清除該 Token');
      return { success: false, error: 'Invalid FCM token', shouldRemoveToken: true };
    }

    return { success: false, error: error.message };
  }
}

/**
 * 發送推送通知到多個裝置
 *
 * @param {string[]} fcmTokens - FCM 裝置 Token 陣列
 * @param {Object} notification - 通知內容
 * @param {Object} data - 額外資料 (optional)
 * @returns {Promise<Object>} - 發送結果統計
 */
export async function sendMulticastPushNotification(fcmTokens, notification, data = {}) {
  if (!isFirebaseInitialized()) {
    console.warn('⚠️  Firebase 未初始化，無法發送推送通知');
    return { successCount: 0, failureCount: fcmTokens.length };
  }

  if (!fcmTokens || fcmTokens.length === 0) {
    console.warn('⚠️  FCM Tokens 陣列為空，無法發送推送通知');
    return { successCount: 0, failureCount: 0 };
  }

  // 過濾掉空的或無效的 token
  const validTokens = fcmTokens.filter(token => token && typeof token === 'string' && token.trim().length > 0);

  if (validTokens.length === 0) {
    console.warn('⚠️  沒有有效的 FCM Tokens');
    return { successCount: 0, failureCount: fcmTokens.length };
  }

  try {
    const message = {
      tokens: validTokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'medication_reminders',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`✅ 批量推送發送完成: ${response.successCount}/${validTokens.length} 成功`);

    // 處理失敗的 tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`❌ Token ${idx} 發送失敗:`, resp.error.message);
          if (resp.error.code === 'messaging/invalid-registration-token' ||
              resp.error.code === 'messaging/registration-token-not-registered') {
            failedTokens.push(validTokens[idx]);
          }
        }
      });

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens: failedTokens,
      };
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('❌ 批量推送通知發送失敗:', error.message);
    return {
      successCount: 0,
      failureCount: validTokens.length,
      error: error.message,
    };
  }
}

/**
 * 發送用藥提醒通知到長輩裝置
 *
 * @param {string} elderId - 長輩 ID
 * @param {Object} medicationInfo - 用藥資訊
 * @param {string} medicationInfo.medicationName - 藥物名稱
 * @param {string} medicationInfo.dosage - 劑量
 * @param {string} medicationInfo.scheduledTime - 預定時間
 * @returns {Promise<Object>} - 發送結果
 */
export async function sendMedicationReminder(elderId, medicationInfo) {
  try {
    // 從資料庫獲取長輩的 FCM tokens
    const { data: elder, error } = await supabase
      .from('elders')
      .select('fcm_token, name')
      .eq('id', elderId)
      .single();

    if (error || !elder) {
      console.error('❌ 無法找到長輩資料:', error?.message);
      return { success: false, error: 'Elder not found' };
    }

    if (!elder.fcm_token) {
      console.warn(`⚠️  長輩 ${elder.name} 沒有 FCM Token，無法發送推送`);
      return { success: false, error: 'No FCM token' };
    }

    const notification = {
      title: '💊 用藥提醒',
      body: `該服用 ${medicationInfo.medicationName} (${medicationInfo.dosage}) 了`,
    };

    const data = {
      type: 'medication_reminder',
      elderId: elderId,
      medicationId: medicationInfo.medicationId || '',
      scheduledTime: medicationInfo.scheduledTime,
    };

    return await sendPushNotification(elder.fcm_token, notification, data);
  } catch (error) {
    console.error('❌ 發送用藥提醒失敗:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 發送錯過用藥通知給家屬
 *
 * @param {string} elderId - 長輩 ID
 * @param {Object} medicationInfo - 用藥資訊
 * @returns {Promise<Object>} - 發送結果
 */
export async function notifyFamilyMissedMedication(elderId, medicationInfo) {
  try {
    // 獲取長輩資訊
    const { data: elder, error: elderError } = await supabase
      .from('elders')
      .select('name')
      .eq('id', elderId)
      .single();

    if (elderError || !elder) {
      console.error('❌ 無法找到長輩資料:', elderError?.message);
      return { success: false, error: 'Elder not found' };
    }

    // 獲取有權限的家屬 FCM tokens
    const { data: relations, error: relationsError } = await supabase
      .from('elder_family_relations')
      .select(`
        family_member_id,
        family_members!inner (
          fcm_token,
          name
        )
      `)
      .eq('elder_id', elderId)
      .eq('status', 'active')
      .eq('can_receive_alerts', true);

    if (relationsError) {
      console.error('❌ 無法獲取家屬關係:', relationsError.message);
      return { success: false, error: 'Failed to fetch family members' };
    }

    if (!relations || relations.length === 0) {
      console.warn(`⚠️  長輩 ${elder.name} 沒有可通知的家屬`);
      return { success: false, error: 'No family members to notify' };
    }

    // 收集有效的 FCM tokens
    const familyTokens = relations
      .map(rel => rel.family_members.fcm_token)
      .filter(token => token && token.trim().length > 0);

    if (familyTokens.length === 0) {
      console.warn(`⚠️  家屬都沒有 FCM Token，無法發送通知`);
      return { success: false, error: 'No valid FCM tokens' };
    }

    const notification = {
      title: '⚠️ 用藥提醒：未服藥',
      body: `${elder.name} 錯過了 ${medicationInfo.medicationName} 的服藥時間`,
    };

    const data = {
      type: 'missed_medication_alert',
      elderId: elderId,
      elderName: elder.name,
      medicationId: medicationInfo.medicationId || '',
      medicationName: medicationInfo.medicationName,
      scheduledTime: medicationInfo.scheduledTime,
    };

    return await sendMulticastPushNotification(familyTokens, notification, data);
  } catch (error) {
    console.error('❌ 發送家屬通知失敗:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 註冊或更新 FCM Token
 *
 * @param {string} userId - 使用者 ID
 * @param {string} userType - 使用者類型 ('elder' | 'family_member')
 * @param {string} fcmToken - FCM Token
 * @param {Object} deviceInfo - 裝置資訊 (optional)
 * @returns {Promise<Object>} - 更新結果
 */
export async function registerFCMToken(userId, userType, fcmToken, deviceInfo = {}) {
  try {
    const tableName = userType === 'elder' ? 'elders' : 'family_members';

    const { data, error } = await supabase
      .from(tableName)
      .update({
        fcm_token: fcmToken,
        fcm_token_updated_at: new Date().toISOString(),
        device_info: deviceInfo,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error(`❌ 更新 FCM Token 失敗 (${tableName}):`, error.message);
      return { success: false, error: error.message };
    }

    console.log(`✅ FCM Token 註冊成功 (${tableName}):`, userId);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 註冊 FCM Token 失敗:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 移除無效的 FCM Token
 *
 * @param {string} userId - 使用者 ID
 * @param {string} userType - 使用者類型
 * @returns {Promise<Object>} - 移除結果
 */
export async function removeFCMToken(userId, userType) {
  try {
    const tableName = userType === 'elder' ? 'elders' : 'family_members';

    const { error } = await supabase
      .from(tableName)
      .update({
        fcm_token: null,
        fcm_token_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error(`❌ 移除 FCM Token 失敗 (${tableName}):`, error.message);
      return { success: false, error: error.message };
    }

    console.log(`✅ FCM Token 移除成功 (${tableName}):`, userId);
    return { success: true };
  } catch (error) {
    console.error('❌ 移除 FCM Token 失敗:', error.message);
    return { success: false, error: error.message };
  }
}



/**
 * 發送 FCM 推播通知
 */
export async function sendFCMNotification({ token, title, body, data = {} }) {
  try {
    const message = {
      notification: { title, body },
      data: data,
      token: token
    };

    const response = await admin.messaging().send(message);
    console.log('✅ FCM 通知發送成功:', response);

    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ FCM 通知發送失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 批量發送 FCM 通知
 */
export async function sendBatchFCMNotifications({ tokens, title, body, data = {} }) {
  try {
    const message = {
      notification: { title, body },
      data: data,
      tokens: tokens
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`✅ 批量發送完成: ${response.successCount}/${tokens.length}`);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('❌ 批量發送失敗:', error);
    return { success: false, error: error.message };
  }
}

export default {
  sendPushNotification,
  sendMulticastPushNotification,
  sendMedicationReminder,
  notifyFamilyMissedMedication,
  registerFCMToken,
  removeFCMToken,
  sendFCMNotification,
  sendBatchFCMNotifications,
};
