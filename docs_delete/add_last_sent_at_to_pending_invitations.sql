-- ============================================================================
-- Migration: 好友邀請系統 - 新增 pending_invitations 表
-- ============================================================================
-- 建立日期: 2025-01-21
-- 版本: 1.1
-- 用途: 支援好友邀請功能，包含重新發送邀請機制
--   - pending_invitations 表（待處理邀請）
--   - v_pending_invitations 視圖（有效邀請視圖）
--   - cleanup_expired_invitations() 函數（清理過期邀請）
-- ============================================================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 關閉 RLS（避免刪除時權限問題）
ALTER TABLE IF EXISTS public.pending_invitations DISABLE ROW LEVEL SECURITY;

-- 刪除視圖
DROP VIEW IF EXISTS public.v_pending_invitations CASCADE;

-- 刪除觸發器
DROP TRIGGER IF EXISTS trigger_pending_invitations_updated_at ON public.pending_invitations;

-- 刪除函數
DROP FUNCTION IF EXISTS public.update_pending_invitations_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_invitations() CASCADE;

-- 刪除表格
DROP TABLE IF EXISTS public.pending_invitations CASCADE;

-- ============================================================================
-- STEP 2: 啟用擴展功能（如果需要）
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 3: 建立 pending_invitations 表
-- ============================================================================

CREATE TABLE public.pending_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 邀請者資訊
    inviter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 被邀請者資訊
    invitee_email VARCHAR(255),
    invitee_phone VARCHAR(20),
    invitee_name VARCHAR(100),

    -- 邀請內容
    invitation_message TEXT,
    invitation_type VARCHAR(20) CHECK (invitation_type IN ('email', 'phone', 'both')),
    invitation_code VARCHAR(20) UNIQUE NOT NULL,

    -- 狀態
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    last_sent_at TIMESTAMPTZ DEFAULT NOW(),  -- 最後一次發送時間（新增）

    -- 確保至少有一個聯絡方式
    CONSTRAINT check_contact_method CHECK (invitee_email IS NOT NULL OR invitee_phone IS NOT NULL)
);

-- 建立索引
CREATE INDEX idx_pending_invitations_inviter ON public.pending_invitations(inviter_id);
CREATE INDEX idx_pending_invitations_status ON public.pending_invitations(status);
CREATE INDEX idx_pending_invitations_code ON public.pending_invitations(invitation_code);
CREATE INDEX idx_pending_invitations_email ON public.pending_invitations(invitee_email) WHERE invitee_email IS NOT NULL;
CREATE INDEX idx_pending_invitations_phone ON public.pending_invitations(invitee_phone) WHERE invitee_phone IS NOT NULL;
CREATE INDEX idx_pending_invitations_expires_at ON public.pending_invitations(expires_at);
CREATE INDEX idx_pending_invitations_last_sent_at ON public.pending_invitations(last_sent_at);

-- ============================================================================
-- STEP 4: 建立 v_pending_invitations 視圖
-- ============================================================================

CREATE VIEW public.v_pending_invitations AS
SELECT
    pi.id,
    pi.inviter_id,
    pi.invitee_email,
    pi.invitee_phone,
    pi.invitee_name,
    pi.invitation_message,
    pi.invitation_type,
    pi.invitation_code,
    pi.status,
    pi.created_at,
    pi.updated_at,
    pi.expires_at,
    pi.last_sent_at,
    up.display_name AS inviter_name,
    up.avatar_url AS inviter_avatar,
    -- 計算邀請是否過期
    CASE
        WHEN pi.expires_at < NOW() THEN true
        ELSE false
    END AS is_expired,
    -- 計算距離過期還有多少天
    CASE
        WHEN pi.expires_at > NOW() THEN
            EXTRACT(DAY FROM (pi.expires_at - NOW()))
        ELSE 0
    END AS days_until_expiry,
    -- 計算距離上次發送的小時數
    CASE
        WHEN pi.last_sent_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - pi.last_sent_at)) / 3600
        ELSE 0
    END AS hours_since_last_sent
FROM public.pending_invitations pi
INNER JOIN public.user_profiles up ON pi.inviter_id = up.id
WHERE pi.status = 'pending' AND pi.expires_at > NOW();

-- ============================================================================
-- STEP 5: 建立觸發器函數
-- ============================================================================

-- 更新 updated_at 的觸發器函數
CREATE OR REPLACE FUNCTION update_pending_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
CREATE TRIGGER trigger_pending_invitations_updated_at
    BEFORE UPDATE ON public.pending_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_invitations_updated_at();

-- ============================================================================
-- STEP 6: 建立清理過期邀請的函數
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE public.pending_invitations
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < NOW();

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 7: 建立資料表註解
-- ============================================================================

COMMENT ON TABLE public.pending_invitations IS '待處理好友邀請表 - 儲存尚未接受的好友邀請';
COMMENT ON COLUMN public.pending_invitations.inviter_id IS '邀請者的 user_profile ID';
COMMENT ON COLUMN public.pending_invitations.invitee_email IS '被邀請者的電子郵件';
COMMENT ON COLUMN public.pending_invitations.invitee_phone IS '被邀請者的手機號碼';
COMMENT ON COLUMN public.pending_invitations.invitation_code IS '邀請碼（唯一）';
COMMENT ON COLUMN public.pending_invitations.status IS '邀請狀態：pending, accepted, cancelled, expired';
COMMENT ON COLUMN public.pending_invitations.last_sent_at IS '最後一次發送邀請的時間（用於重新發送功能）';
COMMENT ON COLUMN public.pending_invitations.expires_at IS '邀請過期時間（預設 7 天）';

COMMENT ON VIEW public.v_pending_invitations IS '待處理邀請視圖（只包含有效且未過期的邀請）';
COMMENT ON FUNCTION cleanup_expired_invitations() IS '清理過期邀請的函數（建議定期執行，例如每天一次）';

-- ============================================================================
-- Migration 完成！
-- ============================================================================
--
-- ✅ 已完成項目：
--   1. 清理舊資料（表格、視圖、函數、觸發器）
--   2. 啟用必要的擴展（uuid-ossp）
--   3. 建立 pending_invitations 表（含 last_sent_at 欄位）
--   4. 建立 v_pending_invitations 視圖
--   5. 建立 updated_at 自動更新觸發器
--   6. 建立 cleanup_expired_invitations() 清理函數
--   7. 建立資料表與欄位註解
--
-- ⏳ 後續步驟：
--   1. 測試邀請功能 API
--   2. 設定定期任務（Cron Job）執行 cleanup_expired_invitations()
--   3. 測試重新發送邀請功能
--
-- 📝 測試範例：
--   -- 查看所有待處理邀請
--   SELECT * FROM v_pending_invitations;
--
--   -- 手動清理過期邀請
--   SELECT cleanup_expired_invitations();
--
--   -- 測試重新發送（更新 last_sent_at）
--   UPDATE pending_invitations
--   SET last_sent_at = NOW()
--   WHERE id = 'your-invitation-id';
--
-- ============================================================================
