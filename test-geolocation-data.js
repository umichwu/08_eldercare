/**
 * 地理位置功能測試資料腳本
 * 用途：為開發測試建立範例資料
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rxquczgjsgkeqemhngnb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // 需要 service key 才能繞過 RLS

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupTestData() {
    console.log('🚀 開始建立地理位置測試資料...\n');

    try {
        // 1. 取得一個測試長輩
        const { data: elders, error: elderError } = await supabase
            .from('elders')
            .select('id, name')
            .limit(1);

        if (elderError || !elders || elders.length === 0) {
            console.error('❌ 找不到長輩資料，請先建立長輩帳號');
            return;
        }

        const testElder = elders[0];
        console.log(`✅ 使用測試長輩: ${testElder.name} (${testElder.id})`);

        // 2. 建立安全區域
        console.log('\n📍 建立安全區域...');

        const safeZones = [
            {
                elder_id: testElder.id,
                name: '家',
                center_latitude: 25.0330,
                center_longitude: 121.5654,
                radius_meters: 300,
                alert_on_exit: true,
                alert_on_enter: false,
                description: '長輩的住家'
            },
            {
                elder_id: testElder.id,
                name: '社區活動中心',
                center_latitude: 25.0350,
                center_longitude: 121.5670,
                radius_meters: 500,
                alert_on_exit: true,
                alert_on_enter: true,
                description: '常去的活動中心'
            },
            {
                elder_id: testElder.id,
                name: '公園',
                center_latitude: 25.0320,
                center_longitude: 121.5640,
                radius_meters: 400,
                alert_on_exit: false,
                alert_on_enter: true,
                description: '早晨運動的公園'
            }
        ];

        const { data: createdZones, error: zoneError } = await supabase
            .from('safe_zones')
            .insert(safeZones)
            .select();

        if (zoneError) {
            console.error('❌ 建立安全區域失敗:', zoneError);
            return;
        }

        console.log(`✅ 已建立 ${createdZones.length} 個安全區域`);
        createdZones.forEach(zone => {
            console.log(`   - ${zone.name} (半徑 ${zone.radius_meters}m)`);
        });

        // 3. 建立位置記錄
        console.log('\n📍 建立位置歷史記錄...');

        const now = new Date();
        const locationHistory = [];

        // 建立最近 24 小時的位置記錄（每 2 小時一筆）
        for (let i = 0; i < 12; i++) {
            const timeOffset = i * 2 * 60 * 60 * 1000; // 2 小時
            const recordedAt = new Date(now.getTime() - timeOffset);

            // 模擬在家附近移動
            const latOffset = (Math.random() - 0.5) * 0.005; // ±0.005 度 (~500m)
            const lngOffset = (Math.random() - 0.5) * 0.005;

            locationHistory.push({
                elder_id: testElder.id,
                latitude: 25.0330 + latOffset,
                longitude: 121.5654 + lngOffset,
                accuracy: Math.random() * 20 + 10, // 10-30m
                battery_level: Math.max(20, 100 - (i * 5)), // 電量逐漸下降
                address: `台北市大安區${i % 2 === 0 ? '和平東路' : '復興南路'}`,
                city: '台北市',
                district: '大安區',
                country: '台灣',
                recorded_at: recordedAt.toISOString(),
                is_manual: false
            });
        }

        const { data: createdHistory, error: historyError } = await supabase
            .from('location_history')
            .insert(locationHistory)
            .select();

        if (historyError) {
            console.error('❌ 建立位置記錄失敗:', historyError);
            return;
        }

        console.log(`✅ 已建立 ${createdHistory.length} 筆位置記錄`);

        // 4. 建立地理圍欄警示
        console.log('\n🚨 建立地理圍欄警示...');

        const alerts = [
            {
                elder_id: testElder.id,
                safe_zone_id: createdZones[0].id, // 家
                alert_type: 'exit',
                latitude: 25.0360,
                longitude: 121.5680,
                address: '台北市大安區忠孝東路',
                status: 'resolved',
                created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString() // 3 小時前
            },
            {
                elder_id: testElder.id,
                safe_zone_id: createdZones[1].id, // 活動中心
                alert_type: 'enter',
                latitude: 25.0350,
                longitude: 121.5670,
                address: '台北市大安區社區活動中心',
                status: 'acknowledged',
                created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() // 2 小時前
            },
            {
                elder_id: testElder.id,
                alert_type: 'low_battery',
                latitude: 25.0330,
                longitude: 121.5654,
                address: '台北市大安區和平東路',
                status: 'pending',
                created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString() // 30 分鐘前
            }
        ];

        const { data: createdAlerts, error: alertError } = await supabase
            .from('geofence_alerts')
            .insert(alerts)
            .select();

        if (alertError) {
            console.error('❌ 建立警示失敗:', alertError);
            return;
        }

        console.log(`✅ 已建立 ${createdAlerts.length} 個警示`);
        createdAlerts.forEach(alert => {
            console.log(`   - ${alert.alert_type} (${alert.status})`);
        });

        // 5. 總結
        console.log('\n✅ 測試資料建立完成！');
        console.log('\n📊 資料統計:');
        console.log(`   - 長輩: ${testElder.name}`);
        console.log(`   - 安全區域: ${createdZones.length} 個`);
        console.log(`   - 位置記錄: ${createdHistory.length} 筆`);
        console.log(`   - 地理圍欄警示: ${createdAlerts.length} 個`);

        console.log('\n🔗 測試步驟:');
        console.log('   1. 訪問 family-dashboard.html');
        console.log('   2. 切換到「📍 位置追蹤」標籤');
        console.log('   3. 點擊「⚙️ 管理安全區域」進入 geolocation.html');
        console.log('   4. 查看地圖、安全區域、警示記錄');

    } catch (error) {
        console.error('❌ 執行錯誤:', error);
    }
}

// 執行
setupTestData();
