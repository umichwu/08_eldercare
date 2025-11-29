-- ============================================================================
-- ElderCare - 地理位置功能資料庫 Schema
-- ============================================================================
-- 版本: 2.0 (2025-01-27 更新)
-- 更新內容:
--   - 按照標準格式重新編寫，先清理舊資料
--   - 修正資料表名稱為 elder_family_relations
--   - 添加完整的錯誤處理和索引優化
-- ============================================================================
-- 功能：安全區域設定、位置追蹤、走失警示
-- ============================================================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 關閉 RLS（避免刪除時權限問題）
ALTER TABLE IF EXISTS public.family_geolocation_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.geofence_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.location_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.safe_zones DISABLE ROW LEVEL SECURITY;

-- 刪除觸發器
DROP TRIGGER IF EXISTS update_safe_zones_updated_at ON public.safe_zones;
DROP TRIGGER IF EXISTS update_family_geolocation_settings_updated_at ON public.family_geolocation_settings;

-- 刪除函數
DROP FUNCTION IF EXISTS public.cleanup_old_location_history(INTEGER);
DROP FUNCTION IF EXISTS public.get_latest_location(UUID);
DROP FUNCTION IF EXISTS public.is_in_safe_zone(DECIMAL, DECIMAL, UUID);
DROP FUNCTION IF EXISTS public.calculate_distance(DECIMAL, DECIMAL, DECIMAL, DECIMAL);

-- 刪除表格（依相依性順序）
DROP TABLE IF EXISTS public.family_geolocation_settings CASCADE;
DROP TABLE IF EXISTS public.geofence_alerts CASCADE;
DROP TABLE IF EXISTS public.location_history CASCADE;
DROP TABLE IF EXISTS public.safe_zones CASCADE;

-- ============================================================================
-- STEP 2: 創建資料表
-- ============================================================================

-- 1. 安全區域表 (safe_zones)
-- 儲存家屬為長輩設定的安全區域
CREATE TABLE IF NOT EXISTS public.safe_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,                    -- 區域名稱（如：家、社區活動中心）
    center_latitude DECIMAL(10, 8) NOT NULL,       -- 中心緯度
    center_longitude DECIMAL(11, 8) NOT NULL,      -- 中心經度
    radius_meters INTEGER NOT NULL DEFAULT 500,     -- 半徑（公尺）
    is_active BOOLEAN DEFAULT TRUE,                 -- 是否啟用
    alert_on_exit BOOLEAN DEFAULT TRUE,             -- 離開時是否警示
    alert_on_enter BOOLEAN DEFAULT FALSE,           -- 進入時是否警示
    description TEXT,                               -- 區域描述
    created_by UUID REFERENCES public.user_profiles(id),  -- 建立者
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_radius CHECK (radius_meters > 0 AND radius_meters <= 10000)
);

-- 2. 位置記錄表 (location_history)
-- 儲存長輩的位置歷史記錄
CREATE TABLE IF NOT EXISTS public.location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS public.geofence_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    safe_zone_id UUID REFERENCES public.safe_zones(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.location_history(id) ON DELETE SET NULL,
    alert_type VARCHAR(20) NOT NULL,                -- exit, enter, sos, low_battery, inactive
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    status VARCHAR(20) DEFAULT 'pending',           -- pending, acknowledged, resolved, false_alarm
    acknowledged_by UUID REFERENCES public.user_profiles(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    notes TEXT,                                     -- 處理備註
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_alert_type CHECK (alert_type IN ('exit', 'enter', 'sos', 'low_battery', 'inactive')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'acknowledged', 'resolved', 'false_alarm'))
);

-- 4. 家屬通知設定表 (family_geolocation_settings)
-- 儲存每位家屬的地理位置通知偏好
CREATE TABLE IF NOT EXISTS public.family_geolocation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
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

-- ============================================================================
-- STEP 3: 創建索引
-- ============================================================================

-- safe_zones 索引
CREATE INDEX IF NOT EXISTS idx_safe_zones_elder_id ON public.safe_zones(elder_id);
CREATE INDEX IF NOT EXISTS idx_safe_zones_active ON public.safe_zones(is_active) WHERE is_active = TRUE;

-- location_history 索引
CREATE INDEX IF NOT EXISTS idx_location_history_elder_id ON public.location_history(elder_id);
CREATE INDEX IF NOT EXISTS idx_location_history_recorded_at ON public.location_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_history_elder_time ON public.location_history(elder_id, recorded_at DESC);

-- geofence_alerts 索引
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_elder_id ON public.geofence_alerts(elder_id);
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_status ON public.geofence_alerts(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_created_at ON public.geofence_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_elder_status ON public.geofence_alerts(elder_id, status, created_at DESC);

-- family_geolocation_settings 索引
CREATE INDEX IF NOT EXISTS idx_family_geolocation_settings_family ON public.family_geolocation_settings(family_member_id);
CREATE INDEX IF NOT EXISTS idx_family_geolocation_settings_elder ON public.family_geolocation_settings(elder_id);

-- ============================================================================
-- STEP 4: 創建 Row Level Security (RLS) 政策
-- ============================================================================

-- 啟用 RLS
ALTER TABLE public.safe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_geolocation_settings ENABLE ROW LEVEL SECURITY;

-- ========================================
-- safe_zones 政策
-- ========================================

-- 家屬可以管理關聯長輩的安全區域
CREATE POLICY "family_can_manage_safe_zones" ON public.safe_zones
    FOR ALL
    USING (
        elder_id IN (
            SELECT efr.elder_id
            FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- 長輩可以查看自己的安全區域
CREATE POLICY "elders_can_view_safe_zones" ON public.safe_zones
    FOR SELECT
    USING (
        elder_id IN (
            SELECT e.id
            FROM public.elders e
            INNER JOIN public.user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- ========================================
-- location_history 政策
-- ========================================

-- 家屬可以查看關聯長輩的位置歷史
CREATE POLICY "family_can_view_location_history" ON public.location_history
    FOR SELECT
    USING (
        elder_id IN (
            SELECT efr.elder_id
            FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- 長輩可以新增自己的位置記錄
CREATE POLICY "elders_can_insert_location" ON public.location_history
    FOR INSERT
    WITH CHECK (
        elder_id IN (
            SELECT e.id
            FROM public.elders e
            INNER JOIN public.user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- 長輩可以查看自己的位置歷史
CREATE POLICY "elders_can_view_own_location" ON public.location_history
    FOR SELECT
    USING (
        elder_id IN (
            SELECT e.id
            FROM public.elders e
            INNER JOIN public.user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- ========================================
-- geofence_alerts 政策
-- ========================================

-- 家屬可以查看關聯長輩的警示
CREATE POLICY "family_can_view_alerts" ON public.geofence_alerts
    FOR SELECT
    USING (
        elder_id IN (
            SELECT efr.elder_id
            FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- 家屬可以確認/處理警示
CREATE POLICY "family_can_acknowledge_alerts" ON public.geofence_alerts
    FOR UPDATE
    USING (
        elder_id IN (
            SELECT efr.elder_id
            FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- 長輩可以查看自己的警示
CREATE POLICY "elders_can_view_own_alerts" ON public.geofence_alerts
    FOR SELECT
    USING (
        elder_id IN (
            SELECT e.id
            FROM public.elders e
            INNER JOIN public.user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- ========================================
-- family_geolocation_settings 政策
-- ========================================

-- 家屬可以管理自己的通知設定
CREATE POLICY "family_can_manage_own_settings" ON public.family_geolocation_settings
    FOR ALL
    USING (
        family_member_id IN (
            SELECT fm.id
            FROM public.family_members fm
            INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 5: 創建函數
-- ============================================================================

-- 計算兩點之間的距離（Haversine 公式，返回公尺）
CREATE OR REPLACE FUNCTION public.calculate_distance(
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
CREATE OR REPLACE FUNCTION public.is_in_safe_zone(
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
        public.calculate_distance(p_latitude, p_longitude, sz.center_latitude, sz.center_longitude) AS distance
    FROM public.safe_zones sz
    WHERE sz.elder_id = p_elder_id
      AND sz.is_active = TRUE
      AND public.calculate_distance(p_latitude, p_longitude, sz.center_latitude, sz.center_longitude) <= sz.radius_meters
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql;

-- 取得長輩的最新位置
CREATE OR REPLACE FUNCTION public.get_latest_location(p_elder_id UUID)
RETURNS TABLE(
    latitude DECIMAL,
    longitude DECIMAL,
    address TEXT,
    recorded_at TIMESTAMPTZ,
    battery_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lh.latitude,
        lh.longitude,
        lh.address,
        lh.recorded_at,
        lh.battery_level
    FROM public.location_history lh
    WHERE lh.elder_id = p_elder_id
    ORDER BY lh.recorded_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 清理超過 90 天的位置記錄（保留最近記錄）
CREATE OR REPLACE FUNCTION public.cleanup_old_location_history(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.location_history
    WHERE recorded_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND id NOT IN (
        -- 保留每個長輩的最新記錄
        SELECT DISTINCT ON (elder_id) id
        FROM public.location_history
        ORDER BY elder_id, recorded_at DESC
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: 創建觸發器
-- ============================================================================

-- 自動更新 updated_at 欄位的函數（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- safe_zones 的 updated_at 觸發器
CREATE TRIGGER update_safe_zones_updated_at
    BEFORE UPDATE ON public.safe_zones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- family_geolocation_settings 的 updated_at 觸發器
CREATE TRIGGER update_family_geolocation_settings_updated_at
    BEFORE UPDATE ON public.family_geolocation_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 完成
-- ============================================================================

-- 顯示成功訊息
DO $$
BEGIN
    RAISE NOTICE '✅ 地理位置功能資料庫 Schema 創建完成！';
    RAISE NOTICE '📊 已創建 4 個資料表：safe_zones, location_history, geofence_alerts, family_geolocation_settings';
    RAISE NOTICE '🔒 已啟用 Row Level Security (RLS)';
    RAISE NOTICE '⚙️ 已創建 4 個輔助函數';
    RAISE NOTICE '';
    RAISE NOTICE '下一步：請在應用程式中測試位置追蹤功能';
END $$;
