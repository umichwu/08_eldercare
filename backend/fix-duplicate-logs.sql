-- ============================================
-- 修復重複的用藥記錄問題
-- ============================================

-- 1. 先查看重複記錄的數量
SELECT
    medication_id,
    elder_id,
    scheduled_time,
    COUNT(*) as duplicate_count
FROM medication_logs
GROUP BY medication_id, elder_id, scheduled_time
HAVING COUNT(*) > 1
ORDER BY scheduled_time DESC;

-- 2. 刪除重複記錄，只保留最新的一筆
-- 使用 CTE 找出要刪除的記錄
WITH duplicate_logs AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY medication_id, elder_id, scheduled_time
            ORDER BY created_at DESC
        ) as rn
    FROM medication_logs
)
DELETE FROM medication_logs
WHERE id IN (
    SELECT id
    FROM duplicate_logs
    WHERE rn > 1
);

-- 3. 加入唯一性約束，防止未來產生重複記錄
-- 先檢查約束是否已存在
DO $$
BEGIN
    -- 如果約束不存在，則建立
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'medication_logs_unique_schedule'
    ) THEN
        ALTER TABLE medication_logs
        ADD CONSTRAINT medication_logs_unique_schedule
        UNIQUE (medication_id, elder_id, scheduled_time);

        RAISE NOTICE '✅ 已建立唯一性約束: medication_logs_unique_schedule';
    ELSE
        RAISE NOTICE '⚠️ 約束已存在: medication_logs_unique_schedule';
    END IF;
END $$;

-- 4. 驗證修復結果
SELECT
    COUNT(*) as total_logs,
    COUNT(DISTINCT (medication_id, elder_id, scheduled_time)) as unique_schedules
FROM medication_logs;

-- 5. 顯示今日的用藥記錄（用於驗證）
SELECT
    ml.id,
    m.medication_name,
    ml.scheduled_time,
    ml.status,
    ml.created_at
FROM medication_logs ml
JOIN medications m ON ml.medication_id = m.id
WHERE DATE(ml.scheduled_time) = CURRENT_DATE
ORDER BY ml.scheduled_time;
