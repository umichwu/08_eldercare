-- ============================================================
-- ElderCare 完整 RLS 政策修正腳本
-- ============================================================
-- 請在 Supabase SQL Editor 中執行此腳本
-- 網址: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- ============================================================
-- 1. ELDERS 表 - 長輩資料
-- ============================================================

-- 1.1 確保 RLS 已啟用
ALTER TABLE elders ENABLE ROW LEVEL SECURITY;

-- 1.2 刪除所有現有政策
DROP POLICY IF EXISTS "Users can view their own elder data" ON elders;
DROP POLICY IF EXISTS "Users can insert their own elder data" ON elders;
DROP POLICY IF EXISTS "Users can update their own elder data" ON elders;
DROP POLICY IF EXISTS "Allow authenticated users to insert their elder data" ON elders;
DROP POLICY IF EXISTS "Allow users to read their own elder data" ON elders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON elders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON elders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON elders;

-- 1.3 建立新的 RLS 政策

-- SELECT: 允許使用者查看自己的長輩資料
CREATE POLICY "Users can view their own elder data" ON elders
    FOR SELECT
    TO authenticated
    USING (
        user_profile_id IN (
            SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
        )
    );

-- INSERT: 允許使用者插入自己的長輩資料
CREATE POLICY "Users can insert their own elder data" ON elders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_profile_id IN (
            SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
        )
    );

-- UPDATE: 允許使用者更新自己的長輩資料
CREATE POLICY "Users can update their own elder data" ON elders
    FOR UPDATE
    TO authenticated
    USING (
        user_profile_id IN (
            SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_profile_id IN (
            SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
        )
    );

-- DELETE: 允許使用者刪除自己的長輩資料
CREATE POLICY "Users can delete their own elder data" ON elders
    FOR DELETE
    TO authenticated
    USING (
        user_profile_id IN (
            SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- 2. MEDICATIONS 表 - 藥物資料
-- ============================================================

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

-- 刪除現有政策
DROP POLICY IF EXISTS "Users can manage their medications" ON medications;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON medications;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON medications;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON medications;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON medications;

-- SELECT: 查看自己長輩的藥物
CREATE POLICY "Users can view their medications" ON medications
    FOR SELECT
    TO authenticated
    USING (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- INSERT: 新增自己長輩的藥物
CREATE POLICY "Users can insert their medications" ON medications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- UPDATE: 更新自己長輩的藥物
CREATE POLICY "Users can update their medications" ON medications
    FOR UPDATE
    TO authenticated
    USING (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- DELETE: 刪除自己長輩的藥物
CREATE POLICY "Users can delete their medications" ON medications
    FOR DELETE
    TO authenticated
    USING (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- 3. MEDICATION_REMINDERS 表 - 用藥提醒
-- ============================================================

ALTER TABLE medication_reminders ENABLE ROW LEVEL SECURITY;

-- 刪除現有政策
DROP POLICY IF EXISTS "Users can manage their reminders" ON medication_reminders;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON medication_reminders;

-- SELECT
CREATE POLICY "Users can view their reminders" ON medication_reminders
    FOR SELECT
    TO authenticated
    USING (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- INSERT
CREATE POLICY "Users can insert their reminders" ON medication_reminders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- UPDATE
CREATE POLICY "Users can update their reminders" ON medication_reminders
    FOR UPDATE
    TO authenticated
    USING (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- DELETE
CREATE POLICY "Users can delete their reminders" ON medication_reminders
    FOR DELETE
    TO authenticated
    USING (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- 4. MEDICATION_LOGS 表 - 用藥記錄
-- ============================================================

ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- 刪除現有政策
DROP POLICY IF EXISTS "Users can manage their logs" ON medication_logs;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON medication_logs;

-- SELECT
CREATE POLICY "Users can view their logs" ON medication_logs
    FOR SELECT
    TO authenticated
    USING (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- INSERT
CREATE POLICY "Users can insert their logs" ON medication_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- UPDATE
CREATE POLICY "Users can update their logs" ON medication_logs
    FOR UPDATE
    TO authenticated
    USING (
        elder_id IN (
            SELECT e.id FROM elders e
            JOIN user_profiles up ON e.user_profile_id = up.id
            WHERE up.auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- 5. 驗證政策已建立
-- ============================================================

-- 查看 elders 表的政策
SELECT
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename = 'elders'
ORDER BY cmd;

-- 查看 medications 表的政策
SELECT
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename = 'medications'
ORDER BY cmd;

-- 查看 medication_reminders 表的政策
SELECT
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename = 'medication_reminders'
ORDER BY cmd;

-- 查看 medication_logs 表的政策
SELECT
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename = 'medication_logs'
ORDER BY cmd;

-- ============================================================
-- 完成！
-- ============================================================
-- 執行成功後，你應該看到每個表都有 4 個政策（SELECT, INSERT, UPDATE, DELETE）
