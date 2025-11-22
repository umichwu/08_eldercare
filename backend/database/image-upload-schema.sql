-- ================================================
-- 圖片上傳功能資料庫 Schema
-- 功能：藥物外觀拍照、心情日記配圖
-- ================================================

-- 1. 圖片檔案表 (uploaded_images)
-- 儲存所有上傳的圖片資訊
CREATE TABLE IF NOT EXISTS uploaded_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploader_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,              -- 原始檔名
    storage_path TEXT NOT NULL,                   -- Supabase Storage 路徑
    storage_url TEXT NOT NULL,                    -- 公開存取 URL
    file_size INTEGER NOT NULL,                   -- 檔案大小（bytes）
    mime_type VARCHAR(100) NOT NULL,              -- MIME 類型（image/jpeg, image/png）
    width INTEGER,                                -- 圖片寬度（像素）
    height INTEGER,                               -- 圖片高度（像素）
    image_type VARCHAR(50) NOT NULL,              -- 圖片類型：medication, mood_diary, profile, other
    related_id UUID,                              -- 關聯 ID（藥物 ID、日記 ID 等）
    thumbnail_url TEXT,                           -- 縮圖 URL（選用）
    metadata JSONB,                               -- 額外元數據（拍攝時間、地點、裝置等）
    is_deleted BOOLEAN DEFAULT FALSE,             -- 軟刪除標記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 藥物圖片表 (medication_images)
-- 連結藥物與圖片
CREATE TABLE IF NOT EXISTS medication_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    image_id UUID NOT NULL REFERENCES uploaded_images(id) ON DELETE CASCADE,
    image_type VARCHAR(50) DEFAULT 'appearance',  -- appearance(外觀), package(包裝), label(標籤)
    description TEXT,                              -- 圖片描述
    is_primary BOOLEAN DEFAULT FALSE,              -- 是否為主要圖片
    display_order INTEGER DEFAULT 0,               -- 顯示順序
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(medication_id, image_id)
);

-- 3. 心情日記表 (mood_diaries)
-- 儲存長輩的心情日記
CREATE TABLE IF NOT EXISTS mood_diaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
    title VARCHAR(200),                            -- 日記標題（選用）
    content TEXT NOT NULL,                         -- 日記內容
    mood_level INTEGER CHECK (mood_level >= 1 AND mood_level <= 5),  -- 心情等級 1-5
    mood_emoji VARCHAR(10),                        -- 心情表情符號
    tags TEXT[],                                   -- 標籤（如：開心、難過、生氣）
    weather VARCHAR(50),                           -- 天氣（選用）
    location TEXT,                                 -- 地點（選用）
    is_private BOOLEAN DEFAULT FALSE,              -- 是否私密（只有自己看得到）
    view_count INTEGER DEFAULT 0,                  -- 瀏覽次數
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 心情日記圖片表 (mood_diary_images)
-- 連結心情日記與圖片
CREATE TABLE IF NOT EXISTS mood_diary_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    diary_id UUID NOT NULL REFERENCES mood_diaries(id) ON DELETE CASCADE,
    image_id UUID NOT NULL REFERENCES uploaded_images(id) ON DELETE CASCADE,
    caption TEXT,                                  -- 圖片說明文字
    display_order INTEGER DEFAULT 0,               -- 顯示順序
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(diary_id, image_id)
);

-- 5. 圖片標籤表 (image_tags)
-- 用於圖片的 AI 自動標記或手動標記
CREATE TABLE IF NOT EXISTS image_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL REFERENCES uploaded_images(id) ON DELETE CASCADE,
    tag_name VARCHAR(100) NOT NULL,                -- 標籤名稱
    tag_type VARCHAR(50) DEFAULT 'manual',         -- manual(手動), ai(AI識別)
    confidence DECIMAL(3, 2),                      -- AI 信心度（0.00-1.00）
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(image_id, tag_name)
);

-- ================================================
-- 索引優化
-- ================================================

-- uploaded_images 索引
CREATE INDEX idx_uploaded_images_uploader ON uploaded_images(uploader_id);
CREATE INDEX idx_uploaded_images_type ON uploaded_images(image_type);
CREATE INDEX idx_uploaded_images_related ON uploaded_images(related_id);
CREATE INDEX idx_uploaded_images_created ON uploaded_images(created_at DESC);
CREATE INDEX idx_uploaded_images_not_deleted ON uploaded_images(is_deleted) WHERE is_deleted = FALSE;

-- medication_images 索引
CREATE INDEX idx_medication_images_medication ON medication_images(medication_id);
CREATE INDEX idx_medication_images_image ON medication_images(image_id);
CREATE INDEX idx_medication_images_primary ON medication_images(medication_id, is_primary) WHERE is_primary = TRUE;

-- mood_diaries 索引
CREATE INDEX idx_mood_diaries_elder ON mood_diaries(elder_id);
CREATE INDEX idx_mood_diaries_created ON mood_diaries(created_at DESC);
CREATE INDEX idx_mood_diaries_mood_level ON mood_diaries(mood_level);
CREATE INDEX idx_mood_diaries_tags ON mood_diaries USING GIN(tags);
CREATE INDEX idx_mood_diaries_public ON mood_diaries(elder_id, is_private) WHERE is_private = FALSE;

-- mood_diary_images 索引
CREATE INDEX idx_mood_diary_images_diary ON mood_diary_images(diary_id);
CREATE INDEX idx_mood_diary_images_image ON mood_diary_images(image_id);

-- image_tags 索引
CREATE INDEX idx_image_tags_image ON image_tags(image_id);
CREATE INDEX idx_image_tags_name ON image_tags(tag_name);

-- ================================================
-- Row Level Security (RLS) 政策
-- ================================================

-- 啟用 RLS
ALTER TABLE uploaded_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_diary_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_tags ENABLE ROW LEVEL SECURITY;

-- uploaded_images 政策
CREATE POLICY "users_can_upload_images" ON uploaded_images
    FOR INSERT
    WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "users_can_view_own_images" ON uploaded_images
    FOR SELECT
    USING (uploader_id = auth.uid());

CREATE POLICY "users_can_delete_own_images" ON uploaded_images
    FOR UPDATE
    USING (uploader_id = auth.uid());

-- medication_images 政策
CREATE POLICY "users_can_manage_medication_images" ON medication_images
    FOR ALL
    USING (
        medication_id IN (
            SELECT id FROM medications
            WHERE elder_id IN (
                SELECT id FROM elders WHERE user_profile_id = auth.uid()
            )
        )
    );

-- mood_diaries 政策
CREATE POLICY "elders_can_manage_own_diaries" ON mood_diaries
    FOR ALL
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE user_profile_id = auth.uid()
        )
    );

CREATE POLICY "family_can_view_public_diaries" ON mood_diaries
    FOR SELECT
    USING (
        is_private = FALSE
        AND elder_id IN (
            SELECT elder_id FROM elder_family_relationships
            WHERE family_member_id IN (
                SELECT id FROM family_members
                WHERE user_profile_id = auth.uid()
            )
        )
    );

-- mood_diary_images 政策
CREATE POLICY "users_can_manage_diary_images" ON mood_diary_images
    FOR ALL
    USING (
        diary_id IN (
            SELECT id FROM mood_diaries
            WHERE elder_id IN (
                SELECT id FROM elders WHERE user_profile_id = auth.uid()
            )
        )
    );

-- image_tags 政策
CREATE POLICY "users_can_manage_image_tags" ON image_tags
    FOR ALL
    USING (
        image_id IN (
            SELECT id FROM uploaded_images WHERE uploader_id = auth.uid()
        )
    );

-- ================================================
-- 輔助函數
-- ================================================

-- 取得藥物的所有圖片
CREATE OR REPLACE FUNCTION get_medication_images(p_medication_id UUID)
RETURNS TABLE(
    image_id UUID,
    storage_url TEXT,
    image_type VARCHAR(50),
    description TEXT,
    is_primary BOOLEAN,
    file_size INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ui.id,
        ui.storage_url,
        mi.image_type,
        mi.description,
        mi.is_primary,
        ui.file_size,
        ui.created_at
    FROM uploaded_images ui
    INNER JOIN medication_images mi ON ui.id = mi.image_id
    WHERE mi.medication_id = p_medication_id
      AND ui.is_deleted = FALSE
    ORDER BY mi.is_primary DESC, mi.display_order, ui.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 取得心情日記的所有圖片
CREATE OR REPLACE FUNCTION get_diary_images(p_diary_id UUID)
RETURNS TABLE(
    image_id UUID,
    storage_url TEXT,
    caption TEXT,
    display_order INTEGER,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ui.id,
        ui.storage_url,
        mdi.caption,
        mdi.display_order,
        ui.width,
        ui.height,
        ui.created_at
    FROM uploaded_images ui
    INNER JOIN mood_diary_images mdi ON ui.id = mdi.image_id
    WHERE mdi.diary_id = p_diary_id
      AND ui.is_deleted = FALSE
    ORDER BY mdi.display_order, ui.created_at;
END;
$$ LANGUAGE plpgsql;

-- 計算使用者已使用的儲存空間
CREATE OR REPLACE FUNCTION get_user_storage_usage(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
    total_size BIGINT;
BEGIN
    SELECT COALESCE(SUM(file_size), 0)
    INTO total_size
    FROM uploaded_images
    WHERE uploader_id = p_user_id
      AND is_deleted = FALSE;

    RETURN total_size;
END;
$$ LANGUAGE plpgsql;

-- 軟刪除圖片
CREATE OR REPLACE FUNCTION soft_delete_image(p_image_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE uploaded_images
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = p_image_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 觸發器：自動更新 updated_at
-- ================================================

CREATE TRIGGER update_uploaded_images_updated_at
    BEFORE UPDATE ON uploaded_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mood_diaries_updated_at
    BEFORE UPDATE ON mood_diaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- Storage Bucket 設定（在 Supabase Dashboard 執行）
-- ================================================

/*
1. 創建 Storage Bucket:
   - 名稱: eldercare-images
   - Public: true (公開存取)
   - File size limit: 5MB
   - Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp

2. 設定 Storage 政策:
   - 允許認證使用者上傳
   - 允許所有人讀取（公開圖片）
   - 允許上傳者刪除自己的圖片

3. Bucket 結構:
   eldercare-images/
   ├── medications/
   │   └── {elder_id}/
   │       └── {medication_id}/
   │           └── {timestamp}_{filename}
   ├── mood_diaries/
   │   └── {elder_id}/
   │       └── {diary_id}/
   │           └── {timestamp}_{filename}
   ├── profiles/
   │   └── {user_id}/
   │       └── avatar_{timestamp}.{ext}
   └── thumbnails/
       └── {image_id}_thumb.{ext}
*/

-- ================================================
-- 範例資料（開發測試用）
-- ================================================

-- 注意：實際部署時請移除此段
/*
-- 假設已有長輩 ID
INSERT INTO mood_diaries (elder_id, title, content, mood_level, mood_emoji, tags)
VALUES
    ('elder-uuid-here', '今天很開心', '和朋友們去公園散步，天氣很好！', 5, '😊', ARRAY['開心', '散步', '朋友']),
    ('elder-uuid-here', '下雨天', '整天都在下雨，有點悶悶的', 3, '😐', ARRAY['下雨', '在家']);
*/

-- ================================================
-- 維護與清理
-- ================================================

-- 清理已刪除圖片（實際刪除 Storage 檔案需要額外處理）
CREATE OR REPLACE FUNCTION cleanup_deleted_images(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 刪除超過指定天數的軟刪除圖片記錄
    DELETE FROM uploaded_images
    WHERE is_deleted = TRUE
      AND updated_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 找出孤立的圖片（沒有被任何記錄引用）
CREATE OR REPLACE FUNCTION find_orphaned_images()
RETURNS TABLE(
    image_id UUID,
    storage_path TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ui.id,
        ui.storage_path,
        ui.file_size,
        ui.created_at
    FROM uploaded_images ui
    WHERE ui.is_deleted = FALSE
      AND ui.id NOT IN (
          SELECT image_id FROM medication_images
          UNION
          SELECT image_id FROM mood_diary_images
      )
      AND ui.created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
