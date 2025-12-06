-- ============================================================================
-- Migration: 群組聊天支援 - 修改 chat_messages 表以支援群組訊息
-- ============================================================================
-- 建立日期: 2025-12-05
-- 版本: 1.0
-- 用途: 新增群組聊天功能所需的資料庫結構
--   - chat_groups 表（聊天群組）
--   - chat_group_members 表（群組成員）
--   - chat_group_invites 表（群組邀請）
--   - 修改 chat_messages 表以支援群組訊息（新增 group_id 欄位）
-- ============================================================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 1.1 刪除視圖
DROP VIEW IF EXISTS public.chat_group_stats CASCADE;

-- 1.2 關閉 RLS（避免刪除時權限問題）
ALTER TABLE IF EXISTS public.chat_group_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_groups DISABLE ROW LEVEL SECURITY;

-- 1.3 刪除觸發器
DROP TRIGGER IF EXISTS update_chat_groups_updated_at ON public.chat_groups;
DROP TRIGGER IF EXISTS update_chat_group_members_updated_at ON public.chat_group_members;
DROP TRIGGER IF EXISTS update_chat_group_invites_updated_at ON public.chat_group_invites;
DROP TRIGGER IF EXISTS add_creator_to_group_trigger ON public.chat_groups;

-- 1.4 刪除函數
DROP FUNCTION IF EXISTS public.add_creator_to_group() CASCADE;

-- 1.5 刪除現有的群組訊息 RLS 政策（避免衝突）
DROP POLICY IF EXISTS "Group members can view group messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Group members can send group messages" ON public.chat_messages;

-- 1.6 刪除約束（如果存在）
ALTER TABLE IF EXISTS public.chat_messages DROP CONSTRAINT IF EXISTS check_message_type;
ALTER TABLE IF EXISTS public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_group_id_fkey;

-- 1.7 刪除索引（如果存在）
DROP INDEX IF EXISTS public.idx_chat_messages_group;
DROP INDEX IF EXISTS public.idx_chat_groups_created_by;
DROP INDEX IF EXISTS public.idx_chat_groups_active;
DROP INDEX IF EXISTS public.idx_group_members_group;
DROP INDEX IF EXISTS public.idx_group_members_user;
DROP INDEX IF EXISTS public.idx_group_members_role;
DROP INDEX IF EXISTS public.idx_group_invites_invitee;
DROP INDEX IF EXISTS public.idx_group_invites_group;

-- 1.8 刪除群組相關表格（依相依性順序）
DROP TABLE IF EXISTS public.chat_group_invites CASCADE;
DROP TABLE IF EXISTS public.chat_group_members CASCADE;
DROP TABLE IF EXISTS public.chat_groups CASCADE;

-- ============================================================================
-- STEP 2: 啟用擴展功能（如果需要）
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 3: 建立群組聊天表格
-- ============================================================================

-- 3.1 聊天群組表
CREATE TABLE public.chat_groups (
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

-- 建立索引
CREATE INDEX idx_chat_groups_created_by ON public.chat_groups(created_by);
CREATE INDEX idx_chat_groups_active ON public.chat_groups(is_active, is_deleted) WHERE is_active = true AND is_deleted = false;

-- 3.2 群組成員表
CREATE TABLE public.chat_group_members (
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

-- 建立索引
CREATE INDEX idx_group_members_group ON public.chat_group_members(group_id, is_active) WHERE is_active = true;
CREATE INDEX idx_group_members_user ON public.chat_group_members(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_group_members_role ON public.chat_group_members(group_id, role) WHERE is_active = true;

-- 3.3 群組邀請表
CREATE TABLE public.chat_group_invites (
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

-- 建立索引
CREATE INDEX idx_group_invites_invitee ON public.chat_group_invites(invitee_id, status) WHERE status = 'pending';
CREATE INDEX idx_group_invites_group ON public.chat_group_invites(group_id, status);

-- ============================================================================
-- STEP 4: 修改 chat_messages 表，支援群組訊息
-- ============================================================================

-- 4.1 新增 group_id 欄位
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS group_id UUID;

-- 4.2 清理無效的 group_id 資料（在新增外鍵約束前）
-- 這是為了處理可能已存在的孤立資料
UPDATE public.chat_messages SET group_id = NULL WHERE group_id IS NOT NULL;

-- 4.3 修改 receiver_id 為可選（群組訊息不需要 receiver_id）
ALTER TABLE public.chat_messages ALTER COLUMN receiver_id DROP NOT NULL;

-- 4.3.1 修復違反檢查約束的資料
-- 確保所有訊息都符合：receiver_id 和 group_id 其中一個必須有值，但不能兩者都有或都沒有
-- 刪除兩者都是 NULL 的無效訊息
DELETE FROM public.chat_messages WHERE receiver_id IS NULL AND group_id IS NULL;
-- 如果有兩者都不是 NULL 的記錄，將 group_id 設為 NULL（保留為一對一訊息）
UPDATE public.chat_messages SET group_id = NULL WHERE receiver_id IS NOT NULL AND group_id IS NOT NULL;

-- 4.4 新增外鍵約束
ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_messages_group_id_fkey
FOREIGN KEY (group_id) REFERENCES public.chat_groups(id) ON DELETE CASCADE;

-- 4.5 新增群組訊息索引
CREATE INDEX idx_chat_messages_group ON public.chat_messages(group_id, created_at DESC) WHERE group_id IS NOT NULL;

-- 4.6 新增檢查約束：訊息必須是一對一或群組訊息（不能兩者都是）
ALTER TABLE public.chat_messages
ADD CONSTRAINT check_message_type
CHECK (
    (receiver_id IS NOT NULL AND group_id IS NULL) OR
    (receiver_id IS NULL AND group_id IS NOT NULL)
);

-- ============================================================================
-- STEP 5: 建立觸發器函數
-- ============================================================================

-- 5.1 更新 updated_at 的觸發器函數（如果尚未存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.2 自動將建立者加入群組為管理員
CREATE OR REPLACE FUNCTION add_creator_to_group()
RETURNS TRIGGER AS $$
BEGIN
    -- 自動將建立者加入群組並設為管理員
    INSERT INTO public.chat_group_members (group_id, user_id, role, can_invite_members)
    VALUES (NEW.id, NEW.created_by, 'admin', true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: 建立觸發器
-- ============================================================================

CREATE TRIGGER update_chat_groups_updated_at
BEFORE UPDATE ON public.chat_groups
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_group_members_updated_at
BEFORE UPDATE ON public.chat_group_members
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_group_invites_updated_at
BEFORE UPDATE ON public.chat_group_invites
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER add_creator_to_group_trigger
AFTER INSERT ON public.chat_groups
FOR EACH ROW EXECUTE FUNCTION add_creator_to_group();

-- ============================================================================
-- STEP 7: 建立視圖
-- ============================================================================

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

-- ============================================================================
-- STEP 8: 設定 RLS (Row Level Security)
-- ============================================================================

-- 啟用 RLS
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_invites ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- STEP 9: 建立資料表註解
-- ============================================================================

COMMENT ON TABLE public.chat_groups IS '聊天群組表 - 儲存群組基本資訊';
COMMENT ON COLUMN public.chat_groups.created_by IS '群組建立者的 user_profile ID';
COMMENT ON COLUMN public.chat_groups.max_members IS '群組最大成員數（預設 50）';
COMMENT ON COLUMN public.chat_groups.is_private IS '是否為私密群組（需要邀請才能加入）';

COMMENT ON TABLE public.chat_group_members IS '群組成員表 - 儲存成員資訊與權限';
COMMENT ON COLUMN public.chat_group_members.role IS '成員角色：admin（管理員）、moderator（協管）、member（成員）';
COMMENT ON COLUMN public.chat_group_members.can_send_messages IS '是否可以發送訊息';
COMMENT ON COLUMN public.chat_group_members.can_invite_members IS '是否可以邀請新成員';

COMMENT ON TABLE public.chat_group_invites IS '群組邀請表 - 儲存群組邀請記錄';
COMMENT ON COLUMN public.chat_group_invites.status IS '邀請狀態：pending、accepted、declined、expired';

COMMENT ON COLUMN public.chat_messages.group_id IS '群組 ID（如果是群組訊息）';
COMMENT ON CONSTRAINT check_message_type ON public.chat_messages IS '確保訊息是一對一訊息或群組訊息（不能兩者都是）';

COMMENT ON VIEW public.chat_group_stats IS '群組統計視圖 - 提供成員數、訊息數等統計資訊';

-- ============================================================================
-- Migration 完成！
-- ============================================================================
--
-- ✅ 已完成項目：
--   1. 清理舊資料（表格、視圖、函數、觸發器、RLS 政策）
--   2. 啟用必要的擴展（uuid-ossp）
--   3. 建立 chat_groups 表（群組資訊）
--   4. 建立 chat_group_members 表（成員管理）
--   5. 建立 chat_group_invites 表（邀請功能）
--   6. 修改 chat_messages 表（新增 group_id 欄位與約束）
--   7. 建立觸發器（自動更新時間、自動加入建立者）
--   8. 建立視圖（群組統計）
--   9. 設定 RLS 政策（權限控制）
--   10. 建立資料表與欄位註解
--
-- ⏳ 後續步驟：
--   1. 測試群組建立功能
--   2. 測試群組訊息發送/接收
--   3. 測試邀請功能
--
-- 📝 測試範例：
--   -- 查看所有群組
--   SELECT * FROM chat_groups WHERE is_deleted = false;
--
--   -- 查看群組成員
--   SELECT * FROM chat_group_members WHERE group_id = 'your-group-id';
--
--   -- 查看群組訊息
--   SELECT * FROM chat_messages WHERE group_id = 'your-group-id' ORDER BY created_at DESC;
--
--   -- 查看群組統計
--   SELECT * FROM chat_group_stats;
--
-- ============================================================================
