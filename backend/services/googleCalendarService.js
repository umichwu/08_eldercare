/**
 * Google Calendar Service - 同步用藥提醒到 Google Calendar
 *
 * 功能：
 * - 建立 Google Calendar 事件
 * - 更新事件
 * - 刪除事件
 * - 批次同步用藥排程
 */

import { google } from 'googleapis';

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

export default {
  createMedicationEvent,
  batchCreateMedicationEvents,
  updateMedicationEvent,
  deleteMedicationEvent,
  batchDeleteMedicationEvents,
  getCalendarList
};
