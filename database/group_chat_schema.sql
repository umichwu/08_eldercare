-- ===================================
-- 群組聊天功能資料庫結構
-- ===================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 關閉 RLS（避免刪除時權限問題）
ALTER TABLE IF EXISTS public.chat_group_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages DISABLE ROW LEVEL SECURITY;

-- 刪除視圖
DROP VIEW IF EXISTS public.chat_group_stats CASCADE;

-- 刪除觸發器
DROP TRIGGER IF EXISTS update_chat_groups_updated_at ON public.chat_groups;
DROP TRIGGER IF EXISTS update_chat_group_members_updated_at ON public.chat_group_members;
DROP TRIGGER IF EXISTS update_chat_group_invites_updated_at ON public.chat_group_invites;
DROP TRIGGER IF EXISTS add_creator_to_group_trigger ON public.chat_groups;

-- 刪除函數
DROP FUNCTION IF EXISTS public.add_creator_to_group() CASCADE;

-- 刪除現有的群組訊息政策（避免衝突）
DROP POLICY IF EXISTS "Group members can view group messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Group members can send group messages" ON public.chat_messages;

-- 刪除約束（如果存在）
ALTER TABLE IF EXISTS public.chat_messages DROP CONSTRAINT IF EXISTS check_message_type;

-- 刪除群組相關表格（依相依性順序）
DROP TABLE IF EXISTS public.chat_group_invites CASCADE;
DROP TABLE IF EXISTS public.chat_group_members CASCADE;
DROP TABLE IF EXISTS public.chat_groups CASCADE;

-- ============================================================================
-- STEP 2: 建立群組聊天表格
-- ============================================================================

-- 1. 聊天群組表
CREATE TABLE IF NOT EXISTS public.chat_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 群組基本資訊
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,

    -- 群組設定
    max_members INTEGER DEFAULT 50,
    is_private BOOLEAN DEFAULT false, -- 私密群組需要邀請才能加入

    -- 建立者
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 狀態
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_chat_groups_created_by ON public.chat_groups(created_by);
CREATE INDEX idx_chat_groups_active ON public.chat_groups(is_active, is_deleted) WHERE is_active = true AND is_deleted = false;

-- 2. 群組成員表
CREATE TABLE IF NOT EXISTS public.chat_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 群組和成員
    group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 成員角色
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),

    -- 成員設定
    nickname VARCHAR(50), -- 群組內暱稱
    is_muted BOOLEAN DEFAULT false, -- 靜音通知
    is_pinned BOOLEAN DEFAULT false, -- 置頂群組

    -- 權限
    can_send_messages BOOLEAN DEFAULT true,
    can_invite_members BOOLEAN DEFAULT false,

    -- 狀態
    is_active BOOLEAN DEFAULT true,
    left_at TIMESTAMPTZ, -- 離開群組時間

    -- 時間戳記
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 確保同一使用者在同一群組只有一筆記錄
    UNIQUE(group_id, user_id)
);

-- 索引
CREATE INDEX idx_group_members_group ON public.chat_group_members(group_id, is_active) WHERE is_active = true;
CREATE INDEX idx_group_members_user ON public.chat_group_members(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_group_members_role ON public.chat_group_members(group_id, role) WHERE is_active = true;

-- ============================================================================
-- STEP 3: 修改 chat_messages 表，支援群組訊息
-- ============================================================================

-- 3.1 增加 group_id 欄位
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE;

-- 3.2 修改 receiver_id 為可選（群組訊息不需要 receiver_id）
-- 注意：先檢查欄位是否存在 NOT NULL 約束
DO $$
BEGIN
    -- 嘗試移除 NOT NULL 約束
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'chat_messages'
        AND column_name = 'receiver_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.chat_messages ALTER COLUMN receiver_id DROP NOT NULL;
    END IF;
EXCEPTION
    WHEN undefined_column THEN
        -- 如果欄位不存在，忽略錯誤
        NULL;
END $$;

-- 3.3 增加群組訊息索引
CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON public.chat_messages(group_id, created_at DESC) WHERE group_id IS NOT NULL;

-- 3.4 增加檢查約束：訊息必須是一對一或群組訊息（不能兩者都是）
ALTER TABLE public.chat_messages
ADD CONSTRAINT check_message_type
CHECK (
    (receiver_id IS NOT NULL AND group_id IS NULL) OR
    (receiver_id IS NULL AND group_id IS NOT NULL)
);

-- ============================================================================
-- STEP 4: 建立群組邀請表
-- ============================================================================

-- 4. 群組邀請表（可選）
CREATE TABLE IF NOT EXISTS public.chat_group_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 邀請資訊
    group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 邀請狀態
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    message TEXT, -- 邀請訊息

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',

    -- 確保同一使用者對同一群組只有一個待處理的邀請
    UNIQUE(group_id, invitee_id, status)
);

-- 索引
CREATE INDEX idx_group_invites_invitee ON public.chat_group_invites(invitee_id, status) WHERE status = 'pending';
CREATE INDEX idx_group_invites_group ON public.chat_group_invites(group_id, status);

-- ===================================
-- RLS 政策 (Row Level Security)
-- ===================================

-- 啟用 RLS
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_groups 政策

-- 1. 成員可以查看所屬的群組
CREATE POLICY "Members can view their groups"
ON public.chat_groups FOR SELECT
USING (
    id IN (
        SELECT group_id FROM public.chat_group_members
        WHERE user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND is_active = true
    ) OR
    created_by = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
);

-- 2. 使用者可以建立群組
CREATE POLICY "Users can create groups"
ON public.chat_groups FOR INSERT
WITH CHECK (created_by = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- 3. 群組管理員可以更新群組資訊
CREATE POLICY "Admins can update groups"
ON public.chat_groups FOR UPDATE
USING (
    id IN (
        SELECT group_id FROM public.chat_group_members
        WHERE user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND role IN ('admin', 'moderator')
        AND is_active = true
    )
);

-- 4. 群組建立者可以刪除群組
CREATE POLICY "Creators can delete groups"
ON public.chat_groups FOR DELETE
USING (created_by = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- chat_group_members 政策

-- 1. 成員可以查看所屬群組的成員列表
CREATE POLICY "Members can view group members"
ON public.chat_group_members FOR SELECT
USING (
    group_id IN (
        SELECT group_id FROM public.chat_group_members
        WHERE user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND is_active = true
    )
);

-- 2. 群組管理員可以新增成員
CREATE POLICY "Admins can add members"
ON public.chat_group_members FOR INSERT
WITH CHECK (
    group_id IN (
        SELECT group_id FROM public.chat_group_members
        WHERE user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND role IN ('admin', 'moderator')
        AND is_active = true
    ) OR
    -- 或者是接受邀請加入
    user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
);

-- 3. 使用者可以更新自己的成員設定
CREATE POLICY "Users can update own member settings"
ON public.chat_group_members FOR UPDATE
USING (user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- 4. 使用者可以離開群組（更新 is_active）
CREATE POLICY "Users can leave groups"
ON public.chat_group_members FOR DELETE
USING (user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- chat_messages 群組訊息政策（新增）

-- 群組成員可以查看群組訊息
CREATE POLICY "Group members can view group messages"
ON public.chat_messages FOR SELECT
USING (
    group_id IN (
        SELECT group_id FROM public.chat_group_members
        WHERE user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND is_active = true
    ) AND group_id IS NOT NULL
);

-- 群組成員可以發送群組訊息
CREATE POLICY "Group members can send group messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
    group_id IN (
        SELECT group_id FROM public.chat_group_members
        WHERE user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND is_active = true
        AND can_send_messages = true
    ) AND group_id IS NOT NULL
);

-- chat_group_invites 政策

-- 被邀請者可以查看自己的邀請
CREATE POLICY "Users can view own invites"
ON public.chat_group_invites FOR SELECT
USING (invitee_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- 群組管理員可以發送邀請
CREATE POLICY "Admins can send invites"
ON public.chat_group_invites FOR INSERT
WITH CHECK (
    group_id IN (
        SELECT group_id FROM public.chat_group_members
        WHERE user_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND role IN ('admin', 'moderator')
        AND is_active = true
    )
);

-- 被邀請者可以更新邀請狀態（接受/拒絕）
CREATE POLICY "Invitees can update invite status"
ON public.chat_group_invites FOR UPDATE
USING (invitee_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- ===================================
-- 觸發器：自動更新 updated_at
-- ===================================

-- 確保 update_updated_at_column 函數存在
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_groups_updated_at BEFORE UPDATE ON public.chat_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_group_members_updated_at BEFORE UPDATE ON public.chat_group_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_group_invites_updated_at BEFORE UPDATE ON public.chat_group_invites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- 觸發器：自動將建立者加入群組為管理員
-- ===================================

CREATE OR REPLACE FUNCTION add_creator_to_group()
RETURNS TRIGGER AS $$
BEGIN
    -- 自動將建立者加入群組並設為管理員
    INSERT INTO public.chat_group_members (group_id, user_id, role, can_invite_members)
    VALUES (NEW.id, NEW.created_by, 'admin', true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER add_creator_to_group_trigger
AFTER INSERT ON public.chat_groups
FOR EACH ROW EXECUTE FUNCTION add_creator_to_group();

-- ===================================
-- 視圖：群組統計資訊
-- ===================================

CREATE OR REPLACE VIEW public.chat_group_stats AS
SELECT
    g.id AS group_id,
    g.name AS group_name,
    COUNT(DISTINCT m.user_id) AS member_count,
    COUNT(DISTINCT CASE WHEN msg.created_at > NOW() - INTERVAL '24 hours' THEN msg.id END) AS messages_24h,
    MAX(msg.created_at) AS last_message_at
FROM public.chat_groups g
LEFT JOIN public.chat_group_members m ON g.id = m.group_id AND m.is_active = true
LEFT JOIN public.chat_messages msg ON g.id = msg.group_id
WHERE g.is_deleted = false
GROUP BY g.id, g.name;

-- ===================================
-- 初始測試資料（可選）
-- ===================================

-- 建立測試群組
-- INSERT INTO public.chat_groups (name, description, created_by)
-- VALUES ('家庭群組', '溫馨的家庭聊天室', 'your-user-id-here');
