-- ============================================================================
-- 生活提醒系統 (Daily Routine Reminders) - 資料庫 Schema
-- ============================================================================
-- 版本: 1.0
-- 建立日期: 2025-12-08
-- 功能: 統一管理長輩的各種生活提醒（用藥、喝水、飲食、運動、回診、睡眠）
-- ============================================================================
-- 提醒類別:
--   1. 💊 用藥提醒 (medication) - 整合現有用藥提醒系統
--   2. 💧 喝水提醒 (water) - 定時補充水分，追蹤飲水量
--   3. 🍽️ 飲食提醒 (meal) - 飯前/飯後提醒，營養補充
--   4. 🏃 運動提醒 (exercise) - 運動、散步、伸展等活動
--   5. 🏥 回診提醒 (appointment) - 醫院回診、健康檢查預約
--   6. 😴 睡眠提醒 (sleep) - 就寢時間、午休提醒
-- ============================================================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 刪除視圖（必須先刪除，因為視圖依賴表格）
DROP VIEW IF EXISTS public.v_today_reminders CASCADE;
DROP VIEW IF EXISTS public.v_daily_reminder_statistics CASCADE;

-- 刪除函數（包含觸發器會自動刪除）
DROP FUNCTION IF EXISTS public.update_daily_reminder_stats() CASCADE;
DROP FUNCTION IF EXISTS public.update_daily_reminder_updated_at() CASCADE;

-- 刪除表格（依相依性順序）
-- 使用 CASCADE 會自動刪除：觸發器、索引、約束、RLS 政策
DROP TABLE IF EXISTS public.daily_reminder_logs CASCADE;
DROP TABLE IF EXISTS public.daily_reminders CASCADE;
DROP TABLE IF EXISTS public.reminder_categories CASCADE;

-- ============================================================================
-- STEP 2: 建立資料表
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 生活提醒類別參考表 (reminder_categories)
-- ----------------------------------------------------------------------------
-- 功能: 定義系統支援的提醒類別（用藥、喝水、飲食、運動、回診、睡眠）
-- ----------------------------------------------------------------------------
CREATE TABLE public.reminder_categories (
    id VARCHAR(50) PRIMARY KEY,

    -- 名稱
    name_zh VARCHAR(50) NOT NULL,
    name_en VARCHAR(50) NOT NULL,

    -- 顯示設定
    icon VARCHAR(50), -- emoji 或 icon class
    color VARCHAR(20), -- 主題顏色 (HEX)
    description TEXT,

    -- 系統設定
    is_system BOOLEAN DEFAULT true, -- 系統預設類別（不可刪除）
    display_order INTEGER DEFAULT 0,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入預設類別
INSERT INTO public.reminder_categories (id, name_zh, name_en, icon, color, is_system, display_order) VALUES
('medication', '用藥提醒', 'Medication', '💊', '#FF6B6B', true, 1),
('water', '喝水提醒', 'Water', '💧', '#4ECDC4', true, 2),
('meal', '飲食提醒', 'Meal', '🍽️', '#FFE66D', true, 3),
('exercise', '運動提醒', 'Exercise', '🏃', '#95E1D3', true, 4),
('appointment', '回診提醒', 'Appointment', '🏥', '#A8E6CF', true, 5),
('sleep', '睡眠提醒', 'Sleep', '😴', '#B4A7D6', true, 6);

-- ----------------------------------------------------------------------------
-- 2.2 生活提醒主表 (daily_reminders)
-- ----------------------------------------------------------------------------
-- 功能: 儲存長輩的各種生活提醒設定
-- 特色: 通用設計，支援多種提醒類別，使用 JSONB 儲存類別特定資料
-- ----------------------------------------------------------------------------
CREATE TABLE public.daily_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- ========================================================================
    -- 關聯資訊
    -- ========================================================================
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL REFERENCES public.reminder_categories(id),

    -- ========================================================================
    -- 提醒內容
    -- ========================================================================
    title VARCHAR(200) NOT NULL, -- 提醒標題（例：早上喝水、晚餐前用藥）
    description TEXT, -- 詳細說明
    reminder_note TEXT, -- 給長輩的溫馨提示

    -- ========================================================================
    -- 排程設定（使用 Cron 表達式）
    -- ========================================================================
    cron_schedule VARCHAR(100) NOT NULL, -- 例: "0 8 * * *" (每天早上8點)
    timezone VARCHAR(50) DEFAULT 'Asia/Taipei',

    -- 時間資訊（JSON 格式，儲存額外的時間設定）
    -- 格式: { times: ["08:00", "12:00"], days: ["Mon", "Wed"], customSettings: {} }
    reminder_times JSONB,

    -- ========================================================================
    -- 提醒設定
    -- ========================================================================
    is_enabled BOOLEAN DEFAULT true,
    notification_methods JSONB DEFAULT '["push", "email"]'::jsonb, -- 通知方式: push, email, sms

    -- 進階設定
    advance_notice_minutes INTEGER DEFAULT 0, -- 提前通知（分鐘）
    repeat_interval_minutes INTEGER, -- 重複提醒間隔（如果未確認）
    max_repeats INTEGER DEFAULT 3, -- 最多重複次數

    -- ========================================================================
    -- 特定類別的額外資訊（JSON 格式）
    -- ========================================================================
    -- 範例:
    --   water: { targetAmount: 250, unit: "ml", dailyGoal: 2000 }
    --   meal: { mealType: "breakfast", timing: "before", allowPhoto: true }
    --   exercise: { exerciseType: "walking", targetDuration: 30, intensity: "light" }
    --   appointment: { hospital: "台大醫院", doctor: "王醫師", reminderDaysBefore: [1,3,7] }
    --   sleep: { sleepType: "bedtime", targetTime: "22:00", trackSleepQuality: true }
    category_specific_data JSONB,

    -- ========================================================================
    -- 家屬通知設定
    -- ========================================================================
    notify_family_if_missed BOOLEAN DEFAULT false,
    missed_threshold_minutes INTEGER DEFAULT 30, -- 超過N分鐘未確認視為錯過

    -- ========================================================================
    -- 統計資訊
    -- ========================================================================
    total_reminders_sent INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    last_confirmed_at TIMESTAMPTZ,

    -- ========================================================================
    -- 有效期間（用於短期提醒，例如3天感冒藥療程）
    -- ========================================================================
    start_date DATE,
    end_date DATE,
    is_temporary BOOLEAN DEFAULT false, -- 是否為臨時提醒

    -- ========================================================================
    -- 狀態
    -- ========================================================================
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

    -- ========================================================================
    -- 時間戳記
    -- ========================================================================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 索引優化
CREATE INDEX idx_daily_reminders_elder_id ON public.daily_reminders(elder_id);
CREATE INDEX idx_daily_reminders_category ON public.daily_reminders(category);
CREATE INDEX idx_daily_reminders_enabled ON public.daily_reminders(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_daily_reminders_status ON public.daily_reminders(status);
CREATE INDEX idx_daily_reminders_schedule ON public.daily_reminders(cron_schedule);

-- 複合索引（提升查詢效能）
CREATE INDEX idx_daily_reminders_elder_category ON public.daily_reminders(elder_id, category);
CREATE INDEX idx_daily_reminders_elder_enabled ON public.daily_reminders(elder_id, is_enabled) WHERE is_enabled = true;

-- ----------------------------------------------------------------------------
-- 2.3 生活提醒記錄表 (daily_reminder_logs)
-- ----------------------------------------------------------------------------
-- 功能: 追蹤每次提醒的執行狀態（pending, completed, missed, skipped）
-- 特色: 支援拍照記錄、回饋資訊（如飲水量、運動時長等）
-- ----------------------------------------------------------------------------
CREATE TABLE public.daily_reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- ========================================================================
    -- 關聯資訊
    -- ========================================================================
    reminder_id UUID NOT NULL REFERENCES public.daily_reminders(id) ON DELETE CASCADE,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL REFERENCES public.reminder_categories(id),

    -- ========================================================================
    -- 提醒時間
    -- ========================================================================
    scheduled_time TIMESTAMPTZ NOT NULL, -- 預定時間
    actual_time TIMESTAMPTZ, -- 實際確認時間

    -- ========================================================================
    -- 狀態追蹤
    -- ========================================================================
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed', 'skipped')),

    -- ========================================================================
    -- 確認資訊
    -- ========================================================================
    confirmed_by VARCHAR(50), -- 'elder' or 'family_member'
    confirmed_by_user_id UUID REFERENCES auth.users(id),
    confirmation_method VARCHAR(50), -- 'app', 'voice', 'manual', 'auto'

    -- ========================================================================
    -- 推送通知
    -- ========================================================================
    push_sent BOOLEAN DEFAULT false,
    push_sent_at TIMESTAMPTZ,
    push_delivery_status VARCHAR(50), -- 'sent', 'delivered', 'failed'

    -- ========================================================================
    -- 家屬通知
    -- ========================================================================
    family_notified BOOLEAN DEFAULT false,
    family_notified_at TIMESTAMPTZ,

    -- ========================================================================
    -- 額外資訊
    -- ========================================================================
    notes TEXT,
    attachment_urls JSONB, -- 例如：拍照記錄 URL 陣列

    -- 回饋資訊（例如：運動時長、喝水量等）
    -- 範例:
    --   water: { actualAmount: 250, timestamp: "..." }
    --   exercise: { actualDuration: 30, distance: 1.5, feeling: "good" }
    --   sleep: { actualBedtime: "22:30", sleepDuration: 480, quality: "good" }
    response_data JSONB,

    -- ========================================================================
    -- 時間戳記
    -- ========================================================================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_daily_reminder_logs_reminder_id ON public.daily_reminder_logs(reminder_id);
CREATE INDEX idx_daily_reminder_logs_elder_id ON public.daily_reminder_logs(elder_id);
CREATE INDEX idx_daily_reminder_logs_category ON public.daily_reminder_logs(category);
CREATE INDEX idx_daily_reminder_logs_status ON public.daily_reminder_logs(status);
CREATE INDEX idx_daily_reminder_logs_scheduled_time ON public.daily_reminder_logs(scheduled_time);

-- 部分索引（優化待處理提醒查詢）
CREATE INDEX idx_daily_reminder_logs_pending ON public.daily_reminder_logs(status, scheduled_time)
    WHERE status = 'pending';

-- 複合索引（提升統計查詢效能）
CREATE INDEX idx_daily_reminder_logs_elder_category_time ON public.daily_reminder_logs(elder_id, category, scheduled_time);
CREATE INDEX idx_daily_reminder_logs_elder_status ON public.daily_reminder_logs(elder_id, status);

-- ============================================================================
-- STEP 3: 建立視圖
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 統計視圖 (v_daily_reminder_statistics)
-- ----------------------------------------------------------------------------
-- 功能: 計算過去 30 天的提醒完成率統計
-- 用途: Dashboard 顯示、趨勢分析
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_daily_reminder_statistics AS
SELECT
    l.elder_id,
    l.category,
    rc.name_zh as category_name,
    rc.icon as category_icon,
    rc.color as category_color,
    DATE(l.scheduled_time) as date,
    COUNT(*) as total_reminders,
    COUNT(*) FILTER (WHERE l.status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE l.status = 'missed') as missed_count,
    COUNT(*) FILTER (WHERE l.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE l.status = 'skipped') as skipped_count,
    ROUND(
        (COUNT(*) FILTER (WHERE l.status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
        1
    ) as completion_rate
FROM public.daily_reminder_logs l
JOIN public.reminder_categories rc ON l.category = rc.id
WHERE l.scheduled_time >= NOW() - INTERVAL '30 days'
GROUP BY l.elder_id, l.category, rc.name_zh, rc.icon, rc.color, DATE(l.scheduled_time);

-- ----------------------------------------------------------------------------
-- 3.2 今日提醒總覽視圖 (v_today_reminders)
-- ----------------------------------------------------------------------------
-- 功能: 查詢今日所有提醒（pending 和 completed）
-- 用途: 今日待辦清單、快速查看
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_today_reminders AS
SELECT
    l.id as log_id,
    l.reminder_id,
    l.elder_id,
    e.name as elder_name,
    l.category,
    rc.name_zh as category_name,
    rc.icon as category_icon,
    rc.color as category_color,
    r.title,
    r.description,
    r.reminder_note,
    l.scheduled_time,
    l.actual_time,
    l.status,
    l.confirmed_by,
    l.response_data,
    r.category_specific_data
FROM public.daily_reminder_logs l
JOIN public.daily_reminders r ON l.reminder_id = r.id
JOIN public.elders e ON l.elder_id = e.id
JOIN public.reminder_categories rc ON l.category = rc.id
WHERE DATE(l.scheduled_time) = CURRENT_DATE
  AND l.status IN ('pending', 'completed')
ORDER BY l.scheduled_time;

-- ============================================================================
-- STEP 4: 建立函數
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 自動更新 updated_at 觸發器函數
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_daily_reminder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4.2 更新提醒統計資訊觸發器函數
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_daily_reminder_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- 當記錄從 pending 變成 completed 或 missed 時，更新統計
    IF OLD.status = 'pending' AND NEW.status IN ('completed', 'missed') THEN
        UPDATE public.daily_reminders
        SET
            last_confirmed_at = CASE WHEN NEW.status = 'completed' THEN NEW.actual_time ELSE last_confirmed_at END,
            total_reminders_sent = total_reminders_sent + 1,
            updated_at = NOW()
        WHERE id = NEW.reminder_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: 建立觸發器
-- ============================================================================

-- daily_reminders 表的 updated_at 自動更新
CREATE TRIGGER trigger_daily_reminders_updated_at
    BEFORE UPDATE ON public.daily_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_reminder_updated_at();

-- daily_reminder_logs 表的 updated_at 自動更新
CREATE TRIGGER trigger_daily_reminder_logs_updated_at
    BEFORE UPDATE ON public.daily_reminder_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_reminder_updated_at();

-- 更新提醒統計資訊
CREATE TRIGGER trigger_update_daily_reminder_stats
    AFTER UPDATE ON public.daily_reminder_logs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_daily_reminder_stats();

-- ============================================================================
-- STEP 6: 設定 RLS (Row Level Security) 政策
-- ============================================================================

-- 啟用 RLS
ALTER TABLE public.reminder_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reminder_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6.1 reminder_categories 政策（所有人都可以讀取）
-- ----------------------------------------------------------------------------
CREATE POLICY reminder_categories_read_all ON public.reminder_categories
    FOR SELECT
    USING (true); -- 所有人都可以讀取類別定義

-- ----------------------------------------------------------------------------
-- 6.2 daily_reminders 政策
-- ----------------------------------------------------------------------------

-- 政策：長輩可以查看和更新自己的提醒
CREATE POLICY daily_reminders_elder_access ON public.daily_reminders
    FOR ALL
    USING (
        elder_id IN (
            SELECT id FROM public.elders WHERE auth_user_id = auth.uid()
        )
    );

-- 政策：家屬可以查看和管理其照護長輩的提醒
CREATE POLICY daily_reminders_family_access ON public.daily_reminders
    FOR ALL
    USING (
        elder_id IN (
            SELECT efr.elder_id
            FROM public.elder_family_relations efr
            JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE fm.auth_user_id = auth.uid()
              AND efr.status = 'active'
        )
    );

-- ----------------------------------------------------------------------------
-- 6.3 daily_reminder_logs 政策
-- ----------------------------------------------------------------------------

-- 政策：長輩可以查看和更新自己的提醒記錄
CREATE POLICY daily_reminder_logs_elder_access ON public.daily_reminder_logs
    FOR ALL
    USING (
        elder_id IN (
            SELECT id FROM public.elders WHERE auth_user_id = auth.uid()
        )
    );

-- 政策：家屬可以查看其照護長輩的提醒記錄
CREATE POLICY daily_reminder_logs_family_view ON public.daily_reminder_logs
    FOR SELECT
    USING (
        elder_id IN (
            SELECT efr.elder_id
            FROM public.elder_family_relations efr
            JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE fm.auth_user_id = auth.uid()
              AND efr.status = 'active'
        )
    );

-- 政策：家屬可以更新其照護長輩的提醒記錄（例如幫忙確認完成）
CREATE POLICY daily_reminder_logs_family_update ON public.daily_reminder_logs
    FOR UPDATE
    USING (
        elder_id IN (
            SELECT efr.elder_id
            FROM public.elder_family_relations efr
            JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE fm.auth_user_id = auth.uid()
              AND efr.status = 'active'
        )
    );

-- ============================================================================
-- STEP 7: 新增表格註解
-- ============================================================================

COMMENT ON TABLE public.reminder_categories IS '生活提醒類別參考表 - 定義系統支援的提醒類別（用藥、喝水、飲食、運動、回診、睡眠）';
COMMENT ON TABLE public.daily_reminders IS '生活提醒主表 - 統一管理所有類型的生活提醒設定';
COMMENT ON TABLE public.daily_reminder_logs IS '生活提醒記錄表 - 追蹤每次提醒的執行狀態（pending, completed, missed, skipped）';

COMMENT ON COLUMN public.daily_reminders.category_specific_data IS '類別特定資料 (JSONB) - 儲存各類別的專屬設定，例如喝水量、運動時長、回診資訊等';
COMMENT ON COLUMN public.daily_reminder_logs.response_data IS '回饋資訊 (JSONB) - 儲存使用者確認時的額外資料，例如實際飲水量、運動時長、睡眠品質等';

COMMENT ON VIEW public.v_daily_reminder_statistics IS '統計視圖 - 計算過去 30 天的提醒完成率，按長輩、類別、日期分組';
COMMENT ON VIEW public.v_today_reminders IS '今日提醒總覽視圖 - 查詢今日所有提醒（pending 和 completed）';

-- ============================================================================
-- STEP 8: 完成訊息
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE '✅ 生活提醒系統 (Daily Routine Reminders) 安裝完成！';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 已建立的表格:';
    RAISE NOTICE '   - reminder_categories (提醒類別參考表)';
    RAISE NOTICE '   - daily_reminders (提醒主表)';
    RAISE NOTICE '   - daily_reminder_logs (提醒記錄表)';
    RAISE NOTICE '';
    RAISE NOTICE '📊 已建立的視圖:';
    RAISE NOTICE '   - v_daily_reminder_statistics (統計視圖)';
    RAISE NOTICE '   - v_today_reminders (今日提醒總覽)';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 已啟用 RLS 政策';
    RAISE NOTICE '';
    RAISE NOTICE '✨ 預設類別:';
    RAISE NOTICE '   1. 💊 用藥提醒 (medication)';
    RAISE NOTICE '   2. 💧 喝水提醒 (water)';
    RAISE NOTICE '   3. 🍽️  飲食提醒 (meal)';
    RAISE NOTICE '   4. 🏃 運動提醒 (exercise)';
    RAISE NOTICE '   5. 🏥 回診提醒 (appointment)';
    RAISE NOTICE '   6. 😴 睡眠提醒 (sleep)';
    RAISE NOTICE '';
    RAISE NOTICE '📖 詳細文檔請參考:';
    RAISE NOTICE '   - docs/daily-reminders-implementation-plan.md';
    RAISE NOTICE '   - docs/daily-reminders-architecture.md';
    RAISE NOTICE '';
    RAISE NOTICE '====================================================================';
END $$;
