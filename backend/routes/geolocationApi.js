/**
 * 地理位置 API 路由
 * 功能：安全區域、位置追蹤、走失警示
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { sendPushNotification } from '../services/notificationService.js';

const router = express.Router();

// ================================================
// 安全區域 API
// ================================================

/**
 * GET /api/geolocation/safe-zones/elder/:elderId
 * 取得長輩的所有安全區域
 */
router.get('/safe-zones/elder/:elderId', async (req, res) => {
    try {
        const { elderId } = req.params;

        const { data, error } = await supabase
            .from('safe_zones')
            .select('*')
            .eq('elder_id', elderId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            safe_zones: data || []
        });
    } catch (error) {
        console.error('取得安全區域失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/geolocation/safe-zones
 * 建立新的安全區域
 */
router.post('/safe-zones', async (req, res) => {
    try {
        const {
            elder_id,
            name,
            center_latitude,
            center_longitude,
            radius_meters = 500,
            alert_on_exit = true,
            alert_on_enter = false,
            description,
            created_by
        } = req.body;

        // 驗證必要欄位
        if (!elder_id || !name || !center_latitude || !center_longitude) {
            return res.status(400).json({
                success: false,
                error: '缺少必要欄位'
            });
        }

        const { data, error } = await supabase
            .from('safe_zones')
            .insert({
                elder_id,
                name,
                center_latitude,
                center_longitude,
                radius_meters,
                alert_on_exit,
                alert_on_enter,
                description,
                created_by
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            safe_zone: data
        });
    } catch (error) {
        console.error('建立安全區域失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/geolocation/safe-zones/:zoneId
 * 更新安全區域
 */
router.put('/safe-zones/:zoneId', async (req, res) => {
    try {
        const { zoneId } = req.params;
        const updateData = req.body;

        const { data, error } = await supabase
            .from('safe_zones')
            .update(updateData)
            .eq('id', zoneId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            safe_zone: data
        });
    } catch (error) {
        console.error('更新安全區域失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/geolocation/safe-zones/:zoneId
 * 刪除安全區域
 */
router.delete('/safe-zones/:zoneId', async (req, res) => {
    try {
        const { zoneId } = req.params;

        const { error } = await supabase
            .from('safe_zones')
            .delete()
            .eq('id', zoneId);

        if (error) throw error;

        res.json({
            success: true,
            message: '安全區域已刪除'
        });
    } catch (error) {
        console.error('刪除安全區域失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ================================================
// 位置追蹤 API
// ================================================

/**
 * POST /api/geolocation/location
 * 記錄長輩位置（並檢查安全區域）
 */
router.post('/location', async (req, res) => {
    try {
        const {
            elder_id,
            latitude,
            longitude,
            accuracy,
            altitude,
            speed,
            heading,
            address,
            city,
            district,
            country,
            battery_level,
            is_manual = false
        } = req.body;

        // 驗證必要欄位
        if (!elder_id || latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                error: '缺少必要欄位'
            });
        }

        // 1. 儲存位置記錄
        const { data: locationData, error: locationError } = await supabase
            .from('location_history')
            .insert({
                elder_id,
                latitude,
                longitude,
                accuracy,
                altitude,
                speed,
                heading,
                address,
                city,
                district,
                country,
                battery_level,
                is_manual
            })
            .select()
            .single();

        if (locationError) throw locationError;

        // 2. 檢查是否在安全區域內
        const { data: safeZoneCheck, error: checkError } = await supabase
            .rpc('is_in_safe_zone', {
                p_latitude: latitude,
                p_longitude: longitude,
                p_elder_id: elder_id
            });

        if (checkError) {
            console.error('安全區域檢查失敗:', checkError);
        }

        // 3. 取得所有啟用的安全區域
        const { data: allSafeZones, error: zonesError } = await supabase
            .from('safe_zones')
            .select('*')
            .eq('elder_id', elder_id)
            .eq('is_active', true);

        if (zonesError) {
            console.error('取得安全區域失敗:', zonesError);
        }

        // 4. 檢查是否需要觸發警示
        const alerts = [];
        const inSafeZoneIds = (safeZoneCheck || []).map(z => z.safe_zone_id);

        for (const zone of (allSafeZones || [])) {
            const isInZone = inSafeZoneIds.includes(zone.id);

            // 離開安全區域警示
            if (!isInZone && zone.alert_on_exit) {
                const alert = await createGeofenceAlert({
                    elder_id,
                    safe_zone_id: zone.id,
                    location_id: locationData.id,
                    alert_type: 'exit',
                    latitude,
                    longitude,
                    address
                });
                alerts.push(alert);

                // 發送通知給家屬
                await notifyFamilyMembers(elder_id, 'exit', zone, locationData);
            }

            // 進入安全區域警示
            if (isInZone && zone.alert_on_enter) {
                const alert = await createGeofenceAlert({
                    elder_id,
                    safe_zone_id: zone.id,
                    location_id: locationData.id,
                    alert_type: 'enter',
                    latitude,
                    longitude,
                    address
                });
                alerts.push(alert);

                // 發送通知給家屬
                await notifyFamilyMembers(elder_id, 'enter', zone, locationData);
            }
        }

        // 5. 檢查低電量警示
        if (battery_level !== null && battery_level < 20) {
            const alert = await createGeofenceAlert({
                elder_id,
                location_id: locationData.id,
                alert_type: 'low_battery',
                latitude,
                longitude,
                address
            });
            alerts.push(alert);

            await notifyFamilyMembers(elder_id, 'low_battery', null, locationData);
        }

        res.json({
            success: true,
            location: locationData,
            in_safe_zones: safeZoneCheck || [],
            alerts_triggered: alerts
        });
    } catch (error) {
        console.error('記錄位置失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/geolocation/location/elder/:elderId
 * 取得長輩的位置歷史
 */
router.get('/location/elder/:elderId', async (req, res) => {
    try {
        const { elderId } = req.params;
        const { limit = 50, since } = req.query;

        let query = supabase
            .from('location_history')
            .select('*')
            .eq('elder_id', elderId)
            .order('recorded_at', { ascending: false })
            .limit(parseInt(limit));

        if (since) {
            query = query.gte('recorded_at', since);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            locations: data || []
        });
    } catch (error) {
        console.error('取得位置歷史失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/geolocation/location/latest/:elderId
 * 取得長輩的最新位置
 */
router.get('/location/latest/:elderId', async (req, res) => {
    try {
        const { elderId } = req.params;

        const { data, error } = await supabase
            .rpc('get_latest_location', {
                p_elder_id: elderId
            });

        if (error) throw error;

        res.json({
            success: true,
            location: data && data.length > 0 ? data[0] : null
        });
    } catch (error) {
        console.error('取得最新位置失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ================================================
// 警示 API
// ================================================

/**
 * GET /api/geolocation/alerts/elder/:elderId
 * 取得長輩的警示記錄
 */
router.get('/alerts/elder/:elderId', async (req, res) => {
    try {
        const { elderId } = req.params;
        const { status, limit = 50 } = req.query;

        let query = supabase
            .from('geofence_alerts')
            .select(`
                *,
                safe_zones (name, radius_meters)
            `)
            .eq('elder_id', elderId)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            alerts: data || []
        });
    } catch (error) {
        console.error('取得警示記錄失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/geolocation/alerts/:alertId/acknowledge
 * 確認警示
 */
router.put('/alerts/:alertId/acknowledge', async (req, res) => {
    try {
        const { alertId } = req.params;
        const { acknowledged_by } = req.body;

        const { data, error } = await supabase
            .from('geofence_alerts')
            .update({
                status: 'acknowledged',
                acknowledged_by,
                acknowledged_at: new Date().toISOString()
            })
            .eq('id', alertId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            alert: data
        });
    } catch (error) {
        console.error('確認警示失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/geolocation/alerts/:alertId/resolve
 * 解決警示
 */
router.put('/alerts/:alertId/resolve', async (req, res) => {
    try {
        const { alertId } = req.params;
        const { notes } = req.body;

        const { data, error } = await supabase
            .from('geofence_alerts')
            .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                notes
            })
            .eq('id', alertId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            alert: data
        });
    } catch (error) {
        console.error('解決警示失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/geolocation/alerts/sos
 * 緊急求助按鈕
 */
router.post('/alerts/sos', async (req, res) => {
    try {
        const {
            elder_id,
            latitude,
            longitude,
            address
        } = req.body;

        // 1. 建立 SOS 警示
        const alert = await createGeofenceAlert({
            elder_id,
            alert_type: 'sos',
            latitude,
            longitude,
            address
        });

        // 2. 立即通知所有家屬（高優先級）
        await notifyFamilyMembers(elder_id, 'sos', null, {
            latitude,
            longitude,
            address
        });

        res.json({
            success: true,
            alert,
            message: '緊急求助已發送'
        });
    } catch (error) {
        console.error('SOS 警示失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ================================================
// 家屬通知設定 API
// ================================================

/**
 * GET /api/geolocation/settings/:familyMemberId/:elderId
 * 取得家屬的通知設定
 */
router.get('/settings/:familyMemberId/:elderId', async (req, res) => {
    try {
        const { familyMemberId, elderId } = req.params;

        const { data, error } = await supabase
            .from('family_geolocation_settings')
            .select('*')
            .eq('family_member_id', familyMemberId)
            .eq('elder_id', elderId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            throw error;
        }

        res.json({
            success: true,
            settings: data || getDefaultSettings(familyMemberId, elderId)
        });
    } catch (error) {
        console.error('取得通知設定失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/geolocation/settings/:familyMemberId/:elderId
 * 更新家屬的通知設定
 */
router.put('/settings/:familyMemberId/:elderId', async (req, res) => {
    try {
        const { familyMemberId, elderId } = req.params;
        const settings = req.body;

        const { data, error } = await supabase
            .from('family_geolocation_settings')
            .upsert({
                family_member_id: familyMemberId,
                elder_id: elderId,
                ...settings
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            settings: data
        });
    } catch (error) {
        console.error('更新通知設定失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ================================================
// 輔助函數
// ================================================

/**
 * 建立地理圍欄警示
 */
async function createGeofenceAlert({
    elder_id,
    safe_zone_id = null,
    location_id = null,
    alert_type,
    latitude,
    longitude,
    address
}) {
    const { data, error } = await supabase
        .from('geofence_alerts')
        .insert({
            elder_id,
            safe_zone_id,
            location_id,
            alert_type,
            latitude,
            longitude,
            address
        })
        .select()
        .single();

    if (error) {
        console.error('建立警示失敗:', error);
        throw error;
    }

    return data;
}

/**
 * 通知家屬成員
 */
async function notifyFamilyMembers(elderId, alertType, safeZone, locationData) {
    try {
        // 1. 取得長輩資料
        const { data: elder, error: elderError } = await supabase
            .from('elders')
            .select('name, user_profile_id')
            .eq('id', elderId)
            .single();

        if (elderError) throw elderError;

        // 2. 取得所有家屬
        const { data: relationships, error: relError } = await supabase
            .from('elder_family_relationships')
            .select(`
                family_member_id,
                family_members (
                    user_profile_id,
                    user_profiles (fcm_token, email, phone)
                )
            `)
            .eq('elder_id', elderId);

        if (relError) throw relError;

        // 3. 組成通知訊息
        let title, body;

        switch (alertType) {
            case 'exit':
                title = '🚨 離開安全區域';
                body = `${elder.name} 已離開 ${safeZone.name}`;
                break;
            case 'enter':
                title = '✅ 進入安全區域';
                body = `${elder.name} 已進入 ${safeZone.name}`;
                break;
            case 'sos':
                title = '🆘 緊急求助';
                body = `${elder.name} 發出緊急求助！位置：${locationData.address || '未知'}`;
                break;
            case 'low_battery':
                title = '🔋 電量不足';
                body = `${elder.name} 的裝置電量低於 20%`;
                break;
            default:
                title = '⚠️ 位置警示';
                body = `${elder.name} 的位置有異常`;
        }

        // 4. 發送推播通知
        for (const rel of relationships) {
            const fcmToken = rel.family_members?.user_profiles?.fcm_token;
            if (fcmToken) {
                await sendPushNotification(fcmToken, title, body, {
                    type: 'geolocation_alert',
                    alert_type: alertType,
                    elder_id: elderId,
                    latitude: locationData.latitude,
                    longitude: locationData.longitude
                });
            }
        }

        console.log(`✅ 已通知 ${relationships.length} 位家屬成員`);
    } catch (error) {
        console.error('通知家屬失敗:', error);
    }
}

/**
 * 取得預設通知設定
 */
function getDefaultSettings(familyMemberId, elderId) {
    return {
        family_member_id: familyMemberId,
        elder_id: elderId,
        enable_exit_alerts: true,
        enable_enter_alerts: false,
        enable_sos_alerts: true,
        enable_low_battery_alerts: true,
        enable_inactive_alerts: true,
        alert_methods: {
            push: true,
            email: false,
            sms: false
        },
        inactive_threshold_minutes: 120
    };
}

export default router;
