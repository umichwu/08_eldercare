-- ============================================================================
-- 短期用藥功能增強 - 新增欄位
-- ============================================================================
-- 目的: 支援短期用藥的精確次數控制和索引標記
-- 日期: 2025-11-22
-- ============================================================================

-- ============================================================================
-- STEP 1: 在 medication_reminders 表新增欄位
-- ============================================================================

-- 1.1 新增短期用藥相關欄位
ALTER TABLE public.medication_reminders
ADD COLUMN IF NOT EXISTS is_short_term BOOLEAN DEFAULT false;

ALTER TABLE public.medication_reminders
ADD COLUMN IF NOT EXISTS total_doses INTEGER;  -- 總共需要服用的次數（例如：12次）

ALTER TABLE public.medication_reminders
ADD COLUMN IF NOT EXISTS doses_completed INTEGER DEFAULT 0;  -- 已完成的次數

COMMENT ON COLUMN public.medication_reminders.is_short_term IS '是否為短期用藥（感冒藥、抗生素等）';
COMMENT ON COLUMN public.medication_reminders.total_doses IS '短期用藥的總服用次數（例如：3天*4次/天=12次）';
COMMENT ON COLUMN public.medication_reminders.doses_completed IS '已完成的服用次數';

-- ============================================================================
-- STEP 2: 在 medication_logs 表新增欄位
-- ============================================================================

-- 2.1 新增用藥序號欄位
ALTER TABLE public.medication_logs
ADD COLUMN IF NOT EXISTS dose_sequence INTEGER;  -- 用藥序號（第幾次，例如：1, 2, 3, ..., 12）

ALTER TABLE public.medication_logs
ADD COLUMN IF NOT EXISTS dose_label VARCHAR(50);  -- 用藥標籤（例如：「感冒藥-1」、「感冒藥-2」）

COMMENT ON COLUMN public.medication_logs.dose_sequence IS '短期用藥的序號（第1次、第2次...）';
COMMENT ON COLUMN public.medication_logs.dose_label IS '顯示用的用藥標籤（例如：感冒藥-1）';

-- ============================================================================
-- STEP 3: 建立索引以提升查詢效能
-- ============================================================================

-- 3.1 為短期用藥查詢建立索引
CREATE INDEX IF NOT EXISTS idx_medication_reminders_short_term
ON public.medication_reminders(is_short_term, is_enabled)
WHERE is_short_term = true;

-- 3.2 為用藥序號建立索引
CREATE INDEX IF NOT EXISTS idx_medication_logs_dose_sequence
ON public.medication_logs(medication_id, dose_sequence)
WHERE dose_sequence IS NOT NULL;

-- ============================================================================
-- STEP 4: 建立觸發器函式 - 自動更新已完成次數
-- ============================================================================

-- 4.1 建立或替換函式：當 medication_log 狀態變更為 taken 時，更新已完成次數
CREATE OR REPLACE FUNCTION update_doses_completed()
RETURNS TRIGGER AS $$
BEGIN
    -- 只在狀態變更為 'taken' 或 'late' 時更新
    IF NEW.status IN ('taken', 'late') AND (OLD.status IS NULL OR OLD.status NOT IN ('taken', 'late')) THEN
        -- 更新對應的 reminder 的已完成次數
        UPDATE public.medication_reminders
        SET doses_completed = doses_completed + 1,
            updated_at = NOW()
        WHERE id = NEW.medication_reminder_id
          AND is_short_term = true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.2 建立觸發器
DROP TRIGGER IF EXISTS trigger_update_doses_completed ON public.medication_logs;
CREATE TRIGGER trigger_update_doses_completed
    AFTER UPDATE OF status ON public.medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_doses_completed();

-- ============================================================================
-- STEP 5: 建立檢視 - 查看短期用藥的完成進度
-- ============================================================================

CREATE OR REPLACE VIEW v_short_term_medication_progress AS
SELECT
    mr.id AS reminder_id,
    m.id AS medication_id,
    m.medication_name,
    e.id AS elder_id,
    e.name AS elder_name,
    mr.start_date,
    mr.end_date,
    mr.total_doses,
    mr.doses_completed,
    CASE
        WHEN mr.total_doses > 0 THEN
            ROUND((mr.doses_completed::NUMERIC / mr.total_doses::NUMERIC) * 100, 2)
        ELSE 0
    END AS completion_percentage,
    mr.total_doses - mr.doses_completed AS remaining_doses,
    CASE
        WHEN mr.doses_completed >= mr.total_doses THEN true
        ELSE false
    END AS is_completed,
    mr.is_enabled,
    mr.created_at,
    mr.updated_at
FROM public.medication_reminders mr
JOIN public.medications m ON mr.medication_id = m.id
JOIN public.elders e ON mr.elder_id = e.id
WHERE mr.is_short_term = true
ORDER BY mr.created_at DESC;

COMMENT ON VIEW v_short_term_medication_progress IS '短期用藥完成進度檢視';

-- ============================================================================
-- STEP 6: 顯示修改結果
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 短期用藥欄位新增完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增欄位:';
    RAISE NOTICE '  📋 medication_reminders:';
    RAISE NOTICE '     - is_short_term (BOOLEAN)';
    RAISE NOTICE '     - total_doses (INTEGER)';
    RAISE NOTICE '     - doses_completed (INTEGER)';
    RAISE NOTICE '';
    RAISE NOTICE '  📝 medication_logs:';
    RAISE NOTICE '     - dose_sequence (INTEGER)';
    RAISE NOTICE '     - dose_label (VARCHAR)';
    RAISE NOTICE '';
    RAISE NOTICE '新增功能:';
    RAISE NOTICE '  ⚡ 自動更新已完成次數的觸發器';
    RAISE NOTICE '  📊 短期用藥進度檢視 (v_short_term_medication_progress)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 使用範例
-- ============================================================================

/*
-- 1. 建立短期用藥提醒（感冒藥，3天，每天4次，共12次）
INSERT INTO medication_reminders (
    medication_id,
    elder_id,
    cron_schedule,
    reminder_times,
    is_short_term,
    total_doses,
    start_date,
    end_date
) VALUES (
    'medication-uuid',
    'elder-uuid',
    '0 9,13,18,22 * * *',  -- 每天 9:00, 13:00, 18:00, 22:00
    '{"times": ["09:00", "13:00", "18:00", "22:00"]}',
    true,  -- 短期用藥
    12,    -- 總共12次
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '2 days'  -- 3天（包含今天）
);

-- 2. 查詢短期用藥進度
SELECT * FROM v_short_term_medication_progress WHERE elder_id = 'elder-uuid';

-- 3. 查詢某個用藥的所有記錄（含序號）
SELECT
    dose_sequence,
    dose_label,
    scheduled_time,
    actual_time,
    status
FROM medication_logs
WHERE medication_id = 'medication-uuid'
  AND dose_sequence IS NOT NULL
ORDER BY dose_sequence;
*/
