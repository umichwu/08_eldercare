-- ================================================
-- ElderCare - 為 pending_invitations 添加 last_sent_at 欄位
-- ================================================
-- 用途：記錄邀請最後發送時間，支援重新發送功能
-- 建立日期：2025-01-21
-- ================================================

-- 1. 檢查 pending_invitations 表是否存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'pending_invitations'
  ) THEN
    RAISE NOTICE 'ℹ️  pending_invitations 表不存在，跳過遷移';
    RAISE NOTICE 'ℹ️  請確認您的社交功能資料表是否已正確建立';
  ELSE
    -- 2. 檢查 last_sent_at 欄位是否已存在
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'pending_invitations'
        AND column_name = 'last_sent_at'
    ) THEN
      -- 添加 last_sent_at 欄位
      ALTER TABLE public.pending_invitations
      ADD COLUMN last_sent_at TIMESTAMPTZ;

      -- 初始化為創建時間
      UPDATE public.pending_invitations
      SET last_sent_at = created_at
      WHERE last_sent_at IS NULL;

      RAISE NOTICE '✅ last_sent_at 欄位已添加到 pending_invitations 表';
    ELSE
      RAISE NOTICE 'ℹ️  last_sent_at 欄位已存在，跳過';
    END IF;
  END IF;
END $$;

-- 3. 添加註解（如果表存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'pending_invitations'
  ) THEN
    COMMENT ON COLUMN public.pending_invitations.last_sent_at IS
      '最後發送時間（用於重新發送邀請功能）';
  END IF;
END $$;

-- 完成
SELECT '✅ pending_invitations 表已更新（last_sent_at 欄位）' AS status;
