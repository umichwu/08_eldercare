-- ================================================
-- ElderCare - 為 medication_reminders 添加 metadata 欄位
-- ================================================
-- 用途：儲存短期用藥的詳細設定（次數、天數、劑量等）
-- 建立日期：2025-01-21
-- ================================================

-- 1. 檢查欄位是否已存在
DO $$
BEGIN
  -- 如果 metadata 欄位不存在，則添加
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'medication_reminders'
      AND column_name = 'metadata'
  ) THEN
    -- 添加 metadata 欄位
    ALTER TABLE public.medication_reminders
    ADD COLUMN metadata JSONB DEFAULT '{}';

    RAISE NOTICE '✅ metadata 欄位已添加到 medication_reminders 表';
  ELSE
    RAISE NOTICE 'ℹ️  metadata 欄位已存在，跳過';
  END IF;
END $$;

-- 2. 添加註解
COMMENT ON COLUMN public.medication_reminders.metadata IS '短期用藥元資料（total_times, total_days, dosage_per_time, completed_times, remaining_times, notes 等）';

-- 3. 建立索引（可選，如果需要查詢 metadata 內容）
-- CREATE INDEX idx_medication_reminders_metadata ON public.medication_reminders USING gin (metadata);

-- 完成
SELECT '✅ medication_reminders 表已更新（metadata 欄位）' AS status;
