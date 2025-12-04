-- ============================================================================
-- Migration: 新增 last_sent_at 欄位到 pending_invitations 表
-- ============================================================================
-- 日期: 2025-01-21
-- 目的: 支援好友邀請重新發送功能，記錄最後一次發送時間
-- ============================================================================

-- 檢查 pending_invitations 表是否存在
DO $$
BEGIN
    -- 如果表不存在，先建立表
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_invitations') THEN
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

            -- 確保至少有一個聯絡方式
            CHECK (invitee_email IS NOT NULL OR invitee_phone IS NOT NULL)
        );

        -- 建立索引
        CREATE INDEX idx_pending_invitations_inviter ON public.pending_invitations(inviter_id);
        CREATE INDEX idx_pending_invitations_status ON public.pending_invitations(status);
        CREATE INDEX idx_pending_invitations_code ON public.pending_invitations(invitation_code);
        CREATE INDEX idx_pending_invitations_email ON public.pending_invitations(invitee_email) WHERE invitee_email IS NOT NULL;
        CREATE INDEX idx_pending_invitations_phone ON public.pending_invitations(invitee_phone) WHERE invitee_phone IS NOT NULL;

        RAISE NOTICE '✅ pending_invitations 表已建立';
    END IF;

    -- 新增 last_sent_at 欄位（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'pending_invitations'
        AND column_name = 'last_sent_at'
    ) THEN
        ALTER TABLE public.pending_invitations
        ADD COLUMN last_sent_at TIMESTAMPTZ;

        -- 將現有記錄的 last_sent_at 設為 created_at
        UPDATE public.pending_invitations
        SET last_sent_at = created_at
        WHERE last_sent_at IS NULL;

        RAISE NOTICE '✅ last_sent_at 欄位已新增到 pending_invitations 表';
    ELSE
        RAISE NOTICE 'ℹ️  last_sent_at 欄位已存在';
    END IF;
END $$;

-- 建立或更新 v_pending_invitations 視圖
CREATE OR REPLACE VIEW public.v_pending_invitations AS
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
    -- 計算重新發送的次數（基於 updated_at 和 created_at 的差異）
    CASE
        WHEN pi.last_sent_at IS NOT NULL AND pi.last_sent_at > pi.created_at THEN
            EXTRACT(EPOCH FROM (pi.last_sent_at - pi.created_at)) / 3600 -- 小時差
        ELSE 0
    END AS hours_since_first_sent
FROM public.pending_invitations pi
INNER JOIN public.user_profiles up ON pi.inviter_id = up.id
WHERE pi.status = 'pending' AND pi.expires_at > NOW();

-- 建立觸發器自動更新 updated_at
CREATE OR REPLACE FUNCTION update_pending_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pending_invitations_updated_at ON public.pending_invitations;
CREATE TRIGGER trigger_pending_invitations_updated_at
    BEFORE UPDATE ON public.pending_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_invitations_updated_at();

-- 建立函數：自動清理過期邀請
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

-- 註解
COMMENT ON COLUMN public.pending_invitations.last_sent_at IS '最後一次發送邀請的時間（用於重新發送功能）';
COMMENT ON VIEW public.v_pending_invitations IS '待處理邀請視圖（只包含有效且未過期的邀請）';
COMMENT ON FUNCTION cleanup_expired_invitations() IS '清理過期邀請的函數（建議定期執行）';

-- 完成訊息
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 完成：pending_invitations 表已準備就緒';
    RAISE NOTICE 'ℹ️  建議定期執行 cleanup_expired_invitations() 清理過期邀請';
END $$;
