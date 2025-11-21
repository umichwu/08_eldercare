-- ============================================================================
-- ElderCare Companion - 待處理邀請資料表
-- ============================================================================
-- 版本: 1.0 (2025-01-20)
-- 功能: 儲存發送給尚未註冊使用者的好友邀請
-- ============================================================================

-- ============================================================================
-- STEP 1: 建立待處理邀請表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 邀請者資訊
    inviter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 被邀請者資訊（尚未註冊）
    invitee_email VARCHAR(255),
    invitee_phone VARCHAR(20),
    invitee_name VARCHAR(100), -- 可選，邀請者可以填寫對方的名字

    -- 邀請訊息
    invitation_message TEXT,

    -- 邀請類型
    invitation_type VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (invitation_type IN ('email', 'phone', 'both')),

    -- 邀請狀態
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),

    -- 邀請碼（用於追蹤和自動接受）
    invitation_code VARCHAR(50) UNIQUE NOT NULL,

    -- 過期時間（預設 30 天）
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

    -- 已接受資訊
    accepted_at TIMESTAMPTZ,
    accepted_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 確保 email 或 phone 至少有一個
    CHECK (invitee_email IS NOT NULL OR invitee_phone IS NOT NULL)
);

-- 索引
CREATE INDEX idx_pending_invitations_inviter ON public.pending_invitations(inviter_id);
CREATE INDEX idx_pending_invitations_email ON public.pending_invitations(invitee_email) WHERE invitee_email IS NOT NULL;
CREATE INDEX idx_pending_invitations_phone ON public.pending_invitations(invitee_phone) WHERE invitee_phone IS NOT NULL;
CREATE INDEX idx_pending_invitations_code ON public.pending_invitations(invitation_code);
CREATE INDEX idx_pending_invitations_status ON public.pending_invitations(status) WHERE status = 'pending';
CREATE INDEX idx_pending_invitations_expires ON public.pending_invitations(expires_at) WHERE status = 'pending';

COMMENT ON TABLE public.pending_invitations IS '待處理的好友邀請（發送給尚未註冊的使用者）';

-- ============================================================================
-- STEP 2: 啟用 RLS
-- ============================================================================

ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- 使用者可以查看自己發出的邀請
CREATE POLICY "Users can view own invitations"
    ON public.pending_invitations FOR SELECT
    USING (
        inviter_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- 使用者可以建立邀請
CREATE POLICY "Users can create invitations"
    ON public.pending_invitations FOR INSERT
    WITH CHECK (
        inviter_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- 使用者可以更新自己的邀請（例如取消）
CREATE POLICY "Users can update own invitations"
    ON public.pending_invitations FOR UPDATE
    USING (
        inviter_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- 使用者可以刪除自己的邀請
CREATE POLICY "Users can delete own invitations"
    ON public.pending_invitations FOR DELETE
    USING (
        inviter_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ============================================================================
-- STEP 3: 建立函數 - 產生邀請碼
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_generate_invitation_code()
RETURNS VARCHAR(50) AS $$
DECLARE
    code VARCHAR(50);
    exists BOOLEAN;
BEGIN
    LOOP
        -- 產生 8 位隨機英數字碼
        code := UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8));

        -- 檢查是否已存在
        SELECT EXISTS(
            SELECT 1 FROM public.pending_invitations
            WHERE invitation_code = code
        ) INTO exists;

        EXIT WHEN NOT exists;
    END LOOP;

    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: 建立函數 - 處理新使用者註冊時的邀請
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_process_pending_invitations_on_signup()
RETURNS TRIGGER AS $$
DECLARE
    invitation RECORD;
    new_friendship_id UUID;
BEGIN
    -- 查找所有匹配的待處理邀請（根據 email）
    FOR invitation IN
        SELECT * FROM public.pending_invitations
        WHERE status = 'pending'
        AND expires_at > NOW()
        AND (
            (invitee_email IS NOT NULL AND LOWER(invitee_email) = LOWER(NEW.email))
        )
    LOOP
        -- 建立好友關係（雙向）
        BEGIN
            -- 建立從邀請者到新使用者的關係
            INSERT INTO public.friendships (user_id, friend_id, requested_by, status, accepted_at)
            VALUES (invitation.inviter_id, NEW.id, invitation.inviter_id, 'accepted', NOW())
            ON CONFLICT (user_id, friend_id) DO NOTHING;

            -- 建立從新使用者到邀請者的關係
            INSERT INTO public.friendships (user_id, friend_id, requested_by, status, accepted_at)
            VALUES (NEW.id, invitation.inviter_id, invitation.inviter_id, 'accepted', NOW())
            ON CONFLICT (user_id, friend_id) DO NOTHING;

            -- 更新邀請狀態
            UPDATE public.pending_invitations
            SET status = 'accepted',
                accepted_at = NOW(),
                accepted_by_user_id = NEW.id,
                updated_at = NOW()
            WHERE id = invitation.id;

            -- 建立通知給邀請者
            INSERT INTO public.social_notifications (
                user_id,
                notification_type,
                title,
                content,
                triggered_by,
                related_id,
                related_type
            )
            VALUES (
                invitation.inviter_id,
                'friend_accepted',
                '好友邀請已接受',
                NEW.display_name || ' 已加入並成為您的好友',
                NEW.id,
                invitation.id,
                'invitation'
            );

        EXCEPTION
            WHEN OTHERS THEN
                -- 記錄錯誤但不中斷註冊流程
                RAISE WARNING 'Error processing invitation %: %', invitation.id, SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: 建立觸發器 - 新使用者註冊時處理邀請
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_process_invitations_on_signup ON public.user_profiles;

CREATE TRIGGER trigger_process_invitations_on_signup
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_process_pending_invitations_on_signup();

-- ============================================================================
-- STEP 6: 建立函數 - 清理過期邀請
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- 標記過期的邀請
    UPDATE public.pending_invitations
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'pending'
    AND expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.fn_cleanup_expired_invitations IS '清理過期的待處理邀請';

-- ============================================================================
-- STEP 7: 建立視圖 - 待處理邀請列表
-- ============================================================================

CREATE OR REPLACE VIEW public.v_pending_invitations AS
SELECT
    pi.id AS invitation_id,
    pi.inviter_id,
    up.display_name AS inviter_name,
    up.avatar_url AS inviter_avatar,
    pi.invitee_email,
    pi.invitee_phone,
    pi.invitee_name,
    pi.invitation_message,
    pi.invitation_type,
    pi.status,
    pi.invitation_code,
    pi.expires_at,
    pi.created_at,
    pi.accepted_at,
    pi.accepted_by_user_id,
    up_accepted.display_name AS accepted_by_name
FROM
    public.pending_invitations pi
    INNER JOIN public.user_profiles up ON pi.inviter_id = up.id
    LEFT JOIN public.user_profiles up_accepted ON pi.accepted_by_user_id = up_accepted.id;

COMMENT ON VIEW public.v_pending_invitations IS '待處理邀請列表視圖';

-- ============================================================================
-- 完成訊息
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '✅ 待處理邀請功能建置完成！';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '已建立:';
    RAISE NOTICE '  • pending_invitations 表格';
    RAISE NOTICE '  • RLS 安全政策';
    RAISE NOTICE '  • 邀請碼產生函數';
    RAISE NOTICE '  • 註冊時自動處理邀請的觸發器';
    RAISE NOTICE '  • 清理過期邀請函數';
    RAISE NOTICE '  • v_pending_invitations 視圖';
    RAISE NOTICE '';
    RAISE NOTICE '功能:';
    RAISE NOTICE '  ✓ 透過 Email/電話邀請新使用者';
    RAISE NOTICE '  ✓ 新使用者註冊時自動建立好友關係';
    RAISE NOTICE '  ✓ 邀請碼追蹤機制';
    RAISE NOTICE '  ✓ 30 天自動過期';
    RAISE NOTICE '============================================================================';
END $$;
