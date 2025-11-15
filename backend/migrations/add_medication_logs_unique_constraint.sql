-- ============================================
-- 加入唯一性約束到 medication_logs 表
-- ============================================
-- 目的: 防止產生重複的用藥記錄
-- 日期: 2025-01-15
-- ============================================

DO $$
BEGIN
    -- 檢查約束是否已存在
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'medication_logs_unique_schedule'
    ) THEN
        -- 加入唯一性約束
        ALTER TABLE medication_logs
        ADD CONSTRAINT medication_logs_unique_schedule
        UNIQUE (medication_id, elder_id, scheduled_time);

        RAISE NOTICE '✅ 已建立唯一性約束: medication_logs_unique_schedule';
    ELSE
        RAISE NOTICE '⚠️  約束已存在: medication_logs_unique_schedule';
    END IF;
END $$;

-- 驗證約束已建立
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'medication_logs_unique_schedule';
