-- ================================================
-- ElderCare - 為 user_profiles 添加 device_info 欄位
-- ================================================
-- 用途：儲存 FCM Token 相關的裝置資訊
-- 建立日期：2025-01-21
-- ================================================

-- 1. 檢查欄位是否已存在
DO $$
BEGIN
  -- 如果 device_info 欄位不存在，則添加
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'device_info'
  ) THEN
    -- 添加 device_info 欄位
    ALTER TABLE public.user_profiles
    ADD COLUMN device_info JSONB DEFAULT '{}';

    RAISE NOTICE '✅ device_info 欄位已添加到 user_profiles 表';
  ELSE
    RAISE NOTICE 'ℹ️  device_info 欄位已存在，跳過';
  END IF;
END $$;

-- 2. 添加註解
COMMENT ON COLUMN public.user_profiles.device_info IS 'FCM 裝置資訊 (userAgent, platform, language, etc.)';

-- 完成
SELECT '✅ user_profiles 表已更新（device_info 欄位）' AS status;
