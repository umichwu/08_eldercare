-- ============================================================================
-- 清理用藥相關資料表 - Timeline 問題排查
-- ============================================================================
-- 用途: 清空所有用藥設定相關的資料，以便重新測試
-- 建立日期: 2025-01-22
-- ============================================================================

-- ============================================================================
-- 警告: 此操作將清空以下資料表的所有資料：
--   1. medication_logs (用藥記錄 - Timeline 資料來源)
--   2. medication_reminders (用藥提醒設定)
--   3. medications (藥物基本資料)
--   4. medication_images (藥物圖片 - 如果存在)
--
-- 執行前請確認：
--   ✓ 已備份重要資料
--   ✓ 了解此操作不可逆
--   ✓ 確定要清空所有用藥資料
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: 顯示清理前的資料統計
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    logs_count INTEGER;
    reminders_count INTEGER;
    medications_count INTEGER;
    images_count INTEGER;
BEGIN
    -- 統計各表資料量
    SELECT COUNT(*) INTO logs_count FROM public.medication_logs;
    SELECT COUNT(*) INTO reminders_count FROM public.medication_reminders;
    SELECT COUNT(*) INTO medications_count FROM public.medications;

    -- 檢查 medication_images 表是否存在
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public'
               AND table_name = 'medication_images') THEN
        SELECT COUNT(*) INTO images_count FROM public.medication_images;
    ELSE
        images_count := 0;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '清理前資料統計:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 medication_logs (用藥記錄): % 筆', logs_count;
    RAISE NOTICE '⏰ medication_reminders (提醒設定): % 筆', reminders_count;
    RAISE NOTICE '💊 medications (藥物資料): % 筆', medications_count;
    RAISE NOTICE '🖼️  medication_images (藥物圖片): % 筆', images_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: 暫時停用 RLS (避免權限問題)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.medication_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_images DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- STEP 3: 刪除資料 (按照外鍵相依順序)
-- ----------------------------------------------------------------------------

-- 3.1 先刪除 medication_logs (最外層，被其他表參照最少)
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.medication_logs;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✅ 已刪除 medication_logs: % 筆', deleted_count;
END $$;

-- 3.2 刪除 medication_images (如果存在)
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public'
               AND table_name = 'medication_images') THEN
        EXECUTE 'DELETE FROM public.medication_images';
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '✅ 已刪除 medication_images: % 筆', deleted_count;
    ELSE
        RAISE NOTICE '⚠️  medication_images 表不存在，跳過';
    END IF;
END $$;

-- 3.3 刪除 medication_reminders
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.medication_reminders;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✅ 已刪除 medication_reminders: % 筆', deleted_count;
END $$;

-- 3.4 最後刪除 medications (最底層，被最多表參照)
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.medications;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✅ 已刪除 medications: % 筆', deleted_count;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 4: 重設序列 (如果有使用 SERIAL)
-- ----------------------------------------------------------------------------
-- 注意: 此專案使用 UUID，不需要重設序列

-- ----------------------------------------------------------------------------
-- STEP 5: 清理孤立的通知記錄 (可選)
-- ----------------------------------------------------------------------------
-- 清理可能相關的 notifications 表中的用藥通知
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public'
               AND table_name = 'notifications') THEN
        DELETE FROM public.notifications
        WHERE type IN ('medication_reminder', 'medication_missed', 'medication_stock_low');
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '🔔 已清理相關通知記錄: % 筆', deleted_count;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 6: 重新啟用 RLS
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_images ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- STEP 7: 驗證清理結果
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    logs_count INTEGER;
    reminders_count INTEGER;
    medications_count INTEGER;
    images_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO logs_count FROM public.medication_logs;
    SELECT COUNT(*) INTO reminders_count FROM public.medication_reminders;
    SELECT COUNT(*) INTO medications_count FROM public.medications;

    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public'
               AND table_name = 'medication_images') THEN
        SELECT COUNT(*) INTO images_count FROM public.medication_images;
    ELSE
        images_count := 0;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '清理後資料驗證:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 medication_logs: % 筆', logs_count;
    RAISE NOTICE '⏰ medication_reminders: % 筆', reminders_count;
    RAISE NOTICE '💊 medications: % 筆', medications_count;
    RAISE NOTICE '🖼️  medication_images: % 筆', images_count;
    RAISE NOTICE '========================================';

    IF logs_count = 0 AND reminders_count = 0 AND medications_count = 0 AND images_count = 0 THEN
        RAISE NOTICE '✅ 所有用藥資料已成功清空！';
    ELSE
        RAISE NOTICE '⚠️  警告: 仍有資料殘留，請檢查';
    END IF;
    RAISE NOTICE '';
END $$;

-- 提交事務
COMMIT;

-- ============================================================================
-- 清理完成！
-- ============================================================================
-- 下一步建議:
--   1. 在前端重新建立測試用藥資料
--   2. 檢查 Timeline 功能是否正常
--   3. 確認提醒設定是否正確產生 logs
--   4. 測試各種時間點的用藥記錄顯示
-- ============================================================================

-- ============================================================================
-- 備註: 如果只想清理特定長輩的資料
-- ============================================================================
-- 取消上面的 COMMIT，改用以下語句：
/*
BEGIN;

-- 替換成你的 elder_id
DO $$
DECLARE
    target_elder_id UUID := 'your-elder-id-here';
    logs_count INTEGER;
    reminders_count INTEGER;
    medications_count INTEGER;
BEGIN
    -- 先查詢該長輩的資料量
    SELECT COUNT(*) INTO logs_count
    FROM public.medication_logs WHERE elder_id = target_elder_id;

    SELECT COUNT(*) INTO reminders_count
    FROM public.medication_reminders WHERE elder_id = target_elder_id;

    SELECT COUNT(*) INTO medications_count
    FROM public.medications WHERE elder_id = target_elder_id;

    RAISE NOTICE '準備清理長輩 % 的資料:', target_elder_id;
    RAISE NOTICE '  medication_logs: % 筆', logs_count;
    RAISE NOTICE '  medication_reminders: % 筆', reminders_count;
    RAISE NOTICE '  medications: % 筆', medications_count;

    -- 執行刪除
    DELETE FROM public.medication_logs WHERE elder_id = target_elder_id;
    DELETE FROM public.medication_reminders WHERE elder_id = target_elder_id;
    DELETE FROM public.medications WHERE elder_id = target_elder_id;

    RAISE NOTICE '✅ 清理完成！';
END $$;

COMMIT;
*/
