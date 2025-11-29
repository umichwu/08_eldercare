-- ============================================================================
-- ElderCare Companion - 資料庫驗證腳本 v2
-- ============================================================================
-- 用途: 驗證資料庫是否正確建立（使用 SELECT 顯示結果）
-- 使用方式: 在 Supabase SQL Editor 中逐步執行每個查詢
-- ============================================================================

-- ============================================================================
-- PART 1: 檢查所有表格是否已建立
-- ============================================================================

SELECT
    '📊 檢查表格是否存在' AS "驗證項目",
    ' ' AS "表格名稱",
    ' ' AS "狀態";

SELECT
    '表格檢查' AS "驗證項目",
    expected_table AS "表格名稱",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = expected_table
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END AS "狀態"
FROM (
    VALUES
        ('user_profiles'),
        ('elders'),
        ('family_members'),
        ('elder_family_relations'),
        ('conversations'),
        ('messages'),
        ('conversation_summaries'),
        ('medications'),
        ('medication_reminders'),
        ('medication_logs'),
        ('emotional_journals'),
        ('spiritual_contents'),
        ('spiritual_care_tasks'),
        ('spiritual_weekly_reports'),
        ('elder_activity_tracking'),
        ('family_view_logs')
) AS expected_tables(expected_table)
ORDER BY expected_table;

-- 統計結果
SELECT
    '表格統計' AS "驗證項目",
    COUNT(*) AS "已建立的表格數量",
    '16' AS "預期表格數量",
    CASE
        WHEN COUNT(*) = 16 THEN '✅ 完整'
        ELSE '⚠️ 不完整'
    END AS "狀態"
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'user_profiles', 'elders', 'family_members', 'elder_family_relations',
    'conversations', 'messages', 'conversation_summaries',
    'medications', 'medication_reminders', 'medication_logs',
    'emotional_journals', 'spiritual_contents', 'spiritual_care_tasks',
    'spiritual_weekly_reports', 'elder_activity_tracking', 'family_view_logs'
);

-- ============================================================================
-- PART 2: 檢查視圖是否已建立
-- ============================================================================

SELECT
    '📊 檢查視圖是否存在' AS "驗證項目",
    ' ' AS "視圖名稱",
    ' ' AS "狀態";

SELECT
    '視圖檢查' AS "驗證項目",
    expected_view AS "視圖名稱",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views
            WHERE table_schema = 'public'
            AND table_name = expected_view
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END AS "狀態"
FROM (
    VALUES
        ('emotional_trends'),
        ('v_elder_current_medications'),
        ('v_today_medication_schedule')
) AS expected_views(expected_view)
ORDER BY expected_view;

-- 統計結果
SELECT
    '視圖統計' AS "驗證項目",
    COUNT(*) AS "已建立的視圖數量",
    '3' AS "預期視圖數量",
    CASE
        WHEN COUNT(*) = 3 THEN '✅ 完整'
        ELSE '⚠️ 不完整'
    END AS "狀態"
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('emotional_trends', 'v_elder_current_medications', 'v_today_medication_schedule');

-- ============================================================================
-- PART 3: 檢查種子資料是否已匯入
-- ============================================================================

SELECT
    '🌱 檢查種子資料' AS "驗證項目",
    ' ' AS "數量",
    ' ' AS "狀態";

SELECT
    '種子資料檢查' AS "驗證項目",
    COUNT(*) AS "心靈語料總數",
    CASE
        WHEN COUNT(*) >= 20 THEN '✅ 已匯入 (預期 20+)'
        WHEN COUNT(*) > 0 THEN '⚠️ 部分匯入 (預期 20+)'
        ELSE '❌ 未匯入'
    END AS "狀態"
FROM public.spiritual_contents;

-- ============================================================================
-- PART 4: 檢查種子資料的分佈
-- ============================================================================

SELECT
    '📊 種子資料分佈' AS "驗證項目",
    ' ' AS "宗教信仰",
    ' ' AS "語料數量",
    ' ' AS "分類";

SELECT
    '種子資料分佈' AS "驗證項目",
    religion AS "宗教信仰",
    COUNT(*)::TEXT AS "語料數量",
    STRING_AGG(DISTINCT category, ', ') AS "分類"
FROM public.spiritual_contents
GROUP BY religion
ORDER BY religion;

-- ============================================================================
-- PART 5: 檢查 RLS 是否已啟用
-- ============================================================================

SELECT
    '🔒 檢查 RLS 政策' AS "驗證項目",
    ' ' AS "表格名稱",
    ' ' AS "RLS 狀態";

SELECT
    'RLS 檢查' AS "驗證項目",
    tablename AS "表格名稱",
    CASE
        WHEN rowsecurity = true THEN '✅ 已啟用'
        ELSE '❌ 未啟用'
    END AS "RLS 狀態"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'user_profiles', 'elders', 'family_members', 'elder_family_relations',
    'conversations', 'messages', 'conversation_summaries',
    'medications', 'medication_reminders', 'medication_logs',
    'emotional_journals', 'spiritual_contents', 'spiritual_care_tasks',
    'spiritual_weekly_reports', 'elder_activity_tracking', 'family_view_logs'
)
ORDER BY tablename;

-- RLS 統計
SELECT
    'RLS 統計' AS "驗證項目",
    COUNT(*) FILTER (WHERE rowsecurity = true)::TEXT AS "已啟用 RLS 的表格",
    COUNT(*) FILTER (WHERE rowsecurity = false)::TEXT AS "未啟用 RLS 的表格",
    CASE
        WHEN COUNT(*) FILTER (WHERE rowsecurity = false) = 0 THEN '✅ 全部已啟用'
        ELSE '⚠️ 有表格未啟用'
    END AS "狀態"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'user_profiles', 'elders', 'family_members', 'elder_family_relations',
    'conversations', 'messages', 'conversation_summaries',
    'medications', 'medication_reminders', 'medication_logs',
    'emotional_journals', 'spiritual_contents', 'spiritual_care_tasks',
    'spiritual_weekly_reports', 'elder_activity_tracking', 'family_view_logs'
);

-- ============================================================================
-- PART 6: 檢查 RLS 政策數量
-- ============================================================================

SELECT
    '📋 RLS 政策詳情' AS "驗證項目",
    ' ' AS "表格名稱",
    ' ' AS "政策數量",
    ' ' AS "政策名稱";

SELECT
    'RLS 政策' AS "驗證項目",
    tablename AS "表格名稱",
    COUNT(*)::TEXT AS "政策數量",
    STRING_AGG(policyname, ', ') AS "政策名稱"
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- PART 7: 檢查觸發器是否已建立
-- ============================================================================

SELECT
    '⚡ 檢查觸發器' AS "驗證項目",
    ' ' AS "表格名稱",
    ' ' AS "觸發器名稱";

SELECT
    '觸發器檢查' AS "驗證項目",
    event_object_table AS "表格名稱",
    trigger_name AS "觸發器名稱"
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 觸發器統計
SELECT
    '觸發器統計' AS "驗證項目",
    COUNT(*)::TEXT AS "觸發器總數",
    CASE
        WHEN COUNT(*) > 0 THEN '✅ 已建立'
        ELSE '❌ 未建立'
    END AS "狀態"
FROM information_schema.triggers
WHERE event_object_schema = 'public';

-- ============================================================================
-- PART 8: 檢查函數是否已建立
-- ============================================================================

SELECT
    '⚙️ 檢查函數' AS "驗證項目",
    ' ' AS "函數名稱",
    ' ' AS "狀態";

SELECT
    '函數檢查' AS "驗證項目",
    expected_function AS "函數名稱",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname = expected_function
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END AS "狀態"
FROM (
    VALUES
        ('update_updated_at_column'),
        ('calculate_elder_age'),
        ('update_conversation_message_count'),
        ('fn_update_medication_reminder_stats'),
        ('handle_new_user')
) AS expected_functions(expected_function)
ORDER BY expected_function;

-- 函數統計
SELECT
    '函數統計' AS "驗證項目",
    COUNT(*)::TEXT AS "已建立的函數數量",
    '5' AS "預期函數數量",
    CASE
        WHEN COUNT(*) = 5 THEN '✅ 完整'
        ELSE '⚠️ 不完整'
    END AS "狀態"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'update_updated_at_column',
    'calculate_elder_age',
    'update_conversation_message_count',
    'fn_update_medication_reminder_stats',
    'handle_new_user'
);

-- ============================================================================
-- PART 9: 檢查擴展功能是否已啟用
-- ============================================================================

SELECT
    '🔌 檢查擴展功能' AS "驗證項目",
    ' ' AS "擴展名稱",
    ' ' AS "狀態";

SELECT
    '擴展功能檢查' AS "驗證項目",
    expected_extension AS "擴展名稱",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_extension
            WHERE extname = expected_extension
        ) THEN '✅ 已啟用'
        ELSE '❌ 未啟用'
    END AS "狀態"
FROM (
    VALUES
        ('uuid-ossp'),
        ('vector'),
        ('pg_trgm'),
        ('postgis')
) AS expected_extensions(expected_extension)
ORDER BY expected_extension;

-- ============================================================================
-- PART 10: 檢查欄位擴充是否完成
-- ============================================================================

SELECT
    '📋 檢查欄位擴充' AS "驗證項目",
    ' ' AS "表格.欄位",
    ' ' AS "狀態";

-- 檢查 user_profiles 的擴充欄位
SELECT
    '欄位擴充檢查' AS "驗證項目",
    'user_profiles.' || expected_column AS "表格.欄位",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'user_profiles'
            AND column_name = expected_column
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END AS "狀態"
FROM (
    VALUES
        ('spiritual_preference'),
        ('spiritual_details'),
        ('mindfulness_enabled'),
        ('privacy_level'),
        ('fcm_token'),
        ('fcm_token_updated_at')
) AS user_profile_columns(expected_column);

-- 檢查 messages 的擴充欄位
SELECT
    '欄位擴充檢查' AS "驗證項目",
    'messages.' || expected_column AS "表格.欄位",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'messages'
            AND column_name = expected_column
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END AS "狀態"
FROM (
    VALUES
        ('emotion_detected'),
        ('spiritual_content_used'),
        ('mindfulness_trigger')
) AS message_columns(expected_column);

-- 檢查 elders 的擴充欄位
SELECT
    '欄位擴充檢查' AS "驗證項目",
    'elders.' || expected_column AS "表格.欄位",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'elders'
            AND column_name = expected_column
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END AS "狀態"
FROM (
    VALUES
        ('fcm_token'),
        ('fcm_token_updated_at'),
        ('device_info')
) AS elder_columns(expected_column);

-- 檢查 family_members 的擴充欄位
SELECT
    '欄位擴充檢查' AS "驗證項目",
    'family_members.' || expected_column AS "表格.欄位",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'family_members'
            AND column_name = expected_column
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END AS "狀態"
FROM (
    VALUES
        ('fcm_token'),
        ('fcm_token_updated_at'),
        ('device_info')
) AS family_columns(expected_column);

-- ============================================================================
-- 最終總結
-- ============================================================================

SELECT
    '============================================================================' AS "總結",
    ' ' AS "備註1",
    ' ' AS "備註2";

SELECT
    '✅ 資料庫驗證完成' AS "驗證完成",
    '請檢查以上所有查詢結果' AS "說明1",
    '確保所有項目都顯示 ✅' AS "說明2";

SELECT
    '檢查清單' AS "項目",
    '預期結果' AS "數值",
    ' ' AS "說明"
UNION ALL
SELECT '1. 表格數量', '16 個', '所有核心表格已建立'
UNION ALL
SELECT '2. 視圖數量', '3 個', '所有視圖已建立'
UNION ALL
SELECT '3. 種子資料', '20+ 條', 'spiritual_contents 已有資料'
UNION ALL
SELECT '4. RLS 啟用', '16 個表格', '所有表格都已啟用 RLS'
UNION ALL
SELECT '5. RLS 政策', '多個', '每個表格都有政策'
UNION ALL
SELECT '6. 觸發器', '多個', '自動化觸發器已建立'
UNION ALL
SELECT '7. 函數', '5 個', '所有核心函數已建立'
UNION ALL
SELECT '8. 擴展功能', '4 個', 'uuid-ossp, vector, pg_trgm, postgis'
UNION ALL
SELECT '9. 欄位擴充', '多個', 'FCM Token、心靈照護欄位已加入';

SELECT
    '如果發現 ❌ 或 ⚠️' AS "問題處理",
    '請重新執行' AS "動作",
    'supabase_complete_schema_with_auth.sql' AS "檔案";
