-- ============================================================================
-- 社交聊天訊息資料庫表
-- 用於支援一對一聊天功能
-- ============================================================================

-- 1. 建立 direct_messages 表（聊天訊息）
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'voice', 'video')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    is_deleted_by_sender BOOLEAN DEFAULT FALSE,
    is_deleted_by_receiver BOOLEAN DEFAULT FALSE,
    reply_to_message_id UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver ON public.direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON public.direct_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON public.direct_messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread ON public.direct_messages(receiver_id, is_read) WHERE is_read = FALSE;

-- 3. 建立觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_direct_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_direct_messages_updated_at
    BEFORE UPDATE ON public.direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_direct_messages_updated_at();

-- 4. 建立視圖：對話列表（最後一則訊息）
CREATE OR REPLACE VIEW public.v_conversation_list AS
WITH latest_messages AS (
    SELECT DISTINCT ON (
        CASE
            WHEN sender_id < receiver_id THEN sender_id || '-' || receiver_id
            ELSE receiver_id || '-' || sender_id
        END
    )
        id,
        sender_id,
        receiver_id,
        message_text,
        message_type,
        is_read,
        created_at,
        CASE
            WHEN sender_id < receiver_id THEN sender_id || '-' || receiver_id
            ELSE receiver_id || '-' || sender_id
        END as conversation_key
    FROM public.direct_messages
    WHERE is_deleted_by_sender = FALSE OR is_deleted_by_receiver = FALSE
    ORDER BY conversation_key, created_at DESC
)
SELECT
    lm.id as last_message_id,
    lm.sender_id,
    lm.receiver_id,
    lm.message_text as last_message,
    lm.message_type as last_message_type,
    lm.created_at as last_message_at,
    lm.is_read,
    sp.display_name as sender_name,
    sp.avatar_url as sender_avatar,
    rp.display_name as receiver_name,
    rp.avatar_url as receiver_avatar,
    (
        SELECT COUNT(*)
        FROM public.direct_messages
        WHERE receiver_id = lm.receiver_id
          AND sender_id = lm.sender_id
          AND is_read = FALSE
          AND is_deleted_by_receiver = FALSE
    ) as unread_count
FROM latest_messages lm
LEFT JOIN public.user_profiles sp ON lm.sender_id = sp.id
LEFT JOIN public.user_profiles rp ON lm.receiver_id = rp.id
ORDER BY lm.created_at DESC;

-- 5. Row Level Security (RLS) 政策
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- 允許使用者查看自己發送或接收的訊息
CREATE POLICY "Users can view their own messages"
    ON public.direct_messages
    FOR SELECT
    USING (
        sender_id IN (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
        OR receiver_id IN (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );

-- 允許使用者發送訊息
CREATE POLICY "Users can send messages"
    ON public.direct_messages
    FOR INSERT
    WITH CHECK (
        sender_id IN (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );

-- 允許使用者更新自己發送或接收的訊息（標記已讀、刪除等）
CREATE POLICY "Users can update their own messages"
    ON public.direct_messages
    FOR UPDATE
    USING (
        sender_id IN (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
        OR receiver_id IN (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );

-- 6. 註解說明
COMMENT ON TABLE public.direct_messages IS '社交功能 - 一對一聊天訊息';
COMMENT ON COLUMN public.direct_messages.sender_id IS '發送者的 user_profile_id';
COMMENT ON COLUMN public.direct_messages.receiver_id IS '接收者的 user_profile_id';
COMMENT ON COLUMN public.direct_messages.message_text IS '訊息內容';
COMMENT ON COLUMN public.direct_messages.message_type IS '訊息類型：text, image, file, voice, video';
COMMENT ON COLUMN public.direct_messages.is_read IS '是否已讀';
COMMENT ON COLUMN public.direct_messages.read_at IS '已讀時間';
COMMENT ON COLUMN public.direct_messages.is_deleted_by_sender IS '發送者是否刪除（軟刪除）';
COMMENT ON COLUMN public.direct_messages.is_deleted_by_receiver IS '接收者是否刪除（軟刪除）';
COMMENT ON COLUMN public.direct_messages.reply_to_message_id IS '回覆的訊息 ID';
COMMENT ON COLUMN public.direct_messages.metadata IS '額外資訊（如圖片 URL、檔案資訊等）';

-- 完成提示
SELECT '✅ direct_messages 表創建完成' as status;
SELECT '✅ 索引創建完成' as status;
SELECT '✅ 觸發器創建完成' as status;
SELECT '✅ RLS 政策設定完成' as status;
SELECT '✅ 對話列表視圖創建完成' as status;
