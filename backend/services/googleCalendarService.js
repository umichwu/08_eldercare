/**
 * Google Calendar Service - 同步用藥提醒到 Google Calendar
 *
 * 功能：
 * - OAuth 授權管理
 * - 存儲和刷新 Access Token
 * - 建立 Google Calendar 事件（含週期性事件）
 * - 更新事件
 * - 刪除事件
 * - 批次同步用藥排程
 * - 自動同步用藥提醒
 */

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 載入環境變數
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
} else {
  dotenv.config();
}

// 使用懶加載方式創建 Supabase 客戶端
let supabase = null;
function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

// Google OAuth2 設定
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

/**
 * 建立 OAuth2 客戶端
 * @returns {Object} - OAuth2 客戶端
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * 建立 Google Calendar 客戶端
 * @param {string} accessToken - 用戶的 Google OAuth access token
 * @returns {Object} - Google Calendar API 客戶端
 */
function createCalendarClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.calendar({ version: 'v3', auth });
}

/**
 * 取得 Google OAuth 授權 URL
 * @param {string} userId - 使用者 ID
 * @returns {Object} - 授權 URL
 */
export async function getAuthUrl(userId) {
  try {
    const oauth2Client = createOAuth2Client();

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId,
      prompt: 'consent'
    });

    console.log('✅ Google OAuth URL 已生成');

    return {
      success: true,
      authUrl: authUrl
    };
  } catch (error) {
    console.error('❌ 生成授權 URL 失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 交換授權碼為 Access Token
 * @param {string} authCode - Google OAuth 授權碼
 * @param {string} userId - 使用者 ID
 * @returns {Object} - Token 資料
 */
export async function exchangeAuthCode(authCode, userId) {
  try {
    const oauth2Client = createOAuth2Client();
    const sb = getSupabase();

    console.log('🔄 交換授權碼為 Access Token...');

    const { tokens } = await oauth2Client.getToken(authCode);

    const expiresAt = new Date(Date.now() + (tokens.expiry_date || 3600000));

    const tokenData = {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt.toISOString(),
      token_type: tokens.token_type || 'Bearer',
      scope: tokens.scope
    };

    const { data, error } = await sb
      .from('google_calendar_tokens')
      .upsert(tokenData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ 儲存 Token 失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ Access Token 已儲存');

    return {
      success: true,
      data: {
        accessToken: tokens.access_token,
        expiresAt: expiresAt.toISOString()
      }
    };
  } catch (error) {
    console.error('❌ 交換授權碼失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 取得使用者的有效 Access Token（自動刷新過期的 Token）
 * @param {string} userId - 使用者 ID
 * @returns {Object} - Access Token
 */
export async function getValidAccessToken(userId) {
  try {
    const sb = getSupabase();

    const { data: tokenData, error } = await sb
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !tokenData) {
      console.log('⚠️ 找不到 Google Calendar Token');
      return {
        success: false,
        error: 'No token found',
        needsAuth: true
      };
    }

    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    if (expiresAt > now) {
      console.log('✅ Access Token 仍有效');
      return {
        success: true,
        accessToken: tokenData.access_token
      };
    }

    console.log('🔄 Access Token 已過期，刷新中...');

    return await refreshAccessToken(userId, tokenData.refresh_token);
  } catch (error) {
    console.error('❌ 取得 Access Token 失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 刷新 Access Token
 * @param {string} userId - 使用者 ID
 * @param {string} refreshToken - Refresh Token
 * @returns {Object} - 新的 Access Token
 */
export async function refreshAccessToken(userId, refreshToken) {
  try {
    const oauth2Client = createOAuth2Client();
    const sb = getSupabase();

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    const expiresAt = new Date(Date.now() + (credentials.expiry_date || 3600000));

    const { data, error } = await sb
      .from('google_calendar_tokens')
      .update({
        access_token: credentials.access_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ 更新 Token 失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ Access Token 已刷新');

    return {
      success: true,
      accessToken: credentials.access_token
    };
  } catch (error) {
    console.error('❌ 刷新 Token 失敗:', error.message);
    return {
      success: false,
      error: error.message,
      needsAuth: true
    };
  }
}

/**
 * 檢查使用者是否已授權 Google Calendar
 * @param {string} userId - 使用者 ID
 * @returns {Object} - 授權狀態
 */
export async function checkAuthStatus(userId) {
  try {
    const sb = getSupabase();

    const { data, error } = await sb
      .from('google_calendar_tokens')
      .select('user_id, expires_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {
        success: true,
        isAuthorized: false
      };
    }

    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    return {
      success: true,
      isAuthorized: true,
      expiresAt: data.expires_at,
      isExpired: expiresAt <= now
    };
  } catch (error) {
    console.error('❌ 檢查授權狀態失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 撤銷 Google Calendar 授權
 * @param {string} userId - 使用者 ID
 * @returns {Object} - 撤銷結果
 */
export async function revokeAuthorization(userId) {
  try {
    const sb = getSupabase();

    const { error } = await sb
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('❌ 撤銷授權失敗:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ Google Calendar 授權已撤銷');

    return {
      success: true,
      message: 'Authorization revoked'
    };
  } catch (error) {
    console.error('❌ 撤銷授權異常:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 建立單個用藥提醒事件
 * @param {string} accessToken - Google OAuth access token
 * @param {Object} eventData - 事件資料
 * @returns {Object} - 建立的事件
 */
export async function createMedicationEvent(accessToken, eventData) {
  try {
    const calendar = createCalendarClient(accessToken);

    const {
      medicationName,
      dosage,
      dateTime,
      label,
      instructions,
      elderId
    } = eventData;

    const event = {
      summary: `💊 ${medicationName}`,
      description: `
📋 用藥資訊
藥物名稱：${medicationName}
劑量：${dosage}
服用時機：${label}
${instructions ? `說明：${instructions}` : ''}

⏰ 請記得按時服藥
      `.trim(),
      start: {
        dateTime: dateTime,
        timeZone: 'Asia/Taipei',
      },
      end: {
        dateTime: new Date(new Date(dateTime).getTime() + 15 * 60000).toISOString(), // 15分鐘後
        timeZone: 'Asia/Taipei',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 0 },  // 準時提醒
          { method: 'popup', minutes: 15 }, // 提前15分鐘
        ],
      },
      colorId: '10', // 綠色（健康相關）
      extendedProperties: {
        private: {
          source: 'eldercare-app',
          elderId: elderId,
          medicationName: medicationName
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    console.log('✅ Google Calendar 事件已建立:', response.data.id);

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      data: response.data
    };

  } catch (error) {
    console.error('❌ 建立 Google Calendar 事件失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 批次建立多個用藥提醒事件
 * @param {string} accessToken - Google OAuth access token
 * @param {Array} schedules - 排程陣列
 * @param {Object} medicationInfo - 藥物資訊
 * @returns {Object} - 批次建立結果
 */
export async function batchCreateMedicationEvents(accessToken, schedules, medicationInfo) {
  try {
    const results = {
      success: [],
      failed: [],
      total: schedules.length
    };

    for (const schedule of schedules) {
      const eventData = {
        medicationName: medicationInfo.medicationName,
        dosage: medicationInfo.dosage,
        dateTime: schedule.dateTime.toISOString(),
        label: schedule.label,
        instructions: medicationInfo.instructions,
        elderId: medicationInfo.elderId
      };

      const result = await createMedicationEvent(accessToken, eventData);

      if (result.success) {
        results.success.push({
          scheduleTime: schedule.dateTime,
          eventId: result.eventId,
          htmlLink: result.htmlLink
        });
      } else {
        results.failed.push({
          scheduleTime: schedule.dateTime,
          error: result.error
        });
      }

      // 避免超過 Google API 速率限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ 批次建立完成: ${results.success.length}/${results.total} 成功`);

    return {
      success: true,
      results: results
    };

  } catch (error) {
    console.error('❌ 批次建立失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 更新 Google Calendar 事件
 * @param {string} accessToken - Google OAuth access token
 * @param {string} eventId - 事件 ID
 * @param {Object} updateData - 更新資料
 * @returns {Object} - 更新結果
 */
export async function updateMedicationEvent(accessToken, eventId, updateData) {
  try {
    const calendar = createCalendarClient(accessToken);

    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });

    // 更新事件資料
    const updatedEvent = {
      ...event.data,
      summary: updateData.medicationName ? `💊 ${updateData.medicationName}` : event.data.summary,
      description: updateData.description || event.data.description,
      start: updateData.dateTime ? {
        dateTime: updateData.dateTime,
        timeZone: 'Asia/Taipei'
      } : event.data.start,
      end: updateData.dateTime ? {
        dateTime: new Date(new Date(updateData.dateTime).getTime() + 15 * 60000).toISOString(),
        timeZone: 'Asia/Taipei'
      } : event.data.end
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: updatedEvent,
    });

    console.log('✅ Google Calendar 事件已更新:', eventId);

    return {
      success: true,
      eventId: response.data.id,
      data: response.data
    };

  } catch (error) {
    console.error('❌ 更新 Google Calendar 事件失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 刪除 Google Calendar 事件
 * @param {string} accessToken - Google OAuth access token
 * @param {string} eventId - 事件 ID
 * @returns {Object} - 刪除結果
 */
export async function deleteMedicationEvent(accessToken, eventId) {
  try {
    const calendar = createCalendarClient(accessToken);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    console.log('✅ Google Calendar 事件已刪除:', eventId);

    return {
      success: true,
      eventId: eventId
    };

  } catch (error) {
    console.error('❌ 刪除 Google Calendar 事件失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 批次刪除多個事件
 * @param {string} accessToken - Google OAuth access token
 * @param {Array} eventIds - 事件 ID 陣列
 * @returns {Object} - 批次刪除結果
 */
export async function batchDeleteMedicationEvents(accessToken, eventIds) {
  try {
    const results = {
      success: [],
      failed: [],
      total: eventIds.length
    };

    for (const eventId of eventIds) {
      const result = await deleteMedicationEvent(accessToken, eventId);

      if (result.success) {
        results.success.push(eventId);
      } else {
        results.failed.push({
          eventId: eventId,
          error: result.error
        });
      }

      // 避免超過 Google API 速率限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ 批次刪除完成: ${results.success.length}/${results.total} 成功`);

    return {
      success: true,
      results: results
    };

  } catch (error) {
    console.error('❌ 批次刪除失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 取得用戶的 Google Calendar 列表
 * @param {string} accessToken - Google OAuth access token
 * @returns {Object} - Calendar 列表
 */
export async function getCalendarList(accessToken) {
  try {
    const calendar = createCalendarClient(accessToken);

    const response = await calendar.calendarList.list();

    return {
      success: true,
      calendars: response.data.items
    };

  } catch (error) {
    console.error('❌ 取得 Calendar 列表失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 建立週期性用藥提醒事件
 * @param {string} accessToken - Google OAuth access token
 * @param {Object} reminderData - 提醒資料
 * @returns {Object} - 建立結果
 */
export async function createRecurringMedicationEvent(accessToken, reminderData) {
  try {
    const calendar = createCalendarClient(accessToken);

    const {
      medicationName,
      dosage,
      instructions,
      reminderTimes,
      elderId,
      medicationId
    } = reminderData;

    const results = [];

    for (const time of reminderTimes) {
      const startDate = new Date();
      const [hours, minutes] = time.time.split(':');
      startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const event = {
        summary: `💊 ${medicationName}`,
        description: `
📋 用藥資訊
藥物名稱：${medicationName}
劑量：${dosage}
服用時機：${time.label}
${instructions ? `說明：${instructions}` : ''}

⏰ 請記得按時服藥
        `.trim(),
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'Asia/Taipei',
        },
        end: {
          dateTime: new Date(startDate.getTime() + 15 * 60000).toISOString(),
          timeZone: 'Asia/Taipei',
        },
        recurrence: [
          'RRULE:FREQ=DAILY'
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 0 },
            { method: 'popup', minutes: 15 },
          ],
        },
        colorId: '10',
        extendedProperties: {
          private: {
            source: 'eldercare-app',
            elderId: elderId,
            medicationId: medicationId,
            medicationName: medicationName,
            timeLabel: time.label
          }
        }
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      console.log(`✅ 週期性事件已建立: ${time.label} - ${response.data.id}`);

      results.push({
        timeLabel: time.label,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      success: true,
      events: results
    };

  } catch (error) {
    console.error('❌ 建立週期性事件失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 同步單個用藥提醒到 Google Calendar
 * @param {string} userId - 使用者 ID
 * @param {string} medicationId - 藥物 ID
 * @returns {Object} - 同步結果
 */
export async function syncMedicationToCalendar(userId, medicationId) {
  try {
    const sb = getSupabase();

    console.log(`🔄 同步用藥提醒到 Google Calendar: ${medicationId}`);

    const tokenResult = await getValidAccessToken(userId);
    if (!tokenResult.success) {
      return {
        success: false,
        error: 'Not authorized',
        needsAuth: true
      };
    }

    const { data: medication, error: medError } = await sb
      .from('medications')
      .select('*, medication_reminders(*)')
      .eq('id', medicationId)
      .single();

    if (medError || !medication) {
      console.error('❌ 找不到藥物資料');
      return { success: false, error: 'Medication not found' };
    }

    const reminders = medication.medication_reminders;
    if (!reminders || reminders.length === 0) {
      console.log('⚠️ 此藥物沒有設定提醒');
      return { success: false, error: 'No reminders configured' };
    }

    const eventIds = [];

    for (const reminder of reminders) {
      if (!reminder.is_enabled) continue;

      const reminderData = {
        medicationName: medication.medication_name,
        dosage: medication.dosage,
        instructions: medication.instructions,
        reminderTimes: reminder.reminder_times || [],
        elderId: medication.elder_id,
        medicationId: medication.id
      };

      const result = await createRecurringMedicationEvent(
        tokenResult.accessToken,
        reminderData
      );

      if (result.success) {
        for (const event of result.events) {
          eventIds.push(event.eventId);
        }

        const calendarEventIds = result.events.map(e => e.eventId);
        await sb
          .from('medication_reminders')
          .update({
            calendar_event_id: calendarEventIds.join(','),
            updated_at: new Date().toISOString()
          })
          .eq('id', reminder.id);
      }
    }

    console.log(`✅ 同步完成: 已建立 ${eventIds.length} 個事件`);

    return {
      success: true,
      eventCount: eventIds.length,
      eventIds: eventIds
    };

  } catch (error) {
    console.error('❌ 同步用藥提醒失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 同步所有用藥提醒到 Google Calendar
 * @param {string} userId - 使用者 ID
 * @param {string} elderId - 長輩 ID
 * @returns {Object} - 同步結果
 */
export async function syncAllMedicationsToCalendar(userId, elderId) {
  try {
    const sb = getSupabase();

    console.log(`🔄 同步所有用藥提醒到 Google Calendar`);

    const tokenResult = await getValidAccessToken(userId);
    if (!tokenResult.success) {
      return {
        success: false,
        error: 'Not authorized',
        needsAuth: true
      };
    }

    const { data: medications, error: medError } = await sb
      .from('medications')
      .select('id')
      .eq('elder_id', elderId)
      .eq('status', 'active');

    if (medError) {
      console.error('❌ 查詢藥物失敗:', medError.message);
      return { success: false, error: medError.message };
    }

    if (!medications || medications.length === 0) {
      return {
        success: true,
        message: 'No medications to sync',
        syncedCount: 0
      };
    }

    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const medication of medications) {
      const result = await syncMedicationToCalendar(userId, medication.id);

      if (result.success) {
        successCount++;
        results.push({
          medicationId: medication.id,
          status: 'success',
          eventCount: result.eventCount
        });
      } else {
        failCount++;
        results.push({
          medicationId: medication.id,
          status: 'failed',
          error: result.error
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`✅ 批次同步完成: ${successCount} 成功, ${failCount} 失敗`);

    return {
      success: true,
      syncedCount: successCount,
      failedCount: failCount,
      results: results
    };

  } catch (error) {
    console.error('❌ 批次同步失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 刪除藥物的所有 Calendar 事件
 * @param {string} userId - 使用者 ID
 * @param {string} medicationId - 藥物 ID
 * @returns {Object} - 刪除結果
 */
export async function deleteMedicationCalendarEvents(userId, medicationId) {
  try {
    const sb = getSupabase();

    const tokenResult = await getValidAccessToken(userId);
    if (!tokenResult.success) {
      return {
        success: false,
        error: 'Not authorized',
        needsAuth: true
      };
    }

    const { data: reminders } = await sb
      .from('medication_reminders')
      .select('calendar_event_id')
      .eq('medication_id', medicationId);

    if (!reminders || reminders.length === 0) {
      return { success: true, message: 'No events to delete' };
    }

    const eventIds = [];
    for (const reminder of reminders) {
      if (reminder.calendar_event_id) {
        const ids = reminder.calendar_event_id.split(',');
        eventIds.push(...ids);
      }
    }

    if (eventIds.length === 0) {
      return { success: true, message: 'No events to delete' };
    }

    const result = await batchDeleteMedicationEvents(
      tokenResult.accessToken,
      eventIds
    );

    await sb
      .from('medication_reminders')
      .update({ calendar_event_id: null })
      .eq('medication_id', medicationId);

    console.log(`✅ 已刪除藥物的所有 Calendar 事件`);

    return result;

  } catch (error) {
    console.error('❌ 刪除 Calendar 事件失敗:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  getAuthUrl,
  exchangeAuthCode,
  getValidAccessToken,
  refreshAccessToken,
  checkAuthStatus,
  revokeAuthorization,
  createMedicationEvent,
  batchCreateMedicationEvents,
  createRecurringMedicationEvent,
  updateMedicationEvent,
  deleteMedicationEvent,
  batchDeleteMedicationEvents,
  getCalendarList,
  syncMedicationToCalendar,
  syncAllMedicationsToCalendar,
  deleteMedicationCalendarEvents
};
