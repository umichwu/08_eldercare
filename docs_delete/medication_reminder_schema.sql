-- ============================================================================
-- ElderCare - 用藥提醒系統與家屬監控擴展 Schema
-- ============================================================================
-- 版本: 1.0
-- 日期: 2025-10-28
-- 說明: 此文件包含用藥提醒推送、FCM Token 管理、家屬監控所需的表結構
-- 依賴: 需要先執行 supabase_complete_schema_with_auth.sql
-- ============================================================================

-- ============================================================================
-- PART 0: 清理舊資料（確保可多次執行）
-- ============================================================================
-- 說明: 如果重複執行此 SQL 檔案，先清理舊的表格、視圖、函數、觸發器
-- 注意: 使用 CASCADE 會自動刪除相依的索引、觸發器、RLS 策略

-- ----------------------------------------------------------------------------
-- 0.1 刪除視圖（Views）
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_elder_current_medications CASCADE;
DROP VIEW IF EXISTS public.v_today_medication_schedule CASCADE;

-- ----------------------------------------------------------------------------
-- 0.2 刪除函數（Functions）
-- ----------------------------------------------------------------------------
-- 注意: 使用 CASCADE 會自動刪除依賴此函數的觸發器
DROP FUNCTION IF EXISTS public.fn_auto_mark_missed_medications() CASCADE;
DROP FUNCTION IF EXISTS public.fn_generate_today_medication_logs() CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_medication_reminder_stats() CASCADE;

-- ----------------------------------------------------------------------------
-- 0.3 刪除表格（Tables）- 依相依性順序
-- ----------------------------------------------------------------------------
-- 注意: 使用 CASCADE 會自動刪除相關的索引、約束、觸發器、RLS 策略
DROP TABLE IF EXISTS public.family_view_logs CASCADE;
DROP TABLE IF EXISTS public.elder_activity_tracking CASCADE;
DROP TABLE IF EXISTS public.medication_logs CASCADE;
DROP TABLE IF EXISTS public.medication_reminders CASCADE;
DROP TABLE IF EXISTS public.medications CASCADE;

-- ----------------------------------------------------------------------------
-- 0.4 刪除 FCM Token 相關索引（如果單獨存在）
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_user_profiles_fcm_token;
DROP INDEX IF EXISTS public.idx_elders_fcm_token;
DROP INDEX IF EXISTS public.idx_family_members_fcm_token;

-- ----------------------------------------------------------------------------
-- 0.5 移除擴展欄位（FCM Token）
-- ----------------------------------------------------------------------------
-- 注意: 如果這些欄位不存在，DROP COLUMN IF EXISTS 不會報錯
DO $$
BEGIN
    -- 移除 user_profiles 的 FCM Token 欄位
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'fcm_token') THEN
        ALTER TABLE public.user_profiles DROP COLUMN fcm_token;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'fcm_token_updated_at') THEN
        ALTER TABLE public.user_profiles DROP COLUMN fcm_token_updated_at;
    END IF;

    -- 移除 elders 的 FCM Token 欄位
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'elders' AND column_name = 'fcm_token') THEN
        ALTER TABLE public.elders DROP COLUMN fcm_token;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'elders' AND column_name = 'fcm_token_updated_at') THEN
        ALTER TABLE public.elders DROP COLUMN fcm_token_updated_at;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'elders' AND column_name = 'device_info') THEN
        ALTER TABLE public.elders DROP COLUMN device_info;
    END IF;

    -- 移除 family_members 的 FCM Token 欄位
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'family_members' AND column_name = 'fcm_token') THEN
        ALTER TABLE public.family_members DROP COLUMN fcm_token;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'family_members' AND column_name = 'fcm_token_updated_at') THEN
        ALTER TABLE public.family_members DROP COLUMN fcm_token_updated_at;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'family_members' AND column_name = 'device_info') THEN
        ALTER TABLE public.family_members DROP COLUMN device_info;
    END IF;
END $$;

-- ============================================================================
-- 清理完成，開始建立新的 Schema
-- ============================================================================

-- ============================================================================
-- PART 1: FCM Token 管理（推送通知必需）
-- ============================================================================

-- 為 user_profiles 表添加 FCM Token 欄位
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS fcm_token TEXT,
ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMPTZ;

-- 為長輩表添加 FCM Token（冗餘設計，提升查詢效能）
ALTER TABLE public.elders
ADD COLUMN IF NOT EXISTS fcm_token TEXT,
ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}';

-- 為家屬表添加 FCM Token
ALTER TABLE public.family_members
ADD COLUMN IF NOT EXISTS fcm_token TEXT,
ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}';

-- FCM Token 索引（快速查找）
CREATE INDEX IF NOT EXISTS idx_user_profiles_fcm_token ON public.user_profiles(fcm_token) WHERE fcm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_elders_fcm_token ON public.elders(fcm_token) WHERE fcm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_family_members_fcm_token ON public.family_members(fcm_token) WHERE fcm_token IS NOT NULL;

COMMENT ON COLUMN public.user_profiles.fcm_token IS 'Firebase Cloud Messaging Token for push notifications';
COMMENT ON COLUMN public.user_profiles.fcm_token_updated_at IS '最後更新 FCM Token 的時間';

-- ============================================================================
-- PART 2: 用藥管理系統
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 藥物主表 (medications)
-- ----------------------------------------------------------------------------
-- 說明: 儲存長輩的所有藥物資訊
CREATE TABLE IF NOT EXISTS public.medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯長輩
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 基本資訊
    medication_name VARCHAR(200) NOT NULL,
    medication_type VARCHAR(50), -- 'tablet', 'capsule', 'liquid', 'injection', 'topical'
    dosage VARCHAR(100), -- '1片', '10ml', '2粒'
    unit VARCHAR(20), -- 'mg', 'ml', 'IU'

    -- 用藥說明
    instructions TEXT,
    purpose TEXT, -- 用藥目的
    side_effects TEXT, -- 副作用
    warnings TEXT, -- 注意事項

    -- 處方資訊
    prescribed_by VARCHAR(100), -- 處方醫師
    prescription_date DATE,
    prescription_number VARCHAR(100),

    -- 藥物外觀（方便辨識）
    color VARCHAR(50),
    shape VARCHAR(50),
    image_url TEXT,

    -- 庫存管理
    stock_quantity INTEGER DEFAULT 0,
    stock_alert_threshold INTEGER DEFAULT 7, -- 低於此數量時提醒補充
    last_refill_date DATE,

    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'expired', 'temporary')),
    is_emergency_medication BOOLEAN DEFAULT false, -- 是否為緊急藥物

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.user_profiles(id), -- 由誰建立（家屬或長輩）
    deleted_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_medications_elder_id ON public.medications(elder_id);
CREATE INDEX idx_medications_status ON public.medications(status) WHERE status = 'active';
CREATE INDEX idx_medications_stock ON public.medications(stock_quantity) WHERE stock_quantity <= stock_alert_threshold;

-- RLS 策略
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- 長輩可以查看自己的藥物
CREATE POLICY "Elders can view own medications"
    ON public.medications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elders
            WHERE id = medications.elder_id
            AND auth_user_id = auth.uid()
        )
    );

-- 家屬可以查看關聯長輩的藥物
CREATE POLICY "Family can view related elder medications"
    ON public.medications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = medications.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
            AND efr.can_view_health_records = true
        )
    );

-- 家屬可以新增、修改、刪除關聯長輩的藥物
CREATE POLICY "Family can manage related elder medications"
    ON public.medications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = medications.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
            AND efr.can_manage_settings = true
        )
    );

COMMENT ON TABLE public.medications IS '藥物主表：儲存長輩的所有藥物資訊';

-- ----------------------------------------------------------------------------
-- 2.2 用藥排程表 (medication_reminders)
-- ----------------------------------------------------------------------------
-- 說明: 儲存用藥提醒排程（支援 Cron 格式）
CREATE TABLE IF NOT EXISTS public.medication_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯藥物和長輩
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 排程設定（Cron 格式）
    -- 範例: '0 8 * * *' = 每天早上8點
    --       '0 8,14,20 * * *' = 每天早上8點、下午2點、晚上8點
    --       '0 */6 * * *' = 每6小時一次
    cron_schedule VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Taipei',

    -- 人類可讀的提醒時間（輔助顯示）
    reminder_times JSONB, -- ['08:00', '14:00', '20:00']
    frequency_description VARCHAR(100), -- '每天三次', '每6小時', '每週一、三、五'

    -- 提醒設定
    reminder_message TEXT, -- 自訂提醒訊息
    reminder_sound VARCHAR(50) DEFAULT 'default', -- 提醒聲音
    vibrate BOOLEAN DEFAULT true,

    -- 進階設定
    reminder_advance_minutes INTEGER DEFAULT 0, -- 提前幾分鐘提醒
    auto_mark_missed_after_minutes INTEGER DEFAULT 30, -- 超過幾分鐘自動標記為未服藥

    -- FCM Token（多設備支援）
    fcm_tokens TEXT[], -- 允許多個設備接收提醒

    -- 家屬通知設定
    notify_family_if_missed BOOLEAN DEFAULT true,
    family_fcm_tokens TEXT[], -- 家屬的 FCM Tokens

    -- 狀態
    is_enabled BOOLEAN DEFAULT true,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE, -- 結束日期（可選）

    -- 統計
    total_reminders_sent INTEGER DEFAULT 0,
    total_taken INTEGER DEFAULT 0,
    total_missed INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.user_profiles(id)
);

-- 索引
CREATE INDEX idx_medication_reminders_medication_id ON public.medication_reminders(medication_id);
CREATE INDEX idx_medication_reminders_elder_id ON public.medication_reminders(elder_id);
CREATE INDEX idx_medication_reminders_enabled ON public.medication_reminders(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_medication_reminders_schedule ON public.medication_reminders(cron_schedule);

-- RLS 策略
ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elders can view own reminders"
    ON public.medication_reminders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elders
            WHERE id = medication_reminders.elder_id
            AND auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Family can view related elder reminders"
    ON public.medication_reminders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = medication_reminders.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
            AND efr.can_view_health_records = true
        )
    );

CREATE POLICY "Family can manage related elder reminders"
    ON public.medication_reminders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = medication_reminders.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
            AND efr.can_manage_settings = true
        )
    );

COMMENT ON TABLE public.medication_reminders IS '用藥排程表：使用 Cron 格式儲存提醒排程';

-- ----------------------------------------------------------------------------
-- 2.3 用藥記錄表 (medication_logs)
-- ----------------------------------------------------------------------------
-- 說明: 記錄每次用藥的實際情況
CREATE TABLE IF NOT EXISTS public.medication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    medication_reminder_id UUID REFERENCES public.medication_reminders(id) ON DELETE SET NULL,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 排定時間 vs 實際時間
    scheduled_time TIMESTAMPTZ NOT NULL, -- 排定的服藥時間
    actual_time TIMESTAMPTZ, -- 實際服藥時間

    -- 服藥狀態
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'missed', 'skipped', 'late')),

    -- 服藥資訊
    dosage_taken VARCHAR(100), -- 實際服用劑量
    notes TEXT, -- 備註（例如：副作用、感受）

    -- 確認方式
    confirmed_by VARCHAR(20) DEFAULT 'user', -- 'user', 'family', 'auto'
    confirmed_by_user_id UUID REFERENCES public.user_profiles(id),
    confirmation_method VARCHAR(20), -- 'app', 'phone_call', 'in_person'

    -- 延遲分鐘數
    delay_minutes INTEGER, -- 晚了幾分鐘服藥

    -- 推送記錄
    push_sent BOOLEAN DEFAULT false,
    push_sent_at TIMESTAMPTZ,
    push_opened BOOLEAN DEFAULT false,
    push_opened_at TIMESTAMPTZ,

    -- 家屬通知記錄
    family_notified BOOLEAN DEFAULT false,
    family_notified_at TIMESTAMPTZ,
    family_notification_reason VARCHAR(50), -- 'missed', 'late', 'side_effect'

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_medication_logs_medication_id ON public.medication_logs(medication_id);
CREATE INDEX idx_medication_logs_elder_id ON public.medication_logs(elder_id);
CREATE INDEX idx_medication_logs_scheduled_time ON public.medication_logs(scheduled_time);
CREATE INDEX idx_medication_logs_status ON public.medication_logs(status);
CREATE INDEX idx_medication_logs_pending ON public.medication_logs(scheduled_time, status) WHERE status = 'pending';

-- RLS 策略
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elders can view own medication logs"
    ON public.medication_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elders
            WHERE id = medication_logs.elder_id
            AND auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Elders can update own medication logs"
    ON public.medication_logs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.elders
            WHERE id = medication_logs.elder_id
            AND auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Family can view related elder medication logs"
    ON public.medication_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = medication_logs.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
            AND efr.can_view_health_records = true
        )
    );

CREATE POLICY "Family can manage related elder medication logs"
    ON public.medication_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = medication_logs.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
            AND efr.can_manage_settings = true
        )
    );

COMMENT ON TABLE public.medication_logs IS '用藥記錄表：記錄每次服藥的實際情況';

-- ============================================================================
-- PART 3: 家屬監控擴展
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 長輩活動追蹤表 (elder_activity_tracking)
-- ----------------------------------------------------------------------------
-- 說明: 追蹤長輩的日常活動和在線狀態
CREATE TABLE IF NOT EXISTS public.elder_activity_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯長輩
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 活動類型
    activity_type VARCHAR(50) NOT NULL, -- 'app_opened', 'conversation_started', 'medication_taken', 'sos_triggered'

    -- 活動詳情
    activity_details JSONB DEFAULT '{}',

    -- 地理位置（可選）
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_address TEXT,

    -- 設備資訊
    device_type VARCHAR(50),
    device_id VARCHAR(255),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_activity_tracking_elder_id ON public.elder_activity_tracking(elder_id);
CREATE INDEX idx_activity_tracking_created_at ON public.elder_activity_tracking(created_at DESC);
CREATE INDEX idx_activity_tracking_type ON public.elder_activity_tracking(activity_type);

-- RLS 策略
ALTER TABLE public.elder_activity_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family can view related elder activities"
    ON public.elder_activity_tracking FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = elder_activity_tracking.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
        )
    );

COMMENT ON TABLE public.elder_activity_tracking IS '長輩活動追蹤表：記錄長輩的日常活動';

-- ----------------------------------------------------------------------------
-- 3.2 家屬查看記錄表 (family_view_logs)
-- ----------------------------------------------------------------------------
-- 說明: 記錄家屬查看長輩資料的歷史（隱私審計）
CREATE TABLE IF NOT EXISTS public.family_view_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 查看內容
    viewed_content_type VARCHAR(50) NOT NULL, -- 'conversations', 'medications', 'health_records', 'activities'
    viewed_content_id UUID, -- 具體查看的內容 ID

    -- 時間戳記
    viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_family_view_logs_family_id ON public.family_view_logs(family_member_id);
CREATE INDEX idx_family_view_logs_elder_id ON public.family_view_logs(elder_id);
CREATE INDEX idx_family_view_logs_viewed_at ON public.family_view_logs(viewed_at DESC);

-- RLS 策略
ALTER TABLE public.family_view_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family can view own view logs"
    ON public.family_view_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE id = family_view_logs.family_member_id
            AND auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.family_view_logs IS '家屬查看記錄表：隱私審計用';

-- ============================================================================
-- PART 4: 視圖和輔助函數
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 視圖：長輩當前用藥狀態
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_elder_current_medications AS
SELECT
    m.elder_id,
    e.name AS elder_name,
    m.id AS medication_id,
    m.medication_name,
    m.dosage,
    m.status,
    m.stock_quantity,
    m.stock_alert_threshold,
    m.stock_quantity <= m.stock_alert_threshold AS stock_low,
    COUNT(mr.id) AS active_reminders,
    (
        SELECT COUNT(*)
        FROM public.medication_logs ml
        WHERE ml.medication_id = m.id
        AND ml.status = 'taken'
        AND ml.actual_time >= NOW() - INTERVAL '7 days'
    ) AS taken_last_7_days,
    (
        SELECT COUNT(*)
        FROM public.medication_logs ml
        WHERE ml.medication_id = m.id
        AND ml.status = 'missed'
        AND ml.scheduled_time >= NOW() - INTERVAL '7 days'
    ) AS missed_last_7_days
FROM
    public.medications m
    INNER JOIN public.elders e ON m.elder_id = e.id
    LEFT JOIN public.medication_reminders mr ON m.id = mr.medication_id AND mr.is_enabled = true
WHERE
    m.status = 'active'
    AND m.deleted_at IS NULL
GROUP BY
    m.elder_id, e.name, m.id, m.medication_name, m.dosage, m.status,
    m.stock_quantity, m.stock_alert_threshold;

COMMENT ON VIEW public.v_elder_current_medications IS '長輩當前用藥狀態視圖：方便家屬快速查看';

-- ----------------------------------------------------------------------------
-- 4.2 視圖：今日待服藥清單
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_today_medication_schedule AS
SELECT
    ml.id,
    ml.elder_id,
    e.name AS elder_name,
    ml.medication_id,
    m.medication_name,
    m.dosage,
    ml.scheduled_time,
    ml.actual_time,
    ml.status,
    ml.delay_minutes,
    ml.push_sent,
    ml.push_opened,
    CASE
        WHEN ml.status = 'taken' THEN 'success'
        WHEN ml.status = 'missed' THEN 'danger'
        WHEN ml.scheduled_time < NOW() AND ml.status = 'pending' THEN 'warning'
        ELSE 'info'
    END AS status_color
FROM
    public.medication_logs ml
    INNER JOIN public.elders e ON ml.elder_id = e.id
    INNER JOIN public.medications m ON ml.medication_id = m.id
WHERE
    ml.scheduled_time::DATE = CURRENT_DATE
ORDER BY
    ml.scheduled_time;

COMMENT ON VIEW public.v_today_medication_schedule IS '今日用藥排程視圖：顯示今天所有的用藥計劃';

-- ----------------------------------------------------------------------------
-- 4.3 函數：自動標記未服藥
-- ----------------------------------------------------------------------------
-- 說明: 檢查所有 pending 狀態且超時的用藥記錄，自動標記為 missed
CREATE OR REPLACE FUNCTION public.fn_auto_mark_missed_medications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- 更新超時的待服藥記錄為 missed
    UPDATE public.medication_logs
    SET
        status = 'missed',
        updated_at = NOW()
    WHERE
        status = 'pending'
        AND scheduled_time < NOW() - INTERVAL '30 minutes' -- 預設30分鐘超時
    RETURNING 1 INTO updated_count;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.fn_auto_mark_missed_medications() IS '自動標記超時未服藥的記錄為 missed';

-- ----------------------------------------------------------------------------
-- 4.4 函數：生成今日用藥排程
-- ----------------------------------------------------------------------------
-- 說明: 根據 cron_schedule 生成今日的用藥記錄
-- 注意: 實際的 cron 解析需要在 Node.js 後端使用 node-cron 或 cron-parser
CREATE OR REPLACE FUNCTION public.fn_generate_today_medication_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    generated_count INTEGER := 0;
BEGIN
    -- 這個函數僅作為示例，實際的排程生成邏輯應該在後端完成
    -- 因為 PostgreSQL 不原生支援 cron 格式解析

    -- 範例：插入一個測試記錄
    INSERT INTO public.medication_logs (
        medication_id,
        medication_reminder_id,
        elder_id,
        scheduled_time,
        status
    )
    SELECT
        mr.medication_id,
        mr.id,
        mr.elder_id,
        NOW(), -- 實際應該根據 cron_schedule 計算
        'pending'
    FROM
        public.medication_reminders mr
    WHERE
        mr.is_enabled = true
        AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS generated_count = ROW_COUNT;

    RETURN generated_count;
END;
$$;

COMMENT ON FUNCTION public.fn_generate_today_medication_logs() IS '生成今日用藥排程（示例，實際應在後端執行）';

-- ============================================================================
-- PART 5: 觸發器
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 自動更新 updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 為各表添加觸發器
CREATE TRIGGER trigger_medications_updated_at
    BEFORE UPDATE ON public.medications
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_updated_at();

CREATE TRIGGER trigger_medication_reminders_updated_at
    BEFORE UPDATE ON public.medication_reminders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_updated_at();

CREATE TRIGGER trigger_medication_logs_updated_at
    BEFORE UPDATE ON public.medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_updated_at();

-- ----------------------------------------------------------------------------
-- 5.2 自動更新統計資訊
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_medication_reminder_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 當 medication_log 狀態改變時，更新對應的 reminder 統計
    IF TG_OP = 'INSERT' THEN
        UPDATE public.medication_reminders
        SET
            total_reminders_sent = total_reminders_sent + 1,
            last_reminder_at = NEW.scheduled_time
        WHERE id = NEW.medication_reminder_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'taken' AND OLD.status != 'taken' THEN
            UPDATE public.medication_reminders
            SET total_taken = total_taken + 1
            WHERE id = NEW.medication_reminder_id;
        ELSIF NEW.status = 'missed' AND OLD.status != 'missed' THEN
            UPDATE public.medication_reminders
            SET total_missed = total_missed + 1
            WHERE id = NEW.medication_reminder_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_reminder_stats
    AFTER INSERT OR UPDATE ON public.medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_medication_reminder_stats();

-- ============================================================================
-- 完成
-- ============================================================================

-- 確認所有表都啟用了 RLS
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('medications', 'medication_reminders', 'medication_logs', 'elder_activity_tracking', 'family_view_logs')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        RAISE NOTICE '已確認 RLS 啟用: %', table_name;
    END LOOP;
END $$;

-- 輸出成功訊息
DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '用藥提醒系統與家屬監控擴展 Schema 安裝完成！';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增的表：';
    RAISE NOTICE '  1. medications - 藥物主表';
    RAISE NOTICE '  2. medication_reminders - 用藥排程表';
    RAISE NOTICE '  3. medication_logs - 用藥記錄表';
    RAISE NOTICE '  4. elder_activity_tracking - 長輩活動追蹤表';
    RAISE NOTICE '  5. family_view_logs - 家屬查看記錄表';
    RAISE NOTICE '';
    RAISE NOTICE '新增的視圖：';
    RAISE NOTICE '  1. v_elder_current_medications - 長輩當前用藥狀態';
    RAISE NOTICE '  2. v_today_medication_schedule - 今日用藥排程';
    RAISE NOTICE '';
    RAISE NOTICE '新增的函數：';
    RAISE NOTICE '  1. fn_auto_mark_missed_medications() - 自動標記未服藥';
    RAISE NOTICE '  2. fn_generate_today_medication_logs() - 生成今日用藥排程';
    RAISE NOTICE '';
    RAISE NOTICE '下一步：';
    RAISE NOTICE '  1. 在後端實作 FCM 推送邏輯';
    RAISE NOTICE '  2. 使用 node-cron 實作排程檢查';
    RAISE NOTICE '  3. 開發家屬端前端介面';
    RAISE NOTICE '============================================================================';
END $$;
