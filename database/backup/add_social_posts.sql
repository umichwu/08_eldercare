-- ================================================
-- ElderCare - 社交動態貼文資料表
-- ================================================
-- 用途：儲存使用者動態貼文、按讚、留言、通知
-- 建立日期：2025-01-21
-- ================================================

-- 1. 刪除現有表格和視圖（如果存在）
DROP VIEW IF EXISTS v_post_timeline CASCADE;
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS social_notifications CASCADE;
DROP TABLE IF EXISTS social_posts CASCADE;

-- 2. 建立 social_posts 表（動態貼文）
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 作者資訊
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- 貼文內容
  content TEXT NOT NULL,
  mood TEXT,  -- 心情（如：開心、難過、生氣等）
  visibility TEXT DEFAULT 'friends' CHECK (visibility IN ('public', 'friends', 'private')),

  -- 媒體相關
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio')),

  -- 統計資訊
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,

  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 3. 建立 post_likes 表（按讚）
CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 每個使用者對每則貼文只能按讚一次
  UNIQUE(post_id, user_profile_id)
);

-- 4. 建立 post_comments 表（留言）
CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  content TEXT NOT NULL,

  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 5. 建立 social_notifications 表（通知）
CREATE TABLE social_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 接收通知的使用者
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- 觸發通知的使用者
  actor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_avatar TEXT,

  -- 通知類型
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'like', 'comment', 'friend_request', 'friend_accepted', 'mention', 'other'
  )),

  -- 通知內容
  message TEXT,

  -- 相關資源
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,

  -- 已讀狀態
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 建立索引以提升查詢效能
CREATE INDEX idx_social_posts_user ON social_posts(user_profile_id);
CREATE INDEX idx_social_posts_created_at ON social_posts(created_at DESC);
CREATE INDEX idx_social_posts_visibility ON social_posts(visibility);
CREATE INDEX idx_social_posts_deleted_at ON social_posts(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_post_likes_post ON post_likes(post_id);
CREATE INDEX idx_post_likes_user ON post_likes(user_profile_id);

CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_post_comments_user ON post_comments(user_profile_id);
CREATE INDEX idx_post_comments_deleted_at ON post_comments(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_user ON social_notifications(user_id);
CREATE INDEX idx_notifications_is_read ON social_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON social_notifications(created_at DESC);

-- 7. 建立自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_social_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_posts_updated_at();

CREATE TRIGGER trigger_update_post_comments_updated_at
  BEFORE UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_social_posts_updated_at();

-- 8. 建立自動更新統計數據的觸發器

-- 按讚數量自動更新
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE social_posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE social_posts
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_post_likes_count
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_post_likes_count();

-- 留言數量自動更新
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE social_posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE social_posts
    SET comments_count = GREATEST(comments_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_post_comments_count
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comments_count();

-- 9. 建立視圖：動態時間軸
CREATE OR REPLACE VIEW v_post_timeline AS
SELECT
  p.id,
  p.user_profile_id AS author_id,
  up.display_name AS author_name,
  up.avatar_url AS author_avatar,
  p.content,
  p.mood,
  p.visibility,
  p.media_url,
  p.media_type,
  p.likes_count,
  p.comments_count,
  p.created_at,
  p.updated_at,
  -- 檢查當前使用者是否已按讚（需要在應用層處理）
  FALSE AS is_liked_by_me
FROM social_posts p
JOIN user_profiles up ON p.user_profile_id = up.id
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC;

-- 10. 啟用 Row Level Security (RLS)
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_notifications ENABLE ROW LEVEL SECURITY;

-- 11. 建立 RLS 政策

-- social_posts 政策
CREATE POLICY "Users can view public posts"
  ON social_posts
  FOR SELECT
  USING (visibility = 'public' OR deleted_at IS NULL);

CREATE POLICY "Users can view their own posts"
  ON social_posts
  FOR SELECT
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view friends posts"
  ON social_posts
  FOR SELECT
  USING (
    visibility = 'friends'
    AND user_profile_id IN (
      SELECT friend_id FROM v_user_friends
      WHERE user_id IN (
        SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create their own posts"
  ON social_posts
  FOR INSERT
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own posts"
  ON social_posts
  FOR UPDATE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own posts"
  ON social_posts
  FOR DELETE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- post_likes 政策
CREATE POLICY "Anyone can view likes"
  ON post_likes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can like posts"
  ON post_likes
  FOR INSERT
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can unlike posts"
  ON post_likes
  FOR DELETE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- post_comments 政策
CREATE POLICY "Anyone can view comments"
  ON post_comments
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "Users can comment on posts"
  ON post_comments
  FOR INSERT
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own comments"
  ON post_comments
  FOR UPDATE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own comments"
  ON post_comments
  FOR DELETE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- social_notifications 政策
CREATE POLICY "Users can view their own notifications"
  ON social_notifications
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "System can create notifications"
  ON social_notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON social_notifications
  FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- 12. 建立輔助函數

-- 取得未讀通知數量
CREATE OR REPLACE FUNCTION get_unread_notifications_count(user_profile_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM social_notifications
    WHERE user_id = user_profile_id
      AND is_read = FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 建立通知（輔助函數）
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_actor_id UUID,
  p_notification_type TEXT,
  p_message TEXT DEFAULT NULL,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_actor_name TEXT;
  v_actor_avatar TEXT;
BEGIN
  -- 取得觸發者的資訊
  SELECT display_name, avatar_url
  INTO v_actor_name, v_actor_avatar
  FROM user_profiles
  WHERE id = p_actor_id;

  -- 插入通知
  INSERT INTO social_notifications (
    user_id,
    actor_id,
    actor_name,
    actor_avatar,
    notification_type,
    message,
    post_id,
    comment_id
  ) VALUES (
    p_user_id,
    p_actor_id,
    v_actor_name,
    v_actor_avatar,
    p_notification_type,
    p_message,
    p_post_id,
    p_comment_id
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. 註解說明
COMMENT ON TABLE social_posts IS '社交動態貼文表';
COMMENT ON TABLE post_likes IS '貼文按讚表';
COMMENT ON TABLE post_comments IS '貼文留言表';
COMMENT ON TABLE social_notifications IS '社交通知表';
COMMENT ON VIEW v_post_timeline IS '動態時間軸視圖';

COMMENT ON COLUMN social_posts.visibility IS '可見性：public（公開）、friends（好友）、private（私人）';
COMMENT ON COLUMN social_posts.mood IS '心情狀態';
COMMENT ON COLUMN social_notifications.notification_type IS '通知類型：like、comment、friend_request、friend_accepted、mention、other';

-- 完成
SELECT '✅ 社交動態貼文資料表建立完成！' AS status;
