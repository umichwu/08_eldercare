-- 修正 elders 表的 RLS 政策
-- 這個腳本需要在 Supabase SQL Editor 中執行

-- 1. 啟用 RLS（如果尚未啟用）
ALTER TABLE elders ENABLE ROW LEVEL SECURITY;

-- 2. 刪除現有的政策（如果有的話）
DROP POLICY IF EXISTS "Users can view their own elder data" ON elders;
DROP POLICY IF EXISTS "Users can insert their own elder data" ON elders;
DROP POLICY IF EXISTS "Users can update their own elder data" ON elders;
DROP POLICY IF EXISTS "Allow authenticated users to insert their elder data" ON elders;
DROP POLICY IF EXISTS "Allow users to read their own elder data" ON elders;

-- 3. 建立新的政策

-- 允許已認證的使用者查看自己的長輩資料
CREATE POLICY "Users can view their own elder data" ON elders
    FOR SELECT
    TO authenticated
    USING (
        user_profile_id IN (
            SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
        )
    );

-- 允許已認證的使用者插入自己的長輩資料
CREATE POLICY "Users can insert their own elder data" ON elders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_profile_id IN (
            SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
        )
    );

-- 允許已認證的使用者更新自己的長輩資料
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

-- 4. 確認政策已建立
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'elders';
