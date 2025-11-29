-- ============================================================================
-- 短期用藥功能完整實作 - 立即執行此 SQL
-- ============================================================================
-- 日期: 2025-11-22
-- 用途: 新增短期用藥次數控制和序號標記功能
--
-- ⚠️ 重要: 請在 Supabase Dashboard -> SQL Editor 中執行此檔案
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: 在 medication_reminders 表新增欄位
-- ============================================================================

-- 檢查並新增 is_short_term 欄位
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'medication_reminders'
        AND column_name = 'is_short_term'
    ) THEN
        ALTER TABLE public.medication_reminders
        ADD COLUMN is_short_term BOOLEAN DEFAULT false;

        RAISE NOTICE '✅ 已新增 medication_reminders.is_short_term';
    ELSE
        RAISE NOTICE 'ℹ️  medication_reminders.is_short_term 已存在';
    END IF;
END $$;

-- 檢查並新增 total_doses 欄位
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'medication_reminders'
        AND column_name = 'total_doses'
    ) THEN
        ALTER TABLE public.medication_reminders
        ADD COLUMN total_doses INTEGER;

        RAISE NOTICE '✅ 已新增 medication_reminders.total_doses';
    ELSE
        RAISE NOTICE 'ℹ️  medication_reminders.total_doses 已存在';
    END IF;
END $$;

-- 檢查並新增 doses_completed 欄位
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'medication_reminders'
        AND column_name = 'doses_completed'
    ) THEN
        ALTER TABLE public.medication_reminders
        ADD COLUMN doses_completed INTEGER DEFAULT 0;

        RAISE NOTICE '✅ 已新增 medication_reminders.doses_completed';
    ELSE
        RAISE NOTICE 'ℹ️  medication_reminders.doses_completed 已存在';
    END IF;
END $$;

-- 新增註解
COMMENT ON COLUMN public.medication_reminders.is_short_term IS '是否為短期用藥（感冒藥、抗生素等）';
COMMENT ON COLUMN public.medication_reminders.total_doses IS '短期用藥的總服用次數（例如：3天*4次/天=12次）';
COMMENT ON COLUMN public.medication_reminders.doses_completed IS '已完成的服用次數';

-- ============================================================================
-- STEP 2: 在 medication_logs 表新增欄位
-- ============================================================================

-- 檢查並新增 dose_sequence 欄位
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'medication_logs'
        AND column_name = 'dose_sequence'
    ) THEN
        ALTER TABLE public.medication_logs
        ADD COLUMN dose_sequence INTEGER;

        RAISE NOTICE '✅ 已新增 medication_logs.dose_sequence';
    ELSE
        RAISE NOTICE 'ℹ️  medication_logs.dose_sequence 已存在';
    END IF;
END $$;

-- 檢查並新增 dose_label 欄位
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'medication_logs'
        AND column_name = 'dose_label'
    ) THEN
        ALTER TABLE public.medication_logs
        ADD COLUMN dose_label VARCHAR(100);

        RAISE NOTICE '✅ 已新增 medication_logs.dose_label';
    ELSE
        RAISE NOTICE 'ℹ️  medication_logs.dose_label 已存在';
    END IF;
END $$;

-- 新增註解
COMMENT ON COLUMN public.medication_logs.dose_sequence IS '短期用藥的序號（第1次、第2次...）';
COMMENT ON COLUMN public.medication_logs.dose_label IS '顯示用的用藥標籤（例如：感冒藥-1）';

-- ============================================================================
-- STEP 3: 建立索引以提升查詢效能
-- ============================================================================

-- 為短期用藥查詢建立索引
CREATE INDEX IF NOT EXISTS idx_medication_reminders_short_term
ON public.medication_reminders(is_short_term, is_enabled)
WHERE is_short_term = true;

-- 為用藥序號建立索引
CREATE INDEX IF NOT EXISTS idx_medication_logs_dose_sequence
ON public.medication_logs(medication_id, dose_sequence)
WHERE dose_sequence IS NOT NULL;

-- 為 medication_reminder_id 建立索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_medication_logs_reminder_id
ON public.medication_logs(medication_reminder_id)
WHERE medication_reminder_id IS NOT NULL;

RAISE NOTICE '✅ 索引建立完成';

-- ============================================================================
-- STEP 4: 建立或替換觸發器函式 - 自動更新已完成次數
-- ============================================================================

CREATE OR REPLACE FUNCTION update_doses_completed()
RETURNS TRIGGER AS $$
BEGIN
    -- 只在狀態變更為 'taken' 或 'late' 時更新
    IF NEW.status IN ('taken', 'late')
       AND (OLD.status IS NULL OR OLD.status NOT IN ('taken', 'late'))
       AND NEW.medication_reminder_id IS NOT NULL THEN

        -- 更新對應的 reminder 的已完成次數
        UPDATE public.medication_reminders
        SET doses_completed = doses_completed + 1,
            updated_at = NOW()
        WHERE id = NEW.medication_reminder_id
          AND is_short_term = true;

        RAISE NOTICE '✅ 更新 doses_completed for reminder %', NEW.medication_reminder_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE '✅ 觸發器函式建立完成';

-- ============================================================================
-- STEP 5: 建立觸發器
-- ============================================================================

-- 先刪除舊的觸發器（如果存在）
DROP TRIGGER IF EXISTS trigger_update_doses_completed ON public.medication_logs;

-- 建立新的觸發器
CREATE TRIGGER trigger_update_doses_completed
    AFTER UPDATE OF status ON public.medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_doses_completed();

RAISE NOTICE '✅ 觸發器建立完成';

-- ============================================================================
-- STEP 6: 建立檢視 - 查看短期用藥的完成進度
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
    CASE
        WHEN mr.total_doses IS NOT NULL THEN mr.total_doses - mr.doses_completed
        ELSE NULL
    END AS remaining_doses,
    CASE
        WHEN mr.total_doses IS NOT NULL AND mr.doses_completed >= mr.total_doses THEN true
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

RAISE NOTICE '✅ 檢視建立完成';

-- ============================================================================
-- STEP 7: 顯示執行結果
-- ============================================================================

DO $$
DECLARE
    reminders_count INTEGER;
    logs_count INTEGER;
BEGIN
    -- 檢查欄位是否存在
    SELECT COUNT(*) INTO reminders_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'medication_reminders'
      AND column_name IN ('is_short_term', 'total_doses', 'doses_completed');

    SELECT COUNT(*) INTO logs_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'medication_logs'
      AND column_name IN ('dose_sequence', 'dose_label');

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 短期用藥功能安裝完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增欄位驗證:';
    RAISE NOTICE '  📋 medication_reminders: % 個新欄位', reminders_count;
    RAISE NOTICE '  📝 medication_logs: % 個新欄位', logs_count;
    RAISE NOTICE '';
    RAISE NOTICE '新增功能:';
    RAISE NOTICE '  ⚡ 自動更新已完成次數的觸發器';
    RAISE NOTICE '  📊 短期用藥進度檢視 (v_short_term_medication_progress)';
    RAISE NOTICE '  🔍 效能索引';
    RAISE NOTICE '';
    RAISE NOTICE '下一步:';
    RAISE NOTICE '  1. 重啟後端服務（讓程式碼生效）';
    RAISE NOTICE '  2. 測試建立短期用藥';
    RAISE NOTICE '  3. 檢查 Timeline 顯示';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- 使用範例（註解掉，供參考）
-- ============================================================================

/*
-- 範例 1: 建立短期用藥提醒（感冒藥，3天，每天4次，共12次）
INSERT INTO medication_reminders (
    medication_id,
    elder_id,
    cron_schedule,
    reminder_times,
    is_short_term,      -- ✅ 標記為短期用藥
    total_doses,        -- ✅ 總共12次
    doses_completed,    -- 預設為 0
    start_date,
    end_date,
    is_enabled
) VALUES (
    'your-medication-id',
    'your-elder-id',
    '0 9,13,18,22 * * *',  -- 每天 9:00, 13:00, 18:00, 22:00
    '{"times": ["09:00", "13:00", "18:00", "22:00"]}'::jsonb,
    true,  -- 短期用藥
    12,    -- 總共12次
    0,     -- 已完成 0 次
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '2 days',  -- 3天
    true
);

-- 範例 2: 查詢短期用藥進度
SELECT * FROM v_short_term_medication_progress
WHERE elder_id = 'your-elder-id';

-- 範例 3: 查詢某個用藥的所有記錄（含序號）
SELECT
    dose_sequence,
    dose_label,
    scheduled_time,
    actual_time,
    status
FROM medication_logs
WHERE medication_id = 'your-medication-id'
  AND dose_sequence IS NOT NULL
ORDER BY dose_sequence;

-- 範例 4: 手動重置某個提醒的完成次數
UPDATE medication_reminders
SET doses_completed = 0
WHERE id = 'your-reminder-id';
*/
