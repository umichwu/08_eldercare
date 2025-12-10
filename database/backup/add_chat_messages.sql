-- ================================================
-- ElderCare - 聊天訊息資料表
-- ================================================
-- 用途：儲存使用者之間的聊天訊息
-- 建立日期：2025-01-21
-- ================================================

-- 1. 刪除現有表格（如果存在）
DROP TABLE IF EXISTS chat_messages CASCADE;

-- 2. 建立 chat_messages 表
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 發送者和接收者
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- 訊息內容
  content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file')),

  -- 媒體相關
  media_url TEXT,
  media_thumbnail_url TEXT,
  file_name TEXT,
  file_size BIGINT,

  -- 已讀狀態
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- 刪除標記（軟刪除）
  is_deleted_by_sender BOOLEAN DEFAULT FALSE,
  is_deleted_by_receiver BOOLEAN DEFAULT FALSE,

  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 建立索引以提升查詢效能
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_chat_messages_unread ON chat_messages(receiver_id, is_read) WHERE is_read = FALSE;

-- 4. 建立自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_messages_updated_at();

-- 5. 啟用 Row Level Security (RLS)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 6. 建立 RLS 政策

-- 政策 1: 使用者可以查看自己發送或接收的訊息
CREATE POLICY "Users can view their own messages"
  ON chat_messages
  FOR SELECT
  USING (
    sender_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
    OR receiver_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- 政策 2: 使用者可以發送訊息
CREATE POLICY "Users can send messages"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- 政策 3: 使用者可以更新自己的訊息（標記已讀、刪除等）
CREATE POLICY "Users can update their own messages"
  ON chat_messages
  FOR UPDATE
  USING (
    sender_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
    OR receiver_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- 政策 4: 使用者可以刪除自己發送的訊息
CREATE POLICY "Users can delete their sent messages"
  ON chat_messages
  FOR DELETE
  USING (
    sender_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- 7. 建立輔助函數：取得未讀訊息數量
CREATE OR REPLACE FUNCTION get_unread_message_count(user_profile_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM chat_messages
    WHERE receiver_id = user_profile_id
      AND is_read = FALSE
      AND is_deleted_by_receiver = FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 建立輔助函數：取得最近聊天對象
CREATE OR REPLACE FUNCTION get_recent_chat_contacts(user_profile_id UUID, limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
  contact_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_messages AS (
    SELECT DISTINCT ON (
      CASE
        WHEN sender_id = user_profile_id THEN receiver_id
        ELSE sender_id
      END
    )
      CASE
        WHEN sender_id = user_profile_id THEN receiver_id
        ELSE sender_id
      END AS contact_id,
      content AS last_message,
      created_at AS last_message_at
    FROM chat_messages
    WHERE (sender_id = user_profile_id OR receiver_id = user_profile_id)
      AND is_deleted_by_sender = FALSE
      AND is_deleted_by_receiver = FALSE
    ORDER BY
      CASE
        WHEN sender_id = user_profile_id THEN receiver_id
        ELSE sender_id
      END,
      created_at DESC
  )
  SELECT
    rm.contact_id,
    up.display_name,
    up.avatar_url,
    rm.last_message,
    rm.last_message_at,
    (
      SELECT COUNT(*)::INTEGER
      FROM chat_messages
      WHERE sender_id = rm.contact_id
        AND receiver_id = user_profile_id
        AND is_read = FALSE
        AND is_deleted_by_receiver = FALSE
    ) AS unread_count
  FROM recent_messages rm
  JOIN user_profiles up ON up.id = rm.contact_id
  ORDER BY rm.last_message_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 註解說明
COMMENT ON TABLE chat_messages IS '聊天訊息表 - 儲存使用者之間的私人訊息';
COMMENT ON COLUMN chat_messages.sender_id IS '發送者 user_profiles.id';
COMMENT ON COLUMN chat_messages.receiver_id IS '接收者 user_profiles.id';
COMMENT ON COLUMN chat_messages.content IS '訊息內容（文字）';
COMMENT ON COLUMN chat_messages.message_type IS '訊息類型：text, image, video, audio, file';
COMMENT ON COLUMN chat_messages.media_url IS '媒體檔案 URL（圖片、影片等）';
COMMENT ON COLUMN chat_messages.is_read IS '是否已讀';
COMMENT ON COLUMN chat_messages.is_deleted_by_sender IS '發送者是否刪除（軟刪除）';
COMMENT ON COLUMN chat_messages.is_deleted_by_receiver IS '接收者是否刪除（軟刪除）';

-- 完成
SELECT '✅ chat_messages 表建立完成！' AS status;
