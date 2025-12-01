-- ===================================
-- 短期用藥提醒功能資料庫結構
-- ===================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 1.1 刪除視圖
DROP VIEW IF EXISTS public.short_term_medication_reminders CASCADE;

-- 1.2 刪除觸發器
DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_update_short_term_medication ON public.medication_logs;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 1.3 刪除函數
DROP FUNCTION IF EXISTS public.update_short_term_medication_progress() CASCADE;
DROP FUNCTION IF EXISTS public.is_short_term_medication_completed(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.restore_short_term_medication(UUID, INTEGER, INTEGER) CASCADE;

-- ============================================================================
-- STEP 2: 建立短期用藥功能
-- ============================================================================

-- 2.1 為 medication_reminders 表增加 metadata 欄位
ALTER TABLE public.medication_reminders
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2.2 增加索引以加速查詢短期用藥
CREATE INDEX IF NOT EXISTS idx_medication_reminders_metadata
ON public.medication_reminders USING GIN (metadata)
WHERE metadata IS NOT NULL;

-- 2.3 增加註解說明 metadata 欄位的用途
COMMENT ON COLUMN public.medication_reminders.metadata IS '
短期用藥提醒的額外資訊，JSON 格式：
{
  "is_short_term": true,           // 是否為短期用藥
  "total_times": 3,                // 總共需要服用幾次
  "total_days": 5,                 // 總共需要服用幾天
  "completed_times": 1,            // 已完成次數
  "remaining_times": 2,            // 剩餘次數
  "start_date": "2025-01-01",      // 開始日期
  "end_date": "2025-01-05",        // 結束日期
  "dosage_per_time": "2 顆",       // 每次劑量
  "notes": "飯後服用"               // 備註
}
';

-- 2.4 建立輔助函數：檢查短期用藥是否已完成
CREATE OR REPLACE FUNCTION is_short_term_medication_completed(reminder_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    reminder_metadata JSONB;
    total_times INTEGER;
    completed_times INTEGER;
BEGIN
    -- 取得提醒的 metadata
    SELECT metadata INTO reminder_metadata
    FROM public.medication_reminders
    WHERE id = reminder_id;

    -- 如果不是短期用藥，返回 false
    IF reminder_metadata IS NULL OR
       (reminder_metadata->>'is_short_term')::BOOLEAN IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    -- 取得總次數和已完成次數
    total_times := (reminder_metadata->>'total_times')::INTEGER;
    completed_times := (reminder_metadata->>'completed_times')::INTEGER;

    -- 判斷是否已完成
    RETURN completed_times >= total_times;
END;
$$ LANGUAGE plpgsql;

-- 2.5 建立觸發器函數：當服藥記錄新增時，自動更新短期用藥的完成次數
CREATE OR REPLACE FUNCTION update_short_term_medication_progress()
RETURNS TRIGGER AS $$
DECLARE
    reminder_metadata JSONB;
    completed_count INTEGER;
    total_times INTEGER;
BEGIN
    -- 如果服藥狀態不是 taken 或 partial，則不處理
    IF NEW.status NOT IN ('taken', 'partial') THEN
        RETURN NEW;
    END IF;

    -- 取得對應的提醒記錄的 metadata
    SELECT metadata INTO reminder_metadata
    FROM public.medication_reminders
    WHERE id = NEW.reminder_id;

    -- 如果不是短期用藥，則不處理
    IF reminder_metadata IS NULL OR
       (reminder_metadata->>'is_short_term')::BOOLEAN IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    -- 計算已完成次數（從 medication_logs 統計）
    SELECT COUNT(*) INTO completed_count
    FROM public.medication_logs
    WHERE reminder_id = NEW.reminder_id
    AND status IN ('taken', 'partial');

    -- 取得總次數
    total_times := (reminder_metadata->>'total_times')::INTEGER;

    -- 更新 metadata 中的 completed_times 和 remaining_times
    UPDATE public.medication_reminders
    SET metadata = jsonb_set(
        jsonb_set(
            metadata,
            '{completed_times}',
            to_jsonb(completed_count)
        ),
        '{remaining_times}',
        to_jsonb(GREATEST(total_times - completed_count, 0))
    )
    WHERE id = NEW.reminder_id;

    -- 如果已完成所有次數，將提醒設為非活動狀態
    IF completed_count >= total_times THEN
        UPDATE public.medication_reminders
        SET is_enabled = FALSE
        WHERE id = NEW.reminder_id;

        RAISE NOTICE '短期用藥已完成，提醒已停用: %', NEW.reminder_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.6 建立觸發器
CREATE TRIGGER trigger_update_short_term_medication
AFTER INSERT ON public.medication_logs
FOR EACH ROW
EXECUTE FUNCTION update_short_term_medication_progress();

-- 2.7 建立視圖：短期用藥提醒列表
CREATE OR REPLACE VIEW public.short_term_medication_reminders AS
SELECT
    mr.id,
    mr.elder_id,
    mr.medication_id,
    m.medication_name,
    m.dosage,
    mr.metadata->>'total_times' AS total_times,
    mr.metadata->>'total_days' AS total_days,
    mr.metadata->>'completed_times' AS completed_times,
    mr.metadata->>'remaining_times' AS remaining_times,
    mr.metadata->>'start_date' AS start_date,
    mr.metadata->>'end_date' AS end_date,
    mr.metadata->>'dosage_per_time' AS dosage_per_time,
    mr.metadata->>'notes' AS notes,
    mr.is_enabled,
    mr.created_at
FROM public.medication_reminders mr
INNER JOIN public.medications m ON mr.medication_id = m.id
WHERE mr.metadata->>'is_short_term' = 'true'
ORDER BY mr.created_at DESC;

-- 2.8 建立函數：還原短期用藥設定（重新啟用提醒）
CREATE OR REPLACE FUNCTION restore_short_term_medication(
    p_reminder_id UUID,
    p_total_times INTEGER DEFAULT NULL,
    p_total_days INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    current_metadata JSONB;
    new_total_times INTEGER;
    new_total_days INTEGER;
    result JSONB;
BEGIN
    -- 取得當前的 metadata
    SELECT metadata INTO current_metadata
    FROM public.medication_reminders
    WHERE id = p_reminder_id;

    -- 檢查是否為短期用藥
    IF current_metadata IS NULL OR
       (current_metadata->>'is_short_term')::BOOLEAN IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '此提醒不是短期用藥'
        );
    END IF;

    -- 使用提供的次數，或使用原始的總次數
    new_total_times := COALESCE(p_total_times, (current_metadata->>'total_times')::INTEGER);
    new_total_days := COALESCE(p_total_days, (current_metadata->>'total_days')::INTEGER);

    -- 更新 metadata
    UPDATE public.medication_reminders
    SET
        metadata = jsonb_set(
            jsonb_set(
                jsonb_set(
                    current_metadata,
                    '{completed_times}',
                    '0'
                ),
                '{remaining_times}',
                to_jsonb(new_total_times)
            ),
            '{total_times}',
            to_jsonb(new_total_times)
        ),
        is_enabled = TRUE
    WHERE id = p_reminder_id;

    -- 返回結果
    SELECT jsonb_build_object(
        'success', true,
        'message', '短期用藥提醒已還原',
        'reminder_id', p_reminder_id,
        'total_times', new_total_times,
        'total_days', new_total_days
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- 使用範例
-- ===================================

/*
-- 建立短期用藥提醒
INSERT INTO public.medication_reminders (
    elder_id,
    medication_id,
    cron_schedule,
    is_enabled,
    metadata
) VALUES (
    'elder-uuid-here',
    'medication-uuid-here',
    '0 8,20 * * *',  -- 每天早上 8:00 和晚上 8:00
    true,
    '{
        "is_short_term": true,
        "total_times": 6,
        "total_days": 3,
        "completed_times": 0,
        "remaining_times": 6,
        "start_date": "2025-01-01",
        "end_date": "2025-01-03",
        "dosage_per_time": "2 顆",
        "notes": "早晚各一次，飯後服用"
    }'::jsonb
);

-- 查詢短期用藥提醒
SELECT * FROM public.short_term_medication_reminders
WHERE elder_id = 'elder-uuid-here';

-- 檢查是否已完成
SELECT is_short_term_medication_completed('reminder-uuid-here');

-- 還原短期用藥提醒
SELECT restore_short_term_medication(
    'reminder-uuid-here',  -- reminder_id
    6,                     -- 新的總次數（可選）
    3                      -- 新的總天數（可選）
);
*/
