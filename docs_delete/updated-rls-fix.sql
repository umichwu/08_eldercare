-- ============================================================
-- ElderCare 更新的 RLS 政策（使用 auth_user_id）
-- ============================================================
-- 請在 Supabase SQL Editor 中執行此腳本

-- ============================================================
-- 1. ELDERS 表 - 使用 auth_user_id 直接關聯
-- ============================================================

ALTER TABLE elders ENABLE ROW LEVEL SECURITY;

-- 刪除所有現有政策
DROP POLICY IF EXISTS "Users can view their own elder data" ON elders;
DROP POLICY IF EXISTS "Users can insert their own elder data" ON elders;
DROP POLICY IF EXISTS "Users can update their own elder data" ON elders;
DROP POLICY IF EXISTS "Users can delete their own elder data" ON elders;
DROP POLICY IF EXISTS "Allow authenticated users to insert their elder data" ON elders;
DROP POLICY IF EXISTS "Allow users to read their own elder data" ON elders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON elders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON elders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON elders;

-- 建立新的政策（使用 auth_user_id）

-- SELECT: 允許使用者查看自己的長輩資料
CREATE POLICY "Users can view their own elder data" ON elders
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

-- INSERT: 允許使用者插入自己的長輩資料
CREATE POLICY "Users can insert their own elder data" ON elders
    FOR INSERT
    TO authenticated
    WITH CHECK (auth_user_id = auth.uid());

-- UPDATE: 允許使用者更新自己的長輩資料
CREATE POLICY "Users can update their own elder data" ON elders
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- DELETE: 允許使用者刪除自己的長輩資料
CREATE POLICY "Users can delete their own elder data" ON elders
    FOR DELETE
    TO authenticated
    USING (auth_user_id = auth.uid());

-- ============================================================
-- 2. MEDICATIONS 表 - 使用 auth_user_id 關聯
-- ============================================================

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their medications" ON medications;
DROP POLICY IF EXISTS "Users can insert their medications" ON medications;
DROP POLICY IF EXISTS "Users can update their medications" ON medications;
DROP POLICY IF EXISTS "Users can delete their medications" ON medications;

-- SELECT
CREATE POLICY "Users can view their medications" ON medications
    FOR SELECT
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- INSERT
CREATE POLICY "Users can insert their medications" ON medications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- UPDATE
CREATE POLICY "Users can update their medications" ON medications
    FOR UPDATE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- DELETE
CREATE POLICY "Users can delete their medications" ON medications
    FOR DELETE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- 3. MEDICATION_REMINDERS 表
-- ============================================================

ALTER TABLE medication_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their reminders" ON medication_reminders;
DROP POLICY IF EXISTS "Users can insert their reminders" ON medication_reminders;
DROP POLICY IF EXISTS "Users can update their reminders" ON medication_reminders;
DROP POLICY IF EXISTS "Users can delete their reminders" ON medication_reminders;

-- SELECT
CREATE POLICY "Users can view their reminders" ON medication_reminders
    FOR SELECT
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- INSERT
CREATE POLICY "Users can insert their reminders" ON medication_reminders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- UPDATE
CREATE POLICY "Users can update their reminders" ON medication_reminders
    FOR UPDATE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- DELETE
CREATE POLICY "Users can delete their reminders" ON medication_reminders
    FOR DELETE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- 4. MEDICATION_LOGS 表
-- ============================================================

ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their logs" ON medication_logs;
DROP POLICY IF EXISTS "Users can insert their logs" ON medication_logs;
DROP POLICY IF EXISTS "Users can update their logs" ON medication_logs;

-- SELECT
CREATE POLICY "Users can view their logs" ON medication_logs
    FOR SELECT
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- INSERT
CREATE POLICY "Users can insert their logs" ON medication_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- UPDATE
CREATE POLICY "Users can update their logs" ON medication_logs
    FOR UPDATE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- 5. 驗證政策
-- ============================================================

SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('elders', 'medications', 'medication_reminders', 'medication_logs')
ORDER BY tablename, cmd;

-- ============================================================
-- 完成！現在應該可以正常建立和管理資料了
-- ============================================================
