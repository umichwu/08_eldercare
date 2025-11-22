-- ============================================================================
-- 快速清理用藥資料 - 簡化版
-- ============================================================================
-- 警告: 此操作將清空所有用藥相關資料，不可逆！
-- ============================================================================

-- 暫時停用 RLS
ALTER TABLE IF EXISTS public.medication_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_images DISABLE ROW LEVEL SECURITY;

-- 清空資料 (按照外鍵相依順序)
DELETE FROM public.medication_logs;
DELETE FROM public.medication_images WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medication_images');
DELETE FROM public.medication_reminders;
DELETE FROM public.medications;

-- 清理相關通知
DELETE FROM public.notifications WHERE type IN ('medication_reminder', 'medication_missed', 'medication_stock_low');

-- 重新啟用 RLS
ALTER TABLE IF EXISTS public.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_images ENABLE ROW LEVEL SECURITY;

-- 顯示結果
SELECT 'medication_logs' AS table_name, COUNT(*) AS remaining_rows FROM public.medication_logs
UNION ALL
SELECT 'medication_reminders', COUNT(*) FROM public.medication_reminders
UNION ALL
SELECT 'medications', COUNT(*) FROM public.medications;
