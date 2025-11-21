-- ================================================
-- 地理位置功能資料庫 Schema
-- 功能：安全區域設定、位置追蹤、走失警示
-- ================================================

-- 1. 安全區域表 (safe_zones)
-- 儲存家屬為長輩設定的安全區域
CREATE TABLE IF NOT EXISTS safe_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,                    -- 區域名稱（如：家、社區活動中心）
    center_latitude DECIMAL(10, 8) NOT NULL,       -- 中心緯度
    center_longitude DECIMAL(11, 8) NOT NULL,      -- 中心經度
    radius_meters INTEGER NOT NULL DEFAULT 500,     -- 半徑（公尺）
    is_active BOOLEAN DEFAULT TRUE,                 -- 是否啟用
    alert_on_exit BOOLEAN DEFAULT TRUE,             -- 離開時是否警示
    alert_on_enter BOOLEAN DEFAULT FALSE,           -- 進入時是否警示
    description TEXT,                               -- 區域描述
    created_by UUID REFERENCES user_profiles(id),  -- 建立者
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_radius CHECK (radius_meters > 0 AND radius_meters <= 10000)
);

-- 2. 位置記錄表 (location_history)
-- 儲存長輩的位置歷史記錄
CREATE TABLE IF NOT EXISTS location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),                         -- 精確度（公尺）
    altitude DECIMAL(8, 2),                         -- 海拔（公尺）
    speed DECIMAL(6, 2),                            -- 速度（m/s）
    heading DECIMAL(5, 2),                          -- 方向（度）
    address TEXT,                                   -- 地址（反向地理編碼結果）
    city VARCHAR(100),                              -- 城市
    district VARCHAR(100),                          -- 區域
    country VARCHAR(100),                           -- 國家
    battery_level INTEGER,                          -- 電池電量（%）
    is_manual BOOLEAN DEFAULT FALSE,                -- 是否手動回報
    recorded_at TIMESTAMPTZ DEFAULT NOW(),          -- 記錄時間
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_battery CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100))
);

-- 3. 地理圍欄警示表 (geofence_alerts)
-- 儲存安全區域相關的警示記錄
CREATE TABLE IF NOT EXISTS geofence_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
    safe_zone_id UUID REFERENCES safe_zones(id) ON DELETE SET NULL,
    location_id UUID REFERENCES location_history(id) ON DELETE SET NULL,
    alert_type VARCHAR(20) NOT NULL,                -- exit, enter, sos
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    status VARCHAR(20) DEFAULT 'pending',           -- pending, acknowledged, resolved
    acknowledged_by UUID REFERENCES user_profiles(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    notes TEXT,                                     -- 處理備註
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_alert_type CHECK (alert_type IN ('exit', 'enter', 'sos', 'low_battery', 'inactive')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'acknowledged', 'resolved', 'false_alarm'))
);

-- 4. 家屬通知設定表 (family_geolocation_settings)
-- 儲存每位家屬的地理位置通知偏好
CREATE TABLE IF NOT EXISTS family_geolocation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
    enable_exit_alerts BOOLEAN DEFAULT TRUE,        -- 啟用離開警示
    enable_enter_alerts BOOLEAN DEFAULT FALSE,      -- 啟用進入警示
    enable_sos_alerts BOOLEAN DEFAULT TRUE,         -- 啟用緊急求助警示
    enable_low_battery_alerts BOOLEAN DEFAULT TRUE, -- 啟用低電量警示
    enable_inactive_alerts BOOLEAN DEFAULT TRUE,    -- 啟用無活動警示
    alert_methods JSONB DEFAULT '{"push": true, "email": false, "sms": false}'::jsonb,
    quiet_hours_start TIME,                         -- 安靜時段開始
    quiet_hours_end TIME,                           -- 安靜時段結束
    inactive_threshold_minutes INTEGER DEFAULT 120, -- 無活動警示閾值（分鐘）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(family_member_id, elder_id)
);

-- ================================================
-- 索引優化
-- ================================================

-- safe_zones 索引
CREATE INDEX idx_safe_zones_elder_id ON safe_zones(elder_id);
CREATE INDEX idx_safe_zones_active ON safe_zones(is_active) WHERE is_active = TRUE;

-- location_history 索引
CREATE INDEX idx_location_history_elder_id ON location_history(elder_id);
CREATE INDEX idx_location_history_recorded_at ON location_history(recorded_at DESC);
CREATE INDEX idx_location_history_elder_time ON location_history(elder_id, recorded_at DESC);

-- 空間索引（使用 PostGIS 擴充）
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- ALTER TABLE location_history ADD COLUMN geom GEOMETRY(Point, 4326);
-- CREATE INDEX idx_location_history_geom ON location_history USING GIST(geom);

-- geofence_alerts 索引
CREATE INDEX idx_geofence_alerts_elder_id ON geofence_alerts(elder_id);
CREATE INDEX idx_geofence_alerts_status ON geofence_alerts(status) WHERE status = 'pending';
CREATE INDEX idx_geofence_alerts_created_at ON geofence_alerts(created_at DESC);
CREATE INDEX idx_geofence_alerts_elder_status ON geofence_alerts(elder_id, status, created_at DESC);

-- family_geolocation_settings 索引
CREATE INDEX idx_family_geolocation_settings_family ON family_geolocation_settings(family_member_id);
CREATE INDEX idx_family_geolocation_settings_elder ON family_geolocation_settings(elder_id);

-- ================================================
-- Row Level Security (RLS) 政策
-- ================================================

-- 啟用 RLS
ALTER TABLE safe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_geolocation_settings ENABLE ROW LEVEL SECURITY;

-- safe_zones 政策
CREATE POLICY "family_can_manage_safe_zones" ON safe_zones
    FOR ALL
    USING (
        elder_id IN (
            SELECT elder_id FROM elder_family_relationships
            WHERE family_member_id IN (
                SELECT id FROM family_members
                WHERE user_profile_id = auth.uid()
            )
        )
    );

CREATE POLICY "elders_can_view_safe_zones" ON safe_zones
    FOR SELECT
    USING (
        elder_id IN (
            SELECT id FROM elders
            WHERE user_profile_id = auth.uid()
        )
    );

-- location_history 政策
CREATE POLICY "family_can_view_location_history" ON location_history
    FOR SELECT
    USING (
        elder_id IN (
            SELECT elder_id FROM elder_family_relationships
            WHERE family_member_id IN (
                SELECT id FROM family_members
                WHERE user_profile_id = auth.uid()
            )
        )
    );

CREATE POLICY "elders_can_insert_location" ON location_history
    FOR INSERT
    WITH CHECK (
        elder_id IN (
            SELECT id FROM elders
            WHERE user_profile_id = auth.uid()
        )
    );

CREATE POLICY "elders_can_view_own_location" ON location_history
    FOR SELECT
    USING (
        elder_id IN (
            SELECT id FROM elders
            WHERE user_profile_id = auth.uid()
        )
    );

-- geofence_alerts 政策
CREATE POLICY "family_can_view_alerts" ON geofence_alerts
    FOR SELECT
    USING (
        elder_id IN (
            SELECT elder_id FROM elder_family_relationships
            WHERE family_member_id IN (
                SELECT id FROM family_members
                WHERE user_profile_id = auth.uid()
            )
        )
    );

CREATE POLICY "family_can_acknowledge_alerts" ON geofence_alerts
    FOR UPDATE
    USING (
        elder_id IN (
            SELECT elder_id FROM elder_family_relationships
            WHERE family_member_id IN (
                SELECT id FROM family_members
                WHERE user_profile_id = auth.uid()
            )
        )
    );

-- family_geolocation_settings 政策
CREATE POLICY "family_can_manage_own_settings" ON family_geolocation_settings
    FOR ALL
    USING (
        family_member_id IN (
            SELECT id FROM family_members
            WHERE user_profile_id = auth.uid()
        )
    );

-- ================================================
-- 輔助函數
-- ================================================

-- 計算兩點之間的距離（Haversine 公式，返回公尺）
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL,
    lon1 DECIMAL,
    lat2 DECIMAL,
    lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    r DECIMAL := 6371000; -- 地球半徑（公尺）
    dlat DECIMAL;
    dlon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat/2) * sin(dlat/2) +
         cos(radians(lat1)) * cos(radians(lat2)) *
         sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 檢查位置是否在安全區域內
CREATE OR REPLACE FUNCTION is_in_safe_zone(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_elder_id UUID
) RETURNS TABLE(
    safe_zone_id UUID,
    safe_zone_name VARCHAR(100),
    distance_meters DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sz.id,
        sz.name,
        calculate_distance(p_latitude, p_longitude, sz.center_latitude, sz.center_longitude) AS distance
    FROM safe_zones sz
    WHERE sz.elder_id = p_elder_id
      AND sz.is_active = TRUE
      AND calculate_distance(p_latitude, p_longitude, sz.center_latitude, sz.center_longitude) <= sz.radius_meters
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql;

-- 取得長輩的最新位置
CREATE OR REPLACE FUNCTION get_latest_location(p_elder_id UUID)
RETURNS TABLE(
    latitude DECIMAL,
    longitude DECIMAL,
    address TEXT,
    recorded_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lh.latitude,
        lh.longitude,
        lh.address,
        lh.recorded_at
    FROM location_history lh
    WHERE lh.elder_id = p_elder_id
    ORDER BY lh.recorded_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 觸發器：自動更新 updated_at
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_safe_zones_updated_at
    BEFORE UPDATE ON safe_zones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_geolocation_settings_updated_at
    BEFORE UPDATE ON family_geolocation_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 範例資料（開發測試用）
-- ================================================

-- 注意：實際部署時請移除此段或使用條件判斷
/*
-- 假設已有長輩 ID 和家屬 ID
INSERT INTO safe_zones (elder_id, name, center_latitude, center_longitude, radius_meters, description)
VALUES
    ('elder-uuid-here', '家', 25.0330, 121.5654, 300, '長輩的住家'),
    ('elder-uuid-here', '社區活動中心', 25.0350, 121.5670, 500, '常去的活動中心');
*/

-- ================================================
-- 清理舊資料的維護函數
-- ================================================

-- 清理超過 90 天的位置記錄（保留最近記錄）
CREATE OR REPLACE FUNCTION cleanup_old_location_history(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM location_history
    WHERE recorded_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND id NOT IN (
        -- 保留每個長輩的最新記錄
        SELECT DISTINCT ON (elder_id) id
        FROM location_history
        ORDER BY elder_id, recorded_at DESC
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 可以使用 pg_cron 擴充定期執行清理
-- SELECT cron.schedule('cleanup-old-locations', '0 2 * * 0', 'SELECT cleanup_old_location_history(90)');
