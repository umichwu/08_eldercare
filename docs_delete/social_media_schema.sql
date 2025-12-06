-- ===================================
-- 社交功能資料庫結構
-- ===================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 1.1 刪除視圖
DROP VIEW IF EXISTS public.v_conversation_list CASCADE;
DROP VIEW IF EXISTS public.v_post_timeline CASCADE;
DROP VIEW IF EXISTS public.v_user_friend_requests CASCADE;
DROP VIEW IF EXISTS public.v_user_friends CASCADE;

-- 1.2 關閉 RLS（避免刪除時權限問題）
DO $$
BEGIN
    ALTER TABLE IF EXISTS public.friendships DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.chat_messages DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.post_comments DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.post_likes DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.social_posts DISABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 1.3 刪除觸發器（按表格順序）
DO $$
BEGIN
    DROP TRIGGER IF EXISTS post_comments_count_trigger ON public.post_comments;
    DROP TRIGGER IF EXISTS post_likes_count_trigger ON public.post_likes;
    DROP TRIGGER IF EXISTS update_friendships_updated_at ON public.friendships;
    DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON public.chat_messages;
    DROP TRIGGER IF EXISTS update_post_comments_updated_at ON public.post_comments;
    DROP TRIGGER IF EXISTS update_social_posts_updated_at ON public.social_posts;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 1.4 刪除函數（使用 CASCADE 自動刪除依賴項）
DROP FUNCTION IF EXISTS public.update_post_comments_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_post_likes_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- 1.5 刪除表格（依相依性順序：先刪除子表，再刪除父表）
DROP TABLE IF EXISTS public.post_comments CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.friendships CASCADE;
DROP TABLE IF EXISTS public.social_posts CASCADE;

-- ============================================================================
-- STEP 2: 建立社交功能表格
-- ============================================================================

-- 1. 社交動態貼文表
CREATE TABLE IF NOT EXISTS public.social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 作者資訊
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 貼文內容
    content TEXT NOT NULL,
    mood VARCHAR(50), -- happy, sad, calm, excited, grateful, etc.

    -- 多媒體附件
    media_type VARCHAR(20), -- 'image', 'video', 'audio', null
    media_url TEXT, -- Supabase Storage URL
    media_thumbnail_url TEXT, -- 縮圖 URL（用於影片）

    -- 互動統計
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,

    -- 隱私設定
    visibility VARCHAR(20) DEFAULT 'friends' CHECK (visibility IN ('public', 'friends', 'private')),

    -- 定位資訊（選填）
    location_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- 標籤
    tags TEXT[],

    -- 狀態
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_social_posts_user_profile ON public.social_posts(user_profile_id) WHERE is_deleted = false;
CREATE INDEX idx_social_posts_created_at ON public.social_posts(created_at DESC) WHERE is_deleted = false;
CREATE INDEX idx_social_posts_visibility ON public.social_posts(visibility) WHERE is_deleted = false;

-- 2. 貼文按讚表
CREATE TABLE IF NOT EXISTS public.post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 確保同一使用者對同一貼文只能按讚一次
    UNIQUE(post_id, user_profile_id)
);

CREATE INDEX idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user ON public.post_likes(user_profile_id);

-- 3. 貼文留言表
CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 留言內容
    content TEXT NOT NULL,

    -- 回覆功能（可選）
    parent_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,

    -- 狀態
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_post_comments_post ON public.post_comments(post_id) WHERE is_deleted = false;
CREATE INDEX idx_post_comments_user ON public.post_comments(user_profile_id);
CREATE INDEX idx_post_comments_parent ON public.post_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;

-- 4. 一對一聊天訊息表
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 發送者和接收者
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE, -- 改為可選（支援群組訊息）

    -- 訊息內容
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file')),
    content TEXT, -- 文字訊息內容

    -- 多媒體附件
    media_url TEXT, -- Supabase Storage URL
    media_thumbnail_url TEXT, -- 縮圖（用於圖片/影片）
    file_name VARCHAR(255), -- 原始檔案名稱
    file_size INTEGER, -- 檔案大小（bytes）

    -- 訊息狀態
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,

    -- 刪除狀態
    is_deleted_by_sender BOOLEAN DEFAULT false,
    is_deleted_by_receiver BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_receiver ON public.chat_messages(receiver_id);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_chat_messages_unread ON public.chat_messages(receiver_id, is_read) WHERE is_read = false;

-- 5. 好友關係表
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 發起者和接受者
    requester_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 狀態
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 確保同一對使用者只有一個好友關係
    UNIQUE(requester_id, addressee_id)
);

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);

-- ===================================
-- RLS 政策 (Row Level Security)
-- ===================================

-- 啟用 RLS
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- social_posts 政策
-- 1. 所有已認證使用者可以查看公開貼文
CREATE POLICY "Public posts are viewable by everyone"
ON public.social_posts FOR SELECT
USING (visibility = 'public' AND is_deleted = false);

-- 2. 好友可以查看好友貼文
CREATE POLICY "Friends can view friends posts"
ON public.social_posts FOR SELECT
USING (
    visibility = 'friends' AND is_deleted = false AND
    (
        user_profile_id IN (
            SELECT addressee_id FROM public.friendships
            WHERE requester_id = auth.uid() AND status = 'accepted'
        ) OR
        user_profile_id IN (
            SELECT requester_id FROM public.friendships
            WHERE addressee_id = auth.uid() AND status = 'accepted'
        ) OR
        user_profile_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    )
);

-- 3. 使用者可以查看自己的貼文
CREATE POLICY "Users can view own posts"
ON public.social_posts FOR SELECT
USING (user_profile_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- 4. 使用者可以新增貼文
CREATE POLICY "Users can insert own posts"
ON public.social_posts FOR INSERT
WITH CHECK (user_profile_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- 5. 使用者可以更新自己的貼文
CREATE POLICY "Users can update own posts"
ON public.social_posts FOR UPDATE
USING (user_profile_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- 6. 使用者可以刪除自己的貼文
CREATE POLICY "Users can delete own posts"
ON public.social_posts FOR DELETE
USING (user_profile_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- chat_messages 政策
-- 1. 使用者可以查看自己發送或接收的訊息
CREATE POLICY "Users can view own messages"
ON public.chat_messages FOR SELECT
USING (
    sender_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()) OR
    receiver_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
);

-- 2. 使用者可以發送訊息
CREATE POLICY "Users can send messages"
ON public.chat_messages FOR INSERT
WITH CHECK (sender_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- 3. 使用者可以更新自己發送或接收的訊息（標記已讀）
CREATE POLICY "Users can update messages"
ON public.chat_messages FOR UPDATE
USING (
    sender_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()) OR
    receiver_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
);

-- friendships 政策
CREATE POLICY "Users can view own friendships"
ON public.friendships FOR SELECT
USING (
    requester_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()) OR
    addressee_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can send friend requests"
ON public.friendships FOR INSERT
WITH CHECK (requester_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update friendships"
ON public.friendships FOR UPDATE
USING (
    requester_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()) OR
    addressee_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
);

-- ===================================
-- 觸發器：自動更新 updated_at
-- ===================================

-- 確保函數存在
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_social_posts_updated_at BEFORE UPDATE ON public.social_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON public.post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON public.friendships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- 觸發器：自動更新統計數字
-- ===================================

-- 按讚數更新
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.social_posts
        SET likes_count = likes_count + 1
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.social_posts
        SET likes_count = GREATEST(likes_count - 1, 0)
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_likes_count_trigger
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- 留言數更新
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.social_posts
        SET comments_count = comments_count + 1
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.social_posts
        SET comments_count = GREATEST(comments_count - 1, 0)
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_comments_count_trigger
AFTER INSERT OR DELETE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- ===================================
-- 視圖
-- ===================================

-- 1. 使用者好友列表
CREATE OR REPLACE VIEW public.v_user_friends AS
-- 當前使用者是 requester 的好友關係
SELECT
    f.requester_id AS user_id,
    f.addressee_id AS friend_id,
    up.display_name AS friend_name,
    up.avatar_url AS friend_avatar,
    up.email AS friend_email,
    up.phone AS friend_phone,
    NULL::DATE AS friend_birth_date,
    NULL::VARCHAR(20) AS friend_gender,
    f.created_at AS friends_since,
    f.status
FROM public.friendships f
INNER JOIN public.user_profiles up ON f.addressee_id = up.id
WHERE f.status = 'accepted'

UNION ALL

-- 當前使用者是 addressee 的好友關係
SELECT
    f.addressee_id AS user_id,
    f.requester_id AS friend_id,
    up.display_name AS friend_name,
    up.avatar_url AS friend_avatar,
    up.email AS friend_email,
    up.phone AS friend_phone,
    NULL::DATE AS friend_birth_date,
    NULL::VARCHAR(20) AS friend_gender,
    f.created_at AS friends_since,
    f.status
FROM public.friendships f
INNER JOIN public.user_profiles up ON f.requester_id = up.id
WHERE f.status = 'accepted';

-- 2. 好友邀請列表
CREATE OR REPLACE VIEW public.v_user_friend_requests AS
SELECT
    f.id AS friendship_id,
    f.addressee_id AS receiver_id,
    f.requester_id AS sender_id,
    up.display_name AS sender_name,
    up.avatar_url AS sender_avatar,
    up.email AS sender_email,
    f.created_at AS requested_at,
    f.status
FROM public.friendships f
INNER JOIN public.user_profiles up ON f.requester_id = up.id
WHERE f.status = 'pending';

-- 3. 動態時間軸
CREATE OR REPLACE VIEW public.v_post_timeline AS
SELECT
    sp.id AS post_id,
    sp.user_profile_id AS author_id,
    up.display_name AS author_name,
    up.avatar_url AS author_avatar,
    sp.content,
    sp.mood,
    sp.media_type,
    sp.media_url,
    sp.media_thumbnail_url,
    sp.likes_count,
    sp.comments_count,
    sp.shares_count,
    sp.visibility,
    sp.location_name,
    sp.latitude,
    sp.longitude,
    sp.tags,
    sp.created_at,
    sp.updated_at
FROM public.social_posts sp
INNER JOIN public.user_profiles up ON sp.user_profile_id = up.id
WHERE sp.is_deleted = false;

-- 4. 對話列表
CREATE OR REPLACE VIEW public.v_conversation_list AS
SELECT
    CASE
        WHEN cm.sender_id < cm.receiver_id THEN cm.sender_id
        ELSE cm.receiver_id
    END AS user1_id,
    CASE
        WHEN cm.sender_id < cm.receiver_id THEN cm.receiver_id
        ELSE cm.sender_id
    END AS user2_id,
    MAX(cm.created_at) AS last_message_at,
    COUNT(*) AS message_count,
    SUM(CASE WHEN NOT cm.is_read THEN 1 ELSE 0 END) AS unread_count
FROM public.chat_messages cm
WHERE cm.receiver_id IS NOT NULL -- 只統計一對一訊息
  AND cm.is_deleted_by_sender = false
  AND cm.is_deleted_by_receiver = false
GROUP BY user1_id, user2_id;
