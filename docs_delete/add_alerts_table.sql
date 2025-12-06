-- ============================================================================
-- 警示系統資料庫表
-- 用於家屬監控面板的警示功能
-- ============================================================================

-- 1. 建立 alerts 表（警示記錄）
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elder_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('medication', 'health', 'activity', 'emergency', 'vital_signs')),
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'dismissed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolution_note TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_alerts_elder_id ON public.alerts(elder_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_elder_status ON public.alerts(elder_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_elder_created ON public.alerts(elder_id, created_at DESC);

-- 3. 建立觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_alerts_updated_at
    BEFORE UPDATE ON public.alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_alerts_updated_at();

-- 4. 建立視圖：警示統計（按長者分組）
CREATE OR REPLACE VIEW public.v_alert_statistics AS
SELECT
    elder_id,
    COUNT(*) as total_alerts,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged_count,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE severity = 'high') as high_count,
    COUNT(*) FILTER (WHERE severity = 'medium') as medium_count,
    COUNT(*) FILTER (WHERE severity = 'low') as low_count,
    COUNT(*) FILTER (WHERE alert_type = 'medication') as medication_count,
    COUNT(*) FILTER (WHERE alert_type = 'health') as health_count,
    COUNT(*) FILTER (WHERE alert_type = 'activity') as activity_count,
    COUNT(*) FILTER (WHERE alert_type = 'emergency') as emergency_count,
    MAX(created_at) FILTER (WHERE status = 'pending') as latest_pending_at
FROM public.alerts
GROUP BY elder_id;

-- 5. 建立視圖：警示詳細資訊（含長者資訊）
CREATE OR REPLACE VIEW public.v_alert_details AS
SELECT
    a.id,
    a.elder_id,
    a.alert_type,
    a.severity,
    a.title,
    a.description,
    a.status,
    a.metadata,
    a.created_at,
    a.acknowledged_at,
    a.resolved_at,
    a.resolved_by,
    a.resolution_note,
    a.updated_at,
    elder.display_name as elder_name,
    elder.avatar_url as elder_avatar,
    elder.date_of_birth as elder_dob,
    resolver.display_name as resolver_name,
    resolver.avatar_url as resolver_avatar
FROM public.alerts a
LEFT JOIN public.user_profiles elder ON a.elder_id = elder.id
LEFT JOIN public.user_profiles resolver ON a.resolved_by = resolver.id
ORDER BY a.created_at DESC;

-- 6. Row Level Security (RLS) 政策
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- 允許家屬查看其照護長者的警示
CREATE POLICY "Family members can view alerts for their elders"
    ON public.alerts
    FOR SELECT
    USING (
        elder_id IN (
            SELECT elder_id
            FROM public.family_elder_relationships
            WHERE family_member_id IN (
                SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
            )
            AND status = 'active'
        )
    );

-- 允許系統管理員查看所有警示
CREATE POLICY "Admins can view all alerts"
    ON public.alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- 允許家屬和管理員插入警示
CREATE POLICY "Family members and admins can insert alerts"
    ON public.alerts
    FOR INSERT
    WITH CHECK (
        elder_id IN (
            SELECT elder_id
            FROM public.family_elder_relationships
            WHERE family_member_id IN (
                SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
            )
            AND status = 'active'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- 允許家屬和管理員更新警示（標記已處理等）
CREATE POLICY "Family members and admins can update alerts"
    ON public.alerts
    FOR UPDATE
    USING (
        elder_id IN (
            SELECT elder_id
            FROM public.family_elder_relationships
            WHERE family_member_id IN (
                SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
            )
            AND status = 'active'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- 7. 註解說明
COMMENT ON TABLE public.alerts IS '警示系統 - 長者照護警示記錄';
COMMENT ON COLUMN public.alerts.elder_id IS '長者的 user_profile_id';
COMMENT ON COLUMN public.alerts.alert_type IS '警示類型：medication(用藥), health(健康), activity(活動), emergency(緊急), vital_signs(生命徵象)';
COMMENT ON COLUMN public.alerts.severity IS '嚴重程度：low(低), medium(中), high(高), critical(危急)';
COMMENT ON COLUMN public.alerts.title IS '警示標題';
COMMENT ON COLUMN public.alerts.description IS '警示詳細描述';
COMMENT ON COLUMN public.alerts.status IS '處理狀態：pending(待處理), acknowledged(已確認), resolved(已解決), dismissed(已忽略)';
COMMENT ON COLUMN public.alerts.metadata IS '額外資訊（如相關的用藥記錄 ID、對話 ID 等）';
COMMENT ON COLUMN public.alerts.acknowledged_at IS '確認時間';
COMMENT ON COLUMN public.alerts.resolved_at IS '解決時間';
COMMENT ON COLUMN public.alerts.resolved_by IS '處理者的 user_profile_id';
COMMENT ON COLUMN public.alerts.resolution_note IS '處理備註';

-- 8. 插入範例資料（測試用）
-- 注意：實際使用時應該由應用程式自動生成，這裡僅供測試
-- INSERT INTO public.alerts (elder_id, alert_type, severity, title, description)
-- VALUES
--   ('elder-uuid-1', 'medication', 'high', '連續2天錯過服藥', '長者連續2天未服用「血壓藥」'),
--   ('elder-uuid-1', 'activity', 'medium', '24小時無活動記錄', '長者已超過24小時未使用系統'),
--   ('elder-uuid-2', 'health', 'critical', 'AI偵測健康異常', '對話中提及「頭暈」、「胸悶」等關鍵詞');

-- 完成提示
SELECT '✅ alerts 表創建完成' as status;
SELECT '✅ 索引創建完成' as status;
SELECT '✅ 觸發器創建完成' as status;
SELECT '✅ RLS 政策設定完成' as status;
SELECT '✅ 警示統計視圖創建完成' as status;
SELECT '✅ 警示詳細視圖創建完成' as status;
