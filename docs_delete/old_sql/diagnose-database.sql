-- ============================================================================
-- 資料庫診斷查詢 - 檢查必要的資料表是否存在
-- ============================================================================
-- 使用方法：在 Supabase SQL Editor 中執行此查詢，檢查輸出結果
-- ============================================================================

-- 檢查必要的資料表
SELECT
    'user_profiles' AS table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_profiles'
    ) THEN '✅ 存在' ELSE '❌ 不存在' END AS status
UNION ALL
SELECT
    'elders',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'elders'
    ) THEN '✅ 存在' ELSE '❌ 不存在' END
UNION ALL
SELECT
    'family_members',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'family_members'
    ) THEN '✅ 存在' ELSE '❌ 不存在' END
UNION ALL
SELECT
    'elder_family_relations',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'elder_family_relations'
    ) THEN '✅ 存在' ELSE '❌ 不存在' END
ORDER BY table_name;

-- 分隔線
SELECT '========================================' AS separator;

-- 檢查是否已有地理位置相關的資料表
SELECT
    'safe_zones' AS geolocation_table,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'safe_zones'
    ) THEN '✅ 已存在' ELSE '❌ 尚未創建' END AS status
UNION ALL
SELECT
    'location_history',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'location_history'
    ) THEN '✅ 已存在' ELSE '❌ 尚未創建' END
UNION ALL
SELECT
    'geofence_alerts',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'geofence_alerts'
    ) THEN '✅ 已存在' ELSE '❌ 尚未創建' END
UNION ALL
SELECT
    'family_geolocation_settings',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'family_geolocation_settings'
    ) THEN '✅ 已存在' ELSE '❌ 尚未創建' END
ORDER BY geolocation_table;
