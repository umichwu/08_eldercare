-- ============================================================================
-- ElderCare - 地理位置功能資料庫 Schema (FINAL)
-- ============================================================================
-- 版本: 2.2 FINAL (2025-01-27 修正版)
-- 修正：移除獨立的 RAISE NOTICE 語句，確保語法正確
-- ============================================================================

-- ============================================================================
-- STEP 1: 檢查依賴並清理舊資料
-- ============================================================================

DO $$
DECLARE
    missing_tables TEXT[];
BEGIN
    -- 檢查必要的資料表
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
        missing_tables := array_append(missing_tables, 'user_profiles');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'elders') THEN
        missing_tables := array_append(missing_tables, 'elders');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_members') THEN
        missing_tables := array_append(missing_tables, 'family_members');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'elder_family_relations') THEN
        missing_tables := array_append(missing_tables, 'elder_family_relations');
    END IF;

    -- 如果有缺失的資料表，拋出錯誤
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION '❌ 缺少必要的資料表: %', array_to_string(missing_tables, ', ');
    END IF;

    RAISE NOTICE '✅ 依賴檢查通過';
END $$;

-- 刪除函數（先刪除函數，避免依賴問題）
DROP FUNCTION IF EXISTS public.cleanup_old_location_history(INTEGER);
DROP FUNCTION IF EXISTS public.get_latest_location(UUID);
DROP FUNCTION IF EXISTS public.is_in_safe_zone(DECIMAL, DECIMAL, UUID);
DROP FUNCTION IF EXISTS public.calculate_distance(DECIMAL, DECIMAL, DECIMAL, DECIMAL);

-- 刪除表格（使用 CASCADE 會自動刪除觸發器）
DROP TABLE IF EXISTS public.family_geolocation_settings CASCADE;
DROP TABLE IF EXISTS public.geofence_alerts CASCADE;
DROP TABLE IF EXISTS public.location_history CASCADE;
DROP TABLE IF EXISTS public.safe_zones CASCADE;

-- ============================================================================
-- STEP 2: 創建資料表
-- ============================================================================

-- 1. 安全區域表
CREATE TABLE public.safe_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    center_latitude DECIMAL(10, 8) NOT NULL,
    center_longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    alert_on_exit BOOLEAN DEFAULT TRUE,
    alert_on_enter BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_radius CHECK (radius_meters > 0 AND radius_meters <= 10000)
);

-- 2. 位置記錄表
CREATE TABLE public.location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    altitude DECIMAL(8, 2),
    speed DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    address TEXT,
    city VARCHAR(100),
    district VARCHAR(100),
    country VARCHAR(100),
    battery_level INTEGER,
    is_manual BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_battery CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100))
);

-- 3. 地理圍欄警示表
CREATE TABLE public.geofence_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    safe_zone_id UUID REFERENCES public.safe_zones(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.location_history(id) ON DELETE SET NULL,
    alert_type VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    acknowledged_by UUID REFERENCES public.user_profiles(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_alert_type CHECK (alert_type IN ('exit', 'enter', 'sos', 'low_battery', 'inactive')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'acknowledged', 'resolved', 'false_alarm'))
);

-- 4. 家屬通知設定表
CREATE TABLE public.family_geolocation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    enable_exit_alerts BOOLEAN DEFAULT TRUE,
    enable_enter_alerts BOOLEAN DEFAULT FALSE,
    enable_sos_alerts BOOLEAN DEFAULT TRUE,
    enable_low_battery_alerts BOOLEAN DEFAULT TRUE,
    enable_inactive_alerts BOOLEAN DEFAULT TRUE,
    alert_methods JSONB DEFAULT '{"push": true, "email": false, "sms": false}'::jsonb,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    inactive_threshold_minutes INTEGER DEFAULT 120,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(family_member_id, elder_id)
);

-- ============================================================================
-- STEP 3: 創建索引
-- ============================================================================

CREATE INDEX idx_safe_zones_elder_id ON public.safe_zones(elder_id);
CREATE INDEX idx_safe_zones_active ON public.safe_zones(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_location_history_elder_id ON public.location_history(elder_id);
CREATE INDEX idx_location_history_recorded_at ON public.location_history(recorded_at DESC);
CREATE INDEX idx_location_history_elder_time ON public.location_history(elder_id, recorded_at DESC);
CREATE INDEX idx_geofence_alerts_elder_id ON public.geofence_alerts(elder_id);
CREATE INDEX idx_geofence_alerts_status ON public.geofence_alerts(status) WHERE status = 'pending';
CREATE INDEX idx_geofence_alerts_created_at ON public.geofence_alerts(created_at DESC);
CREATE INDEX idx_geofence_alerts_elder_status ON public.geofence_alerts(elder_id, status, created_at DESC);
CREATE INDEX idx_family_geolocation_settings_family ON public.family_geolocation_settings(family_member_id);
CREATE INDEX idx_family_geolocation_settings_elder ON public.family_geolocation_settings(elder_id);

-- ============================================================================
-- STEP 4: 創建函數
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_distance(
    lat1 DECIMAL, lon1 DECIMAL, lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    r DECIMAL := 6371000;
    dlat DECIMAL; dlon DECIMAL; a DECIMAL; c DECIMAL;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.is_in_safe_zone(
    p_latitude DECIMAL, p_longitude DECIMAL, p_elder_id UUID
) RETURNS TABLE(safe_zone_id UUID, safe_zone_name VARCHAR(100), distance_meters DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT sz.id, sz.name,
        public.calculate_distance(p_latitude, p_longitude, sz.center_latitude, sz.center_longitude) AS distance
    FROM public.safe_zones sz
    WHERE sz.elder_id = p_elder_id AND sz.is_active = TRUE
      AND public.calculate_distance(p_latitude, p_longitude, sz.center_latitude, sz.center_longitude) <= sz.radius_meters
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_latest_location(p_elder_id UUID)
RETURNS TABLE(latitude DECIMAL, longitude DECIMAL, address TEXT, recorded_at TIMESTAMPTZ, battery_level INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT lh.latitude, lh.longitude, lh.address, lh.recorded_at, lh.battery_level
    FROM public.location_history lh
    WHERE lh.elder_id = p_elder_id
    ORDER BY lh.recorded_at DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_old_location_history(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM public.location_history
    WHERE recorded_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND id NOT IN (
        SELECT DISTINCT ON (elder_id) id FROM public.location_history
        ORDER BY elder_id, recorded_at DESC
    );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: 創建觸發器
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_safe_zones_updated_at
    BEFORE UPDATE ON public.safe_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_geolocation_settings_updated_at
    BEFORE UPDATE ON public.family_geolocation_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: 啟用 RLS
-- ============================================================================

ALTER TABLE public.safe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_geolocation_settings ENABLE ROW LEVEL SECURITY;

-- safe_zones 政策
CREATE POLICY "family_can_manage_safe_zones" ON public.safe_zones FOR ALL USING (
    elder_id IN (
        SELECT efr.elder_id FROM public.elder_family_relations efr
        INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
        INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
    )
);

CREATE POLICY "elders_can_view_safe_zones" ON public.safe_zones FOR SELECT USING (
    elder_id IN (
        SELECT e.id FROM public.elders e
        INNER JOIN public.user_profiles up ON e.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
    )
);

-- location_history 政策
CREATE POLICY "family_can_view_location_history" ON public.location_history FOR SELECT USING (
    elder_id IN (
        SELECT efr.elder_id FROM public.elder_family_relations efr
        INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
        INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
    )
);

CREATE POLICY "elders_can_insert_location" ON public.location_history FOR INSERT WITH CHECK (
    elder_id IN (
        SELECT e.id FROM public.elders e
        INNER JOIN public.user_profiles up ON e.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
    )
);

CREATE POLICY "elders_can_view_own_location" ON public.location_history FOR SELECT USING (
    elder_id IN (
        SELECT e.id FROM public.elders e
        INNER JOIN public.user_profiles up ON e.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
    )
);

-- geofence_alerts 政策
CREATE POLICY "family_can_view_alerts" ON public.geofence_alerts FOR SELECT USING (
    elder_id IN (
        SELECT efr.elder_id FROM public.elder_family_relations efr
        INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
        INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
    )
);

CREATE POLICY "family_can_acknowledge_alerts" ON public.geofence_alerts FOR UPDATE USING (
    elder_id IN (
        SELECT efr.elder_id FROM public.elder_family_relations efr
        INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
        INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
    )
);

CREATE POLICY "elders_can_view_own_alerts" ON public.geofence_alerts FOR SELECT USING (
    elder_id IN (
        SELECT e.id FROM public.elders e
        INNER JOIN public.user_profiles up ON e.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
    )
);

-- family_geolocation_settings 政策
CREATE POLICY "family_can_manage_own_settings" ON public.family_geolocation_settings FOR ALL USING (
    family_member_id IN (
        SELECT fm.id FROM public.family_members fm
        INNER JOIN public.user_profiles up ON fm.user_profile_id = up.id
        WHERE up.auth_user_id = auth.uid()
    )
);

-- ============================================================================
-- 完成訊息
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ 地理位置功能資料庫 Schema 創建完成！      ║';
    RAISE NOTICE '╚════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📊 已創建 4 個資料表';
    RAISE NOTICE '🔒 已啟用 RLS (8 個政策)';
    RAISE NOTICE '⚙️ 已創建 4 個輔助函數';
    RAISE NOTICE '🔗 已創建 10 個索引';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 下一步：重新整理頁面測試位置追蹤功能';
    RAISE NOTICE '';
END $$;
