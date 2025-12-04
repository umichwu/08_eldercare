-- ============================================================================
-- 心靈照護功能 - 資料庫 Migration
-- ============================================================================
-- 建立日期：2025-12-05
-- 版本: 1.0
-- 用途：新增心靈照護相關資料表和欄位
--   - emotional_journals（心情日記）
--   - spiritual_contents（心靈語料庫，支援向量檢索）
--   - spiritual_care_tasks（照護任務）
--   - spiritual_weekly_reports（週報）
-- ============================================================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 關閉 RLS（避免刪除時權限問題）
ALTER TABLE IF EXISTS public.spiritual_weekly_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spiritual_care_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spiritual_contents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emotional_journals DISABLE ROW LEVEL SECURITY;

-- 刪除觸發器
DROP TRIGGER IF EXISTS update_emotional_journals_updated_at ON public.emotional_journals;
DROP TRIGGER IF EXISTS update_spiritual_contents_updated_at ON public.spiritual_contents;
DROP TRIGGER IF EXISTS update_spiritual_care_tasks_updated_at ON public.spiritual_care_tasks;

-- 刪除函數
DROP FUNCTION IF EXISTS public.match_spiritual_contents(vector, float, int, text, text) CASCADE;

-- 刪除表格（依相依性順序）
DROP TABLE IF EXISTS public.spiritual_weekly_reports CASCADE;
DROP TABLE IF EXISTS public.spiritual_care_tasks CASCADE;
DROP TABLE IF EXISTS public.spiritual_contents CASCADE;
DROP TABLE IF EXISTS public.emotional_journals CASCADE;

-- ============================================================================
-- STEP 2: 啟用擴展功能
-- ============================================================================

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 啟用向量擴展（用於心靈內容的語意檢索）
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- STEP 3: 擴充 user_profiles 表，新增心靈照護相關欄位
-- ============================================================================

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS spiritual_preference TEXT,  -- 宗教信仰 (buddhism, christianity, taoism, confucianism, secular, etc.)
ADD COLUMN IF NOT EXISTS spiritual_details JSONB DEFAULT '{}',  -- 心靈實踐偏好（JSON 格式）
ADD COLUMN IF NOT EXISTS mindfulness_enabled BOOLEAN DEFAULT true,  -- 是否啟用心靈陪伴功能
ADD COLUMN IF NOT EXISTS emotional_privacy_level TEXT DEFAULT 'family_visible';  -- 隱私等級 (private, family_visible, public)

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_user_profiles_spiritual_preference
ON user_profiles(spiritual_preference);

-- ============================================================================
-- STEP 4: 建立心情日記表 (emotional_journals)
-- ============================================================================
CREATE TABLE emotional_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_profile_id UUID NOT NULL,  -- 關聯到 user_profiles
    auth_user_id TEXT NOT NULL,     -- Supabase Auth User ID（冗餘，加速查詢）
    journal_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- 日記日期

    -- 心情評分與標籤
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),  -- 心情評分 1-10
    mood_tags TEXT[] DEFAULT '{}',  -- 心情標籤陣列 ['peaceful', 'grateful', 'worried']

    -- 感恩與擔憂
    gratitude_items TEXT[] DEFAULT '{}',  -- 感恩的事項（最多3項）
    concerns TEXT[] DEFAULT '{}',  -- 擔憂的事項

    -- 日記內容
    daily_summary TEXT,  -- 今日摘要（使用者自己寫的）
    ai_insights TEXT,  -- AI 提供的洞察
    spiritual_guidance TEXT,  -- AI 提供的心靈引導（根據宗教信仰）

    -- 情緒分析結果（JSON 格式）
    emotion_analysis JSONB DEFAULT '{}',  -- {primary_emotion, intensity, triggers[]}

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 唯一約束：每個使用者每天只能有一則日記
    CONSTRAINT unique_journal_per_day UNIQUE (auth_user_id, journal_date),

    -- 外鍵約束
    CONSTRAINT fk_user_profile FOREIGN KEY (user_profile_id)
        REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_emotional_journals_auth_user_id
ON emotional_journals(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_emotional_journals_journal_date
ON emotional_journals(journal_date DESC);

CREATE INDEX IF NOT EXISTS idx_emotional_journals_user_date
ON emotional_journals(auth_user_id, journal_date DESC);

-- ============================================================================
-- STEP 5: 建立心靈語料庫表 (spiritual_contents)
-- ============================================================================
CREATE TABLE spiritual_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 內容分類
    religion TEXT NOT NULL,  -- buddhism, christianity, taoism, confucianism, secular
    category TEXT NOT NULL,  -- anxiety, grief, gratitude, loneliness, peace, general
    content_type TEXT NOT NULL,  -- scripture（經文）, prayer（禱詞）, story（故事）, quote（語錄）

    -- 內容本體
    title TEXT NOT NULL,  -- 標題（例如：《金剛經》第32品）
    content TEXT NOT NULL,  -- 原文內容
    translation TEXT,  -- 白話翻譯
    source TEXT,  -- 出處（例如：《金剛經》）

    -- 向量嵌入（用於語意檢索）
    content_embedding vector(1536),  -- OpenAI text-embedding-3-small 的維度

    -- 使用統計
    usage_count INTEGER DEFAULT 0,  -- 被使用的次數
    effectiveness_score FLOAT DEFAULT 0.5,  -- 有效性評分（根據使用者回饋）

    -- 內容屬性
    difficulty_level TEXT DEFAULT 'moderate',  -- easy, moderate, deep
    tags TEXT[] DEFAULT '{}',  -- 標籤陣列

    -- 內容審核
    verified BOOLEAN DEFAULT false,  -- 是否經過審核
    verified_by TEXT,  -- 審核者
    verified_at TIMESTAMP WITH TIME ZONE,

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_spiritual_contents_religion
ON spiritual_contents(religion);

CREATE INDEX IF NOT EXISTS idx_spiritual_contents_category
ON spiritual_contents(category);

CREATE INDEX IF NOT EXISTS idx_spiritual_contents_verified
ON spiritual_contents(verified);

-- 向量相似度檢索索引（HNSW 算法，效能最佳）
CREATE INDEX IF NOT EXISTS idx_spiritual_contents_embedding
ON spiritual_contents USING hnsw (content_embedding vector_cosine_ops);

-- ============================================================================
-- STEP 6: 建立心靈照護任務表 (spiritual_care_tasks)
-- ============================================================================
CREATE TABLE spiritual_care_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_profile_id UUID NOT NULL,  -- 關聯到 user_profiles

    -- 任務資訊
    task_type TEXT NOT NULL,  -- prayer_request, counseling_referral, volunteer_visit, emergency_contact
    priority TEXT DEFAULT 'normal',  -- low, normal, high, urgent
    status TEXT DEFAULT 'pending',  -- pending, in_progress, completed, cancelled

    -- 任務內容
    title TEXT NOT NULL,
    description TEXT,

    -- 指派對象
    assigned_to TEXT DEFAULT 'ai',  -- ai, temple, church, counselor, volunteer, family
    assigned_contact JSONB DEFAULT '{}',  -- 聯絡資訊（JSON 格式）

    -- 觸發原因
    triggered_by TEXT,  -- ai_detection, user_request, family_request, scheduled
    trigger_context JSONB DEFAULT '{}',  -- 觸發情境（JSON 格式）

    -- 時間管理
    scheduled_at TIMESTAMP WITH TIME ZONE,  -- 預定執行時間
    completed_at TIMESTAMP WITH TIME ZONE,  -- 完成時間

    -- 執行結果
    outcome TEXT,  -- 執行結果描述
    feedback JSONB DEFAULT '{}',  -- 使用者回饋（JSON 格式）

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 外鍵約束
    CONSTRAINT fk_user_profile_task FOREIGN KEY (user_profile_id)
        REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_spiritual_care_tasks_user_profile_id
ON spiritual_care_tasks(user_profile_id);

CREATE INDEX IF NOT EXISTS idx_spiritual_care_tasks_status
ON spiritual_care_tasks(status);

CREATE INDEX IF NOT EXISTS idx_spiritual_care_tasks_scheduled_at
ON spiritual_care_tasks(scheduled_at);

-- ============================================================================
-- STEP 7: 建立心靈照護週報表 (spiritual_weekly_reports)
-- ============================================================================
CREATE TABLE spiritual_weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_profile_id UUID NOT NULL,  -- 關聯到 user_profiles
    auth_user_id TEXT NOT NULL,     -- Supabase Auth User ID

    -- 報告時間範圍
    week_start_date DATE NOT NULL,  -- 週報開始日期（週一）
    week_end_date DATE NOT NULL,    -- 週報結束日期（週日）

    -- 心情統計
    avg_mood_score FLOAT,  -- 平均心情評分
    mood_trend TEXT,  -- improving, stable, declining
    top_emotions TEXT[],  -- 最常出現的情緒標籤（前3名）

    -- 內容統計
    journal_count INTEGER DEFAULT 0,  -- 本週寫了幾則日記
    spiritual_content_usage INTEGER DEFAULT 0,  -- 使用心靈內容的次數

    -- AI 生成的報告內容
    elder_report TEXT,  -- 給長者看的報告（詳細版）
    family_report TEXT,  -- 給家屬看的報告（隱私過濾版）

    -- 建議與洞察
    ai_insights TEXT,  -- AI 的觀察與建議
    suggested_actions JSONB DEFAULT '[]',  -- 建議行動（JSON 陣列）

    -- 報告狀態
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- 報告生成時間
    sent_to_family BOOLEAN DEFAULT false,  -- 是否已發送給家屬
    sent_at TIMESTAMP WITH TIME ZONE,  -- 發送時間

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 唯一約束：每個使用者每週只能有一則報告
    CONSTRAINT unique_report_per_week UNIQUE (auth_user_id, week_start_date),

    -- 外鍵約束
    CONSTRAINT fk_user_profile_report FOREIGN KEY (user_profile_id)
        REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_spiritual_weekly_reports_auth_user_id
ON spiritual_weekly_reports(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_spiritual_weekly_reports_week_start
ON spiritual_weekly_reports(week_start_date DESC);

-- ============================================================================
-- STEP 8: 初始化心靈語料庫（示例資料）
-- ============================================================================
-- 注意：實際部署時應該有更完整的語料庫
-- 向量嵌入（content_embedding）稍後需要透過腳本生成

-- 佛教 - 焦慮/擔憂類
INSERT INTO spiritual_contents (religion, category, content_type, title, content, translation, source, verified, difficulty_level)
VALUES
('buddhism', 'anxiety', 'scripture', '《金剛經》- 如夢幻泡影',
 '一切有為法，如夢幻泡影，如露亦如電，應作如是觀。',
 '世間一切現象都像夢境、幻影、水泡、露珠、閃電一樣短暫無常，我們應該用這樣的智慧來看待生活中的一切。',
 '《金剛經》第32品', true, 'moderate'),

('buddhism', 'anxiety', 'scripture', '《心經》- 照見五蘊皆空',
 '觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。',
 '當我們以智慧觀照自己，就能看清楚身心世界的本質是空性的，這樣就能度過一切苦難。',
 '《般若波羅蜜多心經》', true, 'moderate'),

-- 佛教 - 感恩類
('buddhism', 'gratitude', 'scripture', '感恩當下',
 '一花一世界，一葉一如來。',
 '每一朵花都蘊含整個宇宙的智慧，每一片葉子都展現佛性的光輝。我們要學會感恩身邊的一切。',
 '佛教禪語', true, 'easy'),

-- 佛教 - 平靜類
('buddhism', 'peace', 'scripture', '靜心觀照',
 '心靜則一切皆靜，心亂則一切皆亂。',
 '內心平靜的時候，看什麼都是美好的；內心煩亂的時候，看什麼都不順眼。所以修心最重要。',
 '佛教禪語', true, 'easy'),

-- 基督教 - 焦慮類
('christianity', 'anxiety', 'scripture', '詩篇23篇 - 耶和華是我的牧者',
 '耶和華是我的牧者，我必不至缺乏。他使我躺臥在青草地上，領我在可安歇的水邊。',
 '上帝像牧羊人一樣照顧我們，祂會供應我們所需的一切，讓我們的心靈得到安息。',
 '《詩篇》23:1-2', true, 'easy'),

('christianity', 'anxiety', 'scripture', '腓立比書 - 不要憂慮',
 '應當一無掛慮，只要凡事藉著禱告、祈求和感謝，將你們所要的告訴神。',
 '不要為任何事擔憂，遇到事情就透過禱告向上帝祈求，並且懷著感恩的心，上帝會賜下平安。',
 '《腓立比書》4:6', true, 'easy'),

-- 基督教 - 感恩類
('christianity', 'gratitude', 'scripture', '凡事謝恩',
 '凡事謝恩，因為這是神在基督耶穌裡向你們所定的旨意。',
 '無論發生什麼事，都要懷著感恩的心，因為這是上帝的心意。',
 '《帖撒羅尼迦前書》5:18', true, 'easy'),

-- 道教 - 平靜類
('taoism', 'peace', 'scripture', '《道德經》- 清靜無為',
 '致虛極，守靜篤。萬物並作，吾以觀復。',
 '讓心靈達到最虛空寧靜的境界，守住這份篤定。萬物不停運作變化，我們只需要靜靜觀察它們循環往復的規律。',
 '《道德經》第16章', true, 'moderate'),

('taoism', 'anxiety', 'scripture', '順其自然',
 '上善若水，水善利萬物而不爭。',
 '最高的善就像水一樣，水滋養萬物卻不與萬物爭奪。我們應該學習水的智慧，順其自然，不強求。',
 '《道德經》第8章', true, 'easy'),

-- 儒家 - 感恩類
('confucianism', 'gratitude', 'quote', '孝道與感恩',
 '父母在，不遠遊，遊必有方。',
 '父母健在的時候，不要到太遠的地方去；如果一定要遠遊，也要告訴父母去哪裡。這是孝道的實踐。',
 '《論語》', true, 'easy'),

-- 通用/無宗教 - 焦慮類
('secular', 'anxiety', 'quote', '接納當下',
 '接納你無法改變的，改變你能夠改變的，並且擁有智慧去分辨兩者的差別。',
 '有些事情我們無法改變，那就學著接納它；有些事情我們可以改變，那就努力去做。重要的是分辨什麼可以改變、什麼不能改變。',
 '寧靜禱文（改編）', true, 'easy'),

('secular', 'anxiety', 'quote', '專注呼吸',
 '當你感到焦慮時，專注在你的呼吸上。深深吸氣，慢慢吐氣，讓心跟著呼吸的節奏平靜下來。',
 '正念練習的核心就是回到呼吸，回到當下。呼吸永遠與我們同在，是最好的心靈錨點。',
 '正念減壓', true, 'easy'),

-- 通用 - 感恩類
('secular', 'gratitude', 'quote', '感恩練習',
 '每天睡前想三件值得感恩的事，再小的事也好。這個習慣會改變你看世界的方式。',
 '感恩不是因為生活完美，而是因為我們選擇看到美好的部分。',
 '正向心理學', true, 'easy'),

-- 通用 - 平靜類
('secular', 'peace', 'quote', '此時此刻',
 '過去已經過去，未來還未到來。我們真正擁有的，只有此時此刻。',
 '不要沉溺於過去，也不要過度擔心未來。活在當下，才能真正感受生命的美好。',
 '正念哲學', true, 'easy');

-- ============================================================================
-- STEP 9: 建立向量檢索函數
-- ============================================================================
-- 此函數用於根據查詢向量檢索最相關的心靈內容
-- 使用餘弦相似度進行向量比對

CREATE OR REPLACE FUNCTION match_spiritual_contents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3,
  filter_religion text DEFAULT NULL,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  title text,
  translation text,
  source text,
  religion text,
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    spiritual_contents.id,
    spiritual_contents.content,
    spiritual_contents.title,
    spiritual_contents.translation,
    spiritual_contents.source,
    spiritual_contents.religion,
    spiritual_contents.category,
    1 - (spiritual_contents.content_embedding <=> query_embedding) as similarity
  FROM spiritual_contents
  WHERE
    spiritual_contents.verified = true
    AND (filter_religion IS NULL OR spiritual_contents.religion = filter_religion)
    AND (filter_category IS NULL OR spiritual_contents.category = filter_category)
    AND 1 - (spiritual_contents.content_embedding <=> query_embedding) > match_threshold
  ORDER BY spiritual_contents.content_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- STEP 10: 建立更新時間戳記觸發器
-- ============================================================================

-- 更新時間戳記函數（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為 emotional_journals 建立觸發器
CREATE TRIGGER update_emotional_journals_updated_at
    BEFORE UPDATE ON emotional_journals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 為 spiritual_contents 建立觸發器
CREATE TRIGGER update_spiritual_contents_updated_at
    BEFORE UPDATE ON spiritual_contents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 為 spiritual_care_tasks 建立觸發器
CREATE TRIGGER update_spiritual_care_tasks_updated_at
    BEFORE UPDATE ON spiritual_care_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 11: 建立資料表註解
-- ============================================================================

COMMENT ON TABLE emotional_journals IS '心情日記表 - 記錄長者每日的心情、感恩事項和擔憂';
COMMENT ON TABLE spiritual_contents IS '心靈語料庫 - 儲存經文、禱詞、故事等心靈內容，支援向量檢索';
COMMENT ON TABLE spiritual_care_tasks IS '心靈照護任務表 - AI 偵測到需求時派送的照護任務';
COMMENT ON TABLE spiritual_weekly_reports IS '心靈照護週報表 - 每週自動生成給長者和家屬的心靈狀態報告';

-- ============================================================================
-- Migration 完成！
-- ============================================================================
--
-- ✅ 已完成項目：
--   1. 清理舊資料（表格、函數、觸發器）
--   2. 啟用必要的擴展（uuid-ossp, vector）
--   3. 擴充 user_profiles 表（新增心靈照護欄位）
--   4. 建立 4 個新資料表
--   5. 初始化心靈語料庫（15+ 條示例資料）
--   6. 建立向量檢索函數
--   7. 建立更新時間戳記觸發器
--   8. 建立資料表註解
--
-- ⏳ 後續步驟：
--   1. 執行 scripts/generate-spiritual-embeddings.js 生成向量嵌入
--   2. 測試 API 端點
--   3. 測試向量檢索功能
--
-- 📝 測試範例：
--   SELECT * FROM spiritual_contents WHERE verified = true LIMIT 5;
--   SELECT * FROM emotional_journals WHERE auth_user_id = 'your-user-id';
--
-- ============================================================================
