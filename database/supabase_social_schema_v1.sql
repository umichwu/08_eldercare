-- ============================================================================
-- ElderCare Companion - 社交功能資料庫 Schema
-- ============================================================================
-- 版本: 1.2 (2025-01-20) - 修正表格與 RLS Policy 的相依性問題
-- 功能: 好友聊天、生活動態分享、社交互動系統
-- ============================================================================
-- 功能說明:
--   1. 好友關係管理(邀請、接受、封鎖)
--   2. 一對一聊天和群組聊天
--   3. 生活動態發布(類似 Facebook)
--   4. 動態互動(按讚、留言)
--   5. 通知系統(好友邀請、新訊息、動態互動)
-- ============================================================================
-- 修正說明 v1.2:
--   解決 RLS Policy 在建立時引用尚未建立的表格的問題
--   新結構: DROP → CREATE TABLES → FUNCTIONS → TRIGGERS → RLS POLICIES → VIEWS
-- ============================================================================

-- ============================================================================
-- STEP 1: 清理舊資料(如果存在)
-- ============================================================================

-- 刪除視圖(先刪除視圖，因為它們可能依賴表格)
DROP VIEW IF EXISTS public.v_user_friends CASCADE;
DROP VIEW IF EXISTS public.v_user_friend_requests CASCADE;
DROP VIEW IF EXISTS public.v_post_timeline CASCADE;
DROP VIEW IF EXISTS public.v_chat_room_list CASCADE;

-- 刪除觸發器(使用 DO 區塊避免表格不存在時的錯誤)
DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_update_post_stats ON public.post_likes;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_update_comment_stats ON public.post_comments;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_create_notification_on_friend_request ON public.friendships;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_create_notification_on_post_like ON public.post_likes;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_create_notification_on_post_comment ON public.post_comments;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_update_chat_room_timestamp ON public.chat_messages;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_increment_unread_count ON public.chat_messages;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- 刪除函數
DROP FUNCTION IF EXISTS public.fn_update_post_stats() CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_comment_stats() CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_friendship_notification() CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_post_like_notification() CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_post_comment_notification() CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_chat_room_last_message() CASCADE;
DROP FUNCTION IF EXISTS public.fn_increment_unread_count() CASCADE;
DROP FUNCTION IF EXISTS public.fn_accept_friend_request(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.fn_reject_friend_request(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.fn_send_friend_request(UUID) CASCADE;

-- 刪除表格(依相依性順序，CASCADE 會自動處理相依性)
DROP TABLE IF EXISTS public.post_comment_likes CASCADE;
DROP TABLE IF EXISTS public.post_comments CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.life_posts CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_room_members CASCADE;
DROP TABLE IF EXISTS public.chat_rooms CASCADE;
DROP TABLE IF EXISTS public.social_notifications CASCADE;
DROP TABLE IF EXISTS public.friendships CASCADE;

-- ============================================================================
-- STEP 2: 建立所有表格(不含 RLS Policies)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 好友關係表 (friendships)
-- ----------------------------------------------------------------------------
CREATE TABLE public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯到使用者
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 關係狀態
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),

    -- 發起者與接受者
    requested_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 親密度設定(可選)
    relationship_type VARCHAR(50), -- 'family', 'friend', 'close_friend', 'acquaintance'

    -- 備註
    notes TEXT,

    -- 互動統計
    interaction_count INTEGER DEFAULT 0,
    last_interaction_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,

    -- 確保不會重複建立關係
    UNIQUE(user_id, friend_id),

    -- 確保不會自己加自己為好友
    CHECK (user_id != friend_id)
);

CREATE INDEX idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);
CREATE INDEX idx_friendships_pending ON public.friendships(friend_id, status) WHERE status = 'pending';
CREATE INDEX idx_friendships_accepted ON public.friendships(user_id, friend_id) WHERE status = 'accepted';

COMMENT ON TABLE public.friendships IS '好友關係表 - 管理使用者間的好友關係';

-- ----------------------------------------------------------------------------
-- 2.2 社交通知表 (social_notifications)
-- ----------------------------------------------------------------------------
CREATE TABLE public.social_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 接收者
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 通知類型
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'friend_request',
        'friend_accepted',
        'new_message',
        'post_like',
        'post_comment',
        'comment_like',
        'comment_reply',
        'mention'
    )),

    -- 標題和內容
    title VARCHAR(200) NOT NULL,
    content TEXT,

    -- 觸發者
    triggered_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 關聯資源
    related_id UUID, -- 可以是 post_id, comment_id, message_id, friendship_id 等
    related_type VARCHAR(50), -- 'post', 'comment', 'message', 'friendship'

    -- 深層連結
    action_url TEXT,

    -- 已讀狀態
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_notifications_user_id ON public.social_notifications(user_id, created_at DESC);
CREATE INDEX idx_social_notifications_unread ON public.social_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_social_notifications_type ON public.social_notifications(notification_type);
CREATE INDEX idx_social_notifications_triggered_by ON public.social_notifications(triggered_by);

COMMENT ON TABLE public.social_notifications IS '社交通知表';

-- ----------------------------------------------------------------------------
-- 2.3 聊天室表 (chat_rooms)
-- ----------------------------------------------------------------------------
CREATE TABLE public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 聊天室類型
    room_type VARCHAR(20) NOT NULL DEFAULT 'direct' CHECK (room_type IN ('direct', 'group')),

    -- 聊天室資訊(群組聊天才需要)
    room_name VARCHAR(100),
    room_avatar TEXT,
    room_description TEXT,

    -- 建立者
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 最後訊息資訊(用於列表排序)
    last_message_content TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_by UUID REFERENCES public.user_profiles(id),

    -- 統計
    message_count INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 0,

    -- 狀態
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_rooms_created_by ON public.chat_rooms(created_by);
CREATE INDEX idx_chat_rooms_room_type ON public.chat_rooms(room_type);
CREATE INDEX idx_chat_rooms_last_message ON public.chat_rooms(last_message_at DESC NULLS LAST);
CREATE INDEX idx_chat_rooms_active ON public.chat_rooms(is_active) WHERE is_active = true;

COMMENT ON TABLE public.chat_rooms IS '聊天室表 - 支援一對一和群組聊天';

-- ----------------------------------------------------------------------------
-- 2.4 聊天室成員表 (chat_room_members)
-- ----------------------------------------------------------------------------
CREATE TABLE public.chat_room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 成員角色(群組聊天)
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),

    -- 已讀狀態
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INTEGER DEFAULT 0,

    -- 通知設定
    notifications_enabled BOOLEAN DEFAULT true,
    muted BOOLEAN DEFAULT false,

    -- 時間戳記
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,

    -- 確保同一使用者不會重複加入同一聊天室
    UNIQUE(room_id, user_id)
);

CREATE INDEX idx_chat_room_members_room_id ON public.chat_room_members(room_id);
CREATE INDEX idx_chat_room_members_user_id ON public.chat_room_members(user_id);
CREATE INDEX idx_chat_room_members_unread ON public.chat_room_members(user_id, unread_count) WHERE unread_count > 0;
CREATE INDEX idx_chat_room_members_active ON public.chat_room_members(user_id, room_id) WHERE left_at IS NULL;

COMMENT ON TABLE public.chat_room_members IS '聊天室成員表';

-- ----------------------------------------------------------------------------
-- 2.5 聊天訊息表 (chat_messages)
-- ----------------------------------------------------------------------------
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 訊息內容
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice', 'video', 'location', 'system')),
    content TEXT,

    -- 媒體檔案
    media_url TEXT,
    media_thumbnail_url TEXT,
    media_duration_seconds INTEGER, -- 語音/影片長度

    -- 位置資訊
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_address TEXT,

    -- 回覆訊息
    reply_to_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,

    -- 已讀狀態(儲存已讀的使用者 ID 陣列)
    read_by UUID[] DEFAULT '{}',

    -- 訊息狀態
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 確保刪除的訊息不能再被編輯
    CHECK (NOT (is_deleted = true AND is_edited = true))
);

CREATE INDEX idx_chat_messages_room_id ON public.chat_messages(room_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_reply_to ON public.chat_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX idx_chat_messages_undeleted ON public.chat_messages(room_id, created_at DESC) WHERE is_deleted = false;

COMMENT ON TABLE public.chat_messages IS '聊天訊息表';

-- ----------------------------------------------------------------------------
-- 2.6 生活動態表 (life_posts)
-- ----------------------------------------------------------------------------
CREATE TABLE public.life_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 作者
    author_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 內容
    content TEXT NOT NULL,

    -- 多媒體(支援多張圖片)
    media_urls TEXT[],
    media_type VARCHAR(20) DEFAULT 'image' CHECK (media_type IN ('none', 'image', 'video')),

    -- 位置標記
    location VARCHAR(200),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),

    -- 心情標記
    mood VARCHAR(50),
    mood_emoji VARCHAR(10),

    -- 可見範圍
    visibility VARCHAR(20) NOT NULL DEFAULT 'friends' CHECK (visibility IN ('public', 'friends', 'private')),

    -- 互動統計
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,

    -- 狀態
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_life_posts_author_id ON public.life_posts(author_id);
CREATE INDEX idx_life_posts_created_at ON public.life_posts(created_at DESC);
CREATE INDEX idx_life_posts_visibility ON public.life_posts(visibility);
CREATE INDEX idx_life_posts_mood ON public.life_posts(mood) WHERE mood IS NOT NULL;
CREATE INDEX idx_life_posts_active ON public.life_posts(created_at DESC) WHERE is_deleted = false;

COMMENT ON TABLE public.life_posts IS '生活動態表';

-- ----------------------------------------------------------------------------
-- 2.7 動態按讚表 (post_likes)
-- ----------------------------------------------------------------------------
CREATE TABLE public.post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    post_id UUID NOT NULL REFERENCES public.life_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 反應類型(可擴展為不同表情)
    reaction_type VARCHAR(20) DEFAULT 'like' CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry')),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 確保同一使用者不會重複按讚同一動態
    UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX idx_post_likes_created_at ON public.post_likes(created_at DESC);

COMMENT ON TABLE public.post_likes IS '動態按讚表';

-- ----------------------------------------------------------------------------
-- 2.8 動態留言表 (post_comments)
-- ----------------------------------------------------------------------------
CREATE TABLE public.post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    post_id UUID NOT NULL REFERENCES public.life_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 留言內容
    content TEXT NOT NULL,

    -- 回覆留言(支援巢狀留言)
    parent_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,

    -- 圖片(留言可以附圖)
    image_url TEXT,

    -- 互動統計
    likes_count INTEGER DEFAULT 0,

    -- 狀態
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_post_comments_post_id ON public.post_comments(post_id, created_at);
CREATE INDEX idx_post_comments_user_id ON public.post_comments(user_id);
CREATE INDEX idx_post_comments_parent ON public.post_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_post_comments_active ON public.post_comments(post_id, created_at) WHERE is_deleted = false;

COMMENT ON TABLE public.post_comments IS '動態留言表';

-- ----------------------------------------------------------------------------
-- 2.9 留言按讚表 (post_comment_likes)
-- ----------------------------------------------------------------------------
CREATE TABLE public.post_comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 確保同一使用者不會重複按讚同一留言
    UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment_id ON public.post_comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user_id ON public.post_comment_likes(user_id);

COMMENT ON TABLE public.post_comment_likes IS '留言按讚表';

-- ============================================================================
-- STEP 3: 建立函數 (Functions)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 更新動態統計(按讚數)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_post_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.life_posts
        SET likes_count = likes_count + 1
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.life_posts
        SET likes_count = GREATEST(0, likes_count - 1)
        WHERE id = OLD.post_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.2 更新動態統計(留言數)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_comment_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.is_deleted = false THEN
        UPDATE public.life_posts
        SET comments_count = comments_count + 1
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = true AND OLD.is_deleted = false THEN
        UPDATE public.life_posts
        SET comments_count = GREATEST(0, comments_count - 1)
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' AND OLD.is_deleted = false THEN
        UPDATE public.life_posts
        SET comments_count = GREATEST(0, comments_count - 1)
        WHERE id = OLD.post_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.3 建立好友邀請通知
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_friendship_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        -- 通知被邀請者
        INSERT INTO public.social_notifications (
            user_id,
            notification_type,
            title,
            content,
            triggered_by,
            related_id,
            related_type
        )
        SELECT
            NEW.friend_id,
            'friend_request',
            '新的好友邀請',
            up.display_name || ' 想要加你為好友',
            NEW.user_id,
            NEW.id,
            'friendship'
        FROM public.user_profiles up
        WHERE up.id = NEW.user_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        -- 通知邀請者好友邀請已被接受
        INSERT INTO public.social_notifications (
            user_id,
            notification_type,
            title,
            content,
            triggered_by,
            related_id,
            related_type
        )
        SELECT
            NEW.user_id,
            'friend_accepted',
            '好友邀請已接受',
            up.display_name || ' 接受了你的好友邀請',
            NEW.friend_id,
            NEW.id,
            'friendship'
        FROM public.user_profiles up
        WHERE up.id = NEW.friend_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.4 建立動態按讚通知
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_post_like_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- 只在不是自己按讚自己的動態時才通知
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.social_notifications (
            user_id,
            notification_type,
            title,
            content,
            triggered_by,
            related_id,
            related_type
        )
        SELECT
            p.author_id,
            'post_like',
            '有人按讚了你的動態',
            up.display_name || ' 按讚了你的動態',
            NEW.user_id,
            NEW.post_id,
            'post'
        FROM public.life_posts p
        INNER JOIN public.user_profiles up ON up.id = NEW.user_id
        WHERE p.id = NEW.post_id
        AND p.author_id != NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.5 建立動態留言通知
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_post_comment_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- 通知動態作者(如果不是自己留言)
        INSERT INTO public.social_notifications (
            user_id,
            notification_type,
            title,
            content,
            triggered_by,
            related_id,
            related_type
        )
        SELECT
            p.author_id,
            'post_comment',
            '有人留言了你的動態',
            up.display_name || ' 留言：' || LEFT(NEW.content, 50),
            NEW.user_id,
            NEW.id,
            'comment'
        FROM public.life_posts p
        INNER JOIN public.user_profiles up ON up.id = NEW.user_id
        WHERE p.id = NEW.post_id
        AND p.author_id != NEW.user_id;

        -- 如果是回覆留言，也通知被回覆的人
        IF NEW.parent_comment_id IS NOT NULL THEN
            INSERT INTO public.social_notifications (
                user_id,
                notification_type,
                title,
                content,
                triggered_by,
                related_id,
                related_type
            )
            SELECT
                pc.user_id,
                'comment_reply',
                '有人回覆了你的留言',
                up.display_name || ' 回覆：' || LEFT(NEW.content, 50),
                NEW.user_id,
                NEW.id,
                'comment'
            FROM public.post_comments pc
            INNER JOIN public.user_profiles up ON up.id = NEW.user_id
            WHERE pc.id = NEW.parent_comment_id
            AND pc.user_id != NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.6 更新聊天室最後訊息
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_chat_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.chat_rooms
        SET
            last_message_content = NEW.content,
            last_message_at = NEW.created_at,
            last_message_by = NEW.sender_id,
            message_count = message_count + 1,
            updated_at = NOW()
        WHERE id = NEW.room_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.7 增加未讀訊息數
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_increment_unread_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- 對所有聊天室成員(除了發送者)增加未讀數
        UPDATE public.chat_room_members
        SET unread_count = unread_count + 1
        WHERE room_id = NEW.room_id
        AND user_id != NEW.sender_id
        AND left_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.8 發送好友邀請(含雙向關係建立)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_send_friend_request(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
    current_profile_id UUID;
    new_friendship_id UUID;
BEGIN
    -- 取得當前使用者的 profile ID
    SELECT id INTO current_profile_id
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid();

    -- 檢查是否已經是好友或已有待處理的邀請
    IF EXISTS (
        SELECT 1 FROM public.friendships
        WHERE (user_id = current_profile_id AND friend_id = target_user_id)
        OR (user_id = target_user_id AND friend_id = current_profile_id)
    ) THEN
        RAISE EXCEPTION '已經是好友或已有待處理的邀請';
    END IF;

    -- 建立好友邀請
    INSERT INTO public.friendships (user_id, friend_id, requested_by, status)
    VALUES (current_profile_id, target_user_id, current_profile_id, 'pending')
    RETURNING id INTO new_friendship_id;

    RETURN new_friendship_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.9 接受好友邀請(建立雙向關係)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_accept_friend_request(friendship_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_profile_id UUID;
    sender_id UUID;
    receiver_id UUID;
BEGIN
    -- 取得當前使用者的 profile ID
    SELECT id INTO current_profile_id
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid();

    -- 取得好友邀請資訊
    SELECT user_id, friend_id INTO sender_id, receiver_id
    FROM public.friendships
    WHERE id = friendship_id
    AND status = 'pending';

    -- 確認當前使用者是接收者
    IF receiver_id != current_profile_id THEN
        RAISE EXCEPTION '只能接受發送給自己的好友邀請';
    END IF;

    -- 更新邀請狀態
    UPDATE public.friendships
    SET status = 'accepted',
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = friendship_id;

    -- 建立反向關係(讓雙方都能查詢到對方)
    INSERT INTO public.friendships (user_id, friend_id, requested_by, status, accepted_at)
    VALUES (receiver_id, sender_id, sender_id, 'accepted', NOW())
    ON CONFLICT (user_id, friend_id) DO NOTHING;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.10 拒絕好友邀請
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_reject_friend_request(friendship_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_profile_id UUID;
BEGIN
    -- 取得當前使用者的 profile ID
    SELECT id INTO current_profile_id
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid();

    -- 更新邀請狀態
    UPDATE public.friendships
    SET status = 'rejected',
        rejected_at = NOW(),
        updated_at = NOW()
    WHERE id = friendship_id
    AND friend_id = current_profile_id
    AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION '找不到待處理的好友邀請';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: 建立觸發器 (Triggers)
-- ============================================================================

-- 動態按讚統計
CREATE TRIGGER trigger_update_post_stats
    AFTER INSERT OR DELETE ON public.post_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_post_stats();

-- 動態留言統計
CREATE TRIGGER trigger_update_comment_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_comment_stats();

-- 好友邀請通知
CREATE TRIGGER trigger_create_notification_on_friend_request
    AFTER INSERT OR UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_create_friendship_notification();

-- 動態按讚通知
CREATE TRIGGER trigger_create_notification_on_post_like
    AFTER INSERT ON public.post_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_create_post_like_notification();

-- 動態留言通知
CREATE TRIGGER trigger_create_notification_on_post_comment
    AFTER INSERT ON public.post_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_create_post_comment_notification();

-- 更新聊天室最後訊息
CREATE TRIGGER trigger_update_chat_room_timestamp
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_chat_room_last_message();

-- 增加未讀訊息數
CREATE TRIGGER trigger_increment_unread_count
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_increment_unread_count();

-- ============================================================================
-- STEP 5: 啟用 RLS 並建立所有 Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 friendships RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their friendships"
    ON public.friendships FOR SELECT
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        OR friend_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can send friend requests"
    ON public.friendships FOR INSERT
    WITH CHECK (
        requested_by IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND user_id = requested_by
    );

CREATE POLICY "Users can update their friendships"
    ON public.friendships FOR UPDATE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        OR friend_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can delete their friendships"
    ON public.friendships FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        OR friend_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5.2 social_notifications RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON public.social_notifications FOR SELECT
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "System can create notifications"
    ON public.social_notifications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
    ON public.social_notifications FOR UPDATE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can delete own notifications"
    ON public.social_notifications FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5.3 chat_rooms RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their chat rooms"
    ON public.chat_rooms FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_room_members
            WHERE room_id = chat_rooms.id
            AND user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can create chat rooms"
    ON public.chat_rooms FOR INSERT
    WITH CHECK (
        created_by IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Room creators can update chat rooms"
    ON public.chat_rooms FOR UPDATE
    USING (
        created_by IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5.4 chat_room_members RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view members"
    ON public.chat_room_members FOR SELECT
    USING (
        room_id IN (
            SELECT room_id FROM public.chat_room_members
            WHERE user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Room owners can add members"
    ON public.chat_room_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_rooms
            WHERE id = room_id
            AND created_by IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Members can update own settings"
    ON public.chat_room_members FOR UPDATE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Members can leave rooms"
    ON public.chat_room_members FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5.5 chat_messages RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view messages"
    ON public.chat_messages FOR SELECT
    USING (
        room_id IN (
            SELECT room_id FROM public.chat_room_members
            WHERE user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
            AND left_at IS NULL
        )
    );

CREATE POLICY "Room members can send messages"
    ON public.chat_messages FOR INSERT
    WITH CHECK (
        sender_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND room_id IN (
            SELECT room_id FROM public.chat_room_members
            WHERE user_id = sender_id
            AND left_at IS NULL
        )
    );

CREATE POLICY "Senders can update own messages"
    ON public.chat_messages FOR UPDATE
    USING (
        sender_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5.6 life_posts RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.life_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own posts"
    ON public.life_posts FOR SELECT
    USING (
        author_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can view friends posts"
    ON public.life_posts FOR SELECT
    USING (
        visibility IN ('public', 'friends')
        AND (
            -- 公開動態
            visibility = 'public'
            OR
            -- 好友動態
            (visibility = 'friends' AND EXISTS (
                SELECT 1 FROM public.friendships
                WHERE status = 'accepted'
                AND (
                    (user_id = author_id AND friend_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()))
                    OR
                    (friend_id = author_id AND user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()))
                )
            ))
        )
    );

CREATE POLICY "Users can create own posts"
    ON public.life_posts FOR INSERT
    WITH CHECK (
        author_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can update own posts"
    ON public.life_posts FOR UPDATE
    USING (
        author_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can delete own posts"
    ON public.life_posts FOR DELETE
    USING (
        author_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5.7 post_likes RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view post likes"
    ON public.post_likes FOR SELECT
    USING (
        post_id IN (
            SELECT id FROM public.life_posts
            WHERE visibility IN ('public', 'friends')
        )
    );

CREATE POLICY "Users can like posts"
    ON public.post_likes FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND post_id IN (
            SELECT id FROM public.life_posts
            WHERE visibility IN ('public', 'friends')
        )
    );

CREATE POLICY "Users can unlike posts"
    ON public.post_likes FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5.8 post_comments RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view post comments"
    ON public.post_comments FOR SELECT
    USING (
        post_id IN (
            SELECT id FROM public.life_posts
            WHERE visibility IN ('public', 'friends')
        )
    );

CREATE POLICY "Users can comment on posts"
    ON public.post_comments FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
        AND post_id IN (
            SELECT id FROM public.life_posts
            WHERE visibility IN ('public', 'friends')
        )
    );

CREATE POLICY "Users can update own comments"
    ON public.post_comments FOR UPDATE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can delete own comments"
    ON public.post_comments FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 5.9 post_comment_likes RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.post_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comment likes"
    ON public.post_comment_likes FOR SELECT
    USING (true);

CREATE POLICY "Users can like comments"
    ON public.post_comment_likes FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can unlike comments"
    ON public.post_comment_likes FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    );

-- ============================================================================
-- STEP 6: 建立視圖 (Views)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 使用者好友列表視圖
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_user_friends AS
SELECT
    f.id AS friendship_id,
    f.user_id,
    f.friend_id,
    CASE
        WHEN f.user_id = up_current.id THEN up_friend.id
        ELSE up_current.id
    END AS friend_user_id,
    CASE
        WHEN f.user_id = up_current.id THEN up_friend.display_name
        ELSE up_current.display_name
    END AS friend_name,
    CASE
        WHEN f.user_id = up_current.id THEN up_friend.avatar_url
        ELSE up_current.avatar_url
    END AS friend_avatar,
    f.relationship_type,
    f.interaction_count,
    f.last_interaction_at,
    f.created_at AS friends_since
FROM
    public.friendships f
    INNER JOIN public.user_profiles up_current ON f.user_id = up_current.id
    INNER JOIN public.user_profiles up_friend ON f.friend_id = up_friend.id
WHERE
    f.status = 'accepted';

COMMENT ON VIEW public.v_user_friends IS '使用者好友列表視圖';

-- ----------------------------------------------------------------------------
-- 6.2 待處理的好友邀請視圖
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_user_friend_requests AS
SELECT
    f.id AS friendship_id,
    f.friend_id AS receiver_id,
    f.user_id AS sender_id,
    up.display_name AS sender_name,
    up.avatar_url AS sender_avatar,
    f.notes,
    f.created_at AS requested_at
FROM
    public.friendships f
    INNER JOIN public.user_profiles up ON f.user_id = up.id
WHERE
    f.status = 'pending';

COMMENT ON VIEW public.v_user_friend_requests IS '待處理的好友邀請視圖';

-- ----------------------------------------------------------------------------
-- 6.3 動態時間軸視圖
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_post_timeline AS
SELECT
    p.id AS post_id,
    p.author_id,
    up.display_name AS author_name,
    up.avatar_url AS author_avatar,
    p.content,
    p.media_urls,
    p.media_type,
    p.location,
    p.mood,
    p.mood_emoji,
    p.visibility,
    p.likes_count,
    p.comments_count,
    p.shares_count,
    p.is_edited,
    p.created_at,
    p.updated_at
FROM
    public.life_posts p
    INNER JOIN public.user_profiles up ON p.author_id = up.id
WHERE
    p.is_deleted = false
ORDER BY
    p.created_at DESC;

COMMENT ON VIEW public.v_post_timeline IS '動態時間軸視圖';

-- ----------------------------------------------------------------------------
-- 6.4 聊天室列表視圖
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_chat_room_list AS
SELECT
    cr.id AS room_id,
    cr.room_type,
    cr.room_name,
    cr.room_avatar,
    cr.last_message_content,
    cr.last_message_at,
    crm.user_id,
    crm.unread_count,
    crm.last_read_at,
    crm.muted,
    cr.is_active
FROM
    public.chat_rooms cr
    INNER JOIN public.chat_room_members crm ON cr.id = crm.room_id
WHERE
    crm.left_at IS NULL
ORDER BY
    cr.last_message_at DESC NULLS LAST;

COMMENT ON VIEW public.v_chat_room_list IS '聊天室列表視圖';

-- ============================================================================
-- 完成訊息
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '✅ ElderCare Companion 社交功能 v1.2 資料庫 Schema 建置完成！';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '已建立的社交功能:';
    RAISE NOTICE '  1. 好友關係管理(邀請、接受、封鎖)';
    RAISE NOTICE '  2. 一對一和群組聊天系統';
    RAISE NOTICE '  3. 生活動態分享(類似 Facebook)';
    RAISE NOTICE '  4. 動態互動(按讚、留言、回覆)';
    RAISE NOTICE '  5. 即時通知系統';
    RAISE NOTICE '';
    RAISE NOTICE '資料表總數: 9 個';
    RAISE NOTICE '  • friendships(好友關係)';
    RAISE NOTICE '  • chat_rooms(聊天室)';
    RAISE NOTICE '  • chat_room_members(聊天室成員)';
    RAISE NOTICE '  • chat_messages(聊天訊息)';
    RAISE NOTICE '  • life_posts(生活動態)';
    RAISE NOTICE '  • post_likes(動態按讚)';
    RAISE NOTICE '  • post_comments(動態留言)';
    RAISE NOTICE '  • post_comment_likes(留言按讚)';
    RAISE NOTICE '  • social_notifications(通知)';
    RAISE NOTICE '';
    RAISE NOTICE '視圖數量: 4 個';
    RAISE NOTICE '  • v_user_friends(好友列表)';
    RAISE NOTICE '  • v_user_friend_requests(好友邀請)';
    RAISE NOTICE '  • v_post_timeline(動態時間軸)';
    RAISE NOTICE '  • v_chat_room_list(聊天室列表)';
    RAISE NOTICE '';
    RAISE NOTICE '函數數量: 10 個';
    RAISE NOTICE '  • 統計更新函數(按讚數、留言數)';
    RAISE NOTICE '  • 通知建立函數(好友邀請、按讚、留言)';
    RAISE NOTICE '  • 聊天室更新函數(最後訊息、未讀數)';
    RAISE NOTICE '  • 好友操作函數(發送邀請、接受、拒絕)';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS 安全政策:';
    RAISE NOTICE '  • 好友只能看到對方的公開或好友可見內容';
    RAISE NOTICE '  • 使用者只能管理自己的好友關係和動態';
    RAISE NOTICE '  • 聊天室成員才能查看訊息';
    RAISE NOTICE '  • 通知只對接收者可見';
    RAISE NOTICE '';
    RAISE NOTICE '下一步:';
    RAISE NOTICE '  1. 在 backend 建立 routes/socialApi.js';
    RAISE NOTICE '  2. 實作前端 social.js 的 API 串接';
    RAISE NOTICE '  3. 測試好友邀請流程';
    RAISE NOTICE '  4. 測試聊天和動態發布功能';
    RAISE NOTICE '============================================================================';
END $$;

COMMENT ON SCHEMA public IS 'ElderCare Companion v1.2 - 社交功能模組(修正版)';
