-- ============================================================================
-- ElderCare Companion - 心靈照護模組 (Spiritual Care Module)
-- ============================================================================
-- 版本: 1.0
-- 日期: 2025-01-XX
-- 功能: 心靈偏好設定、心情日記、情緒分析、Agentic RAG 支援
-- ============================================================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 關閉 RLS（避免刪除時權限問題）
ALTER TABLE IF EXISTS public.spiritual_weekly_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spiritual_care_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spiritual_contents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emotional_journals DISABLE ROW LEVEL SECURITY;

-- 刪除視圖
DROP VIEW IF EXISTS public.emotional_trends CASCADE;

-- 刪除表格（依相依性順序）
DROP TABLE IF EXISTS public.spiritual_weekly_reports CASCADE;
DROP TABLE IF EXISTS public.spiritual_care_tasks CASCADE;
DROP TABLE IF EXISTS public.spiritual_contents CASCADE;
DROP TABLE IF EXISTS public.emotional_journals CASCADE;

-- ============================================================================
-- STEP 2: 擴充現有表格 - user_profiles
-- ============================================================================

-- 新增心靈照護相關欄位到 user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS spiritual_preference VARCHAR(50),  -- buddhism, christianity, catholicism, taoism, folk, none
ADD COLUMN IF NOT EXISTS spiritual_details JSONB,  -- {practices: [...], preferences: {...}}
ADD COLUMN IF NOT EXISTS mindfulness_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_level VARCHAR(20) DEFAULT 'private' CHECK (privacy_level IN ('private', 'family_visible', 'full_share'));

-- 註解
COMMENT ON COLUMN public.user_profiles.spiritual_preference IS '宗教信仰偏好';
COMMENT ON COLUMN public.user_profiles.spiritual_details IS '心靈實踐詳細資訊（JSON格式）';
COMMENT ON COLUMN public.user_profiles.mindfulness_enabled IS '是否啟用心靈陪伴功能';
COMMENT ON COLUMN public.user_profiles.privacy_level IS '心靈資料隱私等級';

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_spiritual_preference ON public.user_profiles(spiritual_preference);
CREATE INDEX IF NOT EXISTS idx_user_profiles_mindfulness_enabled ON public.user_profiles(mindfulness_enabled);

-- ============================================================================
-- STEP 3: 心情日記表 (Emotional Journals)
-- ============================================================================

CREATE TABLE public.emotional_journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 日記資訊
    journal_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- 心情資料
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    mood_tags TEXT[],  -- ['peaceful', 'grateful', 'anxious', ...]
    gratitude_items TEXT[],  -- 感恩清單
    concerns TEXT[],  -- 擔憂事項
    daily_summary TEXT,  -- 每日摘要

    -- AI 生成內容
    ai_insights TEXT,  -- AI 洞察
    spiritual_guidance TEXT,  -- 心靈指引

    -- 情緒分析結果
    emotion_analysis JSONB,  -- {primary_emotion: 'anxiety', intensity: 0.75, ...}

    -- 統計
    conversation_count INTEGER DEFAULT 0,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 唯一性約束：每個使用者每天只能有一篇日記
    UNIQUE(user_profile_id, journal_date)
);

-- 索引
CREATE INDEX idx_emotional_journals_user_profile_id ON public.emotional_journals(user_profile_id);
CREATE INDEX idx_emotional_journals_journal_date ON public.emotional_journals(journal_date);
CREATE INDEX idx_emotional_journals_mood_score ON public.emotional_journals(mood_score);
CREATE INDEX idx_emotional_journals_created_at ON public.emotional_journals(created_at DESC);

-- RLS
ALTER TABLE public.emotional_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journals"
    ON public.emotional_journals FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own journals"
    ON public.emotional_journals FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own journals"
    ON public.emotional_journals FOR UPDATE
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can delete own journals"
    ON public.emotional_journals FOR DELETE
    USING (auth.uid() = auth_user_id);

-- 註解
COMMENT ON TABLE public.emotional_journals IS '心情日記表 - 記錄每日心情、感恩與省思';

-- ============================================================================
-- STEP 4: 心靈內容語料庫 (Spiritual Contents)
-- ============================================================================

CREATE TABLE public.spiritual_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 分類
    religion VARCHAR(50) NOT NULL,  -- buddhism, christianity, catholicism, taoism, folk
    category VARCHAR(50) NOT NULL,  -- scripture, prayer, story, meditation, music
    emotion VARCHAR(50),  -- anxiety, grief, gratitude, loneliness, peace, neutral

    -- 內容
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(255),  -- 出處
    translation TEXT,  -- 白話翻譯

    -- 多媒體
    audio_url TEXT,
    video_url TEXT,
    image_url TEXT,

    -- 標籤與關鍵字
    tags TEXT[],
    keywords TEXT[],

    -- 向量搜尋（未來擴充）
    -- embedding vector(1536),  -- OpenAI embeddings

    -- 使用統計
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,  -- 0.00 ~ 5.00

    -- 審核狀態
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES public.user_profiles(id),
    verified_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_spiritual_contents_religion ON public.spiritual_contents(religion);
CREATE INDEX idx_spiritual_contents_category ON public.spiritual_contents(category);
CREATE INDEX idx_spiritual_contents_emotion ON public.spiritual_contents(emotion);
CREATE INDEX idx_spiritual_contents_verified ON public.spiritual_contents(verified);
CREATE INDEX idx_spiritual_contents_tags ON public.spiritual_contents USING GIN(tags);
CREATE INDEX idx_spiritual_contents_keywords ON public.spiritual_contents USING GIN(keywords);

-- RLS（心靈內容公開給所有使用者閱讀，但只有管理員可以編輯）
ALTER TABLE public.spiritual_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified spiritual contents"
    ON public.spiritual_contents FOR SELECT
    USING (verified = true);

-- 註解
COMMENT ON TABLE public.spiritual_contents IS '心靈內容語料庫 - 經文、禱詞、故事、靜心引導';

-- ============================================================================
-- STEP 5: 心靈照護任務表 (Spiritual Care Tasks)
-- ============================================================================

CREATE TABLE public.spiritual_care_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 任務資訊
    task_type VARCHAR(50) NOT NULL,  -- temple_visit, counseling, group_meditation, prayer_service
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled')),

    -- 任務詳情
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location TEXT,
    contact_info JSONB,  -- {phone: '...', email: '...', address: '...'}

    -- 排程
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- 觸發原因
    triggered_by_emotion VARCHAR(50),  -- 觸發此任務的情緒
    related_journal_id UUID REFERENCES public.emotional_journals(id),

    -- 外部服務資訊
    external_service_id TEXT,  -- 外部 API 服務 ID
    external_service_type VARCHAR(50),  -- temple, church, counselor

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_spiritual_tasks_user_profile_id ON public.spiritual_care_tasks(user_profile_id);
CREATE INDEX idx_spiritual_tasks_status ON public.spiritual_care_tasks(status);
CREATE INDEX idx_spiritual_tasks_scheduled ON public.spiritual_care_tasks(scheduled_at) WHERE status = 'pending';

-- RLS
ALTER TABLE public.spiritual_care_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spiritual tasks"
    ON public.spiritual_care_tasks FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own spiritual tasks"
    ON public.spiritual_care_tasks FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own spiritual tasks"
    ON public.spiritual_care_tasks FOR UPDATE
    USING (auth.uid() = auth_user_id);

-- 註解
COMMENT ON TABLE public.spiritual_care_tasks IS '心靈照護任務派送與追蹤';

-- ============================================================================
-- STEP 6: 情緒趨勢分析視圖 (Emotional Trends View)
-- ============================================================================

CREATE OR REPLACE VIEW public.emotional_trends AS
SELECT
    user_profile_id,
    week_start,
    avg_mood,
    journal_count,
    (
        SELECT tag
        FROM (
            SELECT unnest(mood_tags) as tag
            FROM public.emotional_journals ej2
            WHERE ej2.user_profile_id = base.user_profile_id
              AND DATE_TRUNC('week', ej2.journal_date) = base.week_start
        ) tags
        GROUP BY tag
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ) as dominant_mood,
    had_low_mood,
    (
        SELECT ARRAY_AGG(DISTINCT concern)
        FROM (
            SELECT unnest(concerns) as concern
            FROM public.emotional_journals ej3
            WHERE ej3.user_profile_id = base.user_profile_id
              AND DATE_TRUNC('week', ej3.journal_date) = base.week_start
        ) all_concerns_unnested
    ) as all_concerns
FROM (
    SELECT
        user_profile_id,
        DATE_TRUNC('week', journal_date) as week_start,
        AVG(mood_score) as avg_mood,
        COUNT(*) as journal_count,
        BOOL_OR(mood_score <= 4) as had_low_mood
    FROM public.emotional_journals
    GROUP BY user_profile_id, DATE_TRUNC('week', journal_date)
) base;

COMMENT ON VIEW public.emotional_trends IS '每週情緒趨勢分析（供家屬 Dashboard 使用）';

-- ============================================================================
-- STEP 7: 擴充 messages 表 - AI 對話情緒標註
-- ============================================================================

-- 新增欄位到 messages 表
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS emotion_detected JSONB,  -- {emotion: 'anxious', confidence: 0.85, keywords: [...]}
ADD COLUMN IF NOT EXISTS spiritual_content_used UUID REFERENCES public.spiritual_contents(id),  -- 使用的心靈內容
ADD COLUMN IF NOT EXISTS mindfulness_trigger BOOLEAN DEFAULT false;  -- 是否觸發心靈引導

-- 註解
COMMENT ON COLUMN public.messages.emotion_detected IS 'AI 偵測到的情緒（JSON格式）';
COMMENT ON COLUMN public.messages.spiritual_content_used IS '該訊息使用的心靈語料ID';
COMMENT ON COLUMN public.messages.mindfulness_trigger IS '是否觸發了心靈陪伴流程';

-- 索引
CREATE INDEX IF NOT EXISTS idx_messages_mindfulness_trigger ON public.messages(mindfulness_trigger) WHERE mindfulness_trigger = true;
CREATE INDEX IF NOT EXISTS idx_messages_spiritual_content ON public.messages(spiritual_content_used) WHERE spiritual_content_used IS NOT NULL;

-- ============================================================================
-- STEP 8: 心靈照護週報表 (Spiritual Weekly Reports)
-- ============================================================================

CREATE TABLE public.spiritual_weekly_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 週期
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,

    -- 心情統計
    avg_mood_score DECIMAL(3,2),
    mood_variance DECIMAL(5,2),  -- 心情波動度
    dominant_emotion VARCHAR(50),

    -- 心靈活動統計
    journal_count INTEGER DEFAULT 0,
    gratitude_count INTEGER DEFAULT 0,
    spiritual_content_views INTEGER DEFAULT 0,

    -- AI 生成摘要
    weekly_summary TEXT,
    recommendations TEXT,

    -- 警示
    needs_attention BOOLEAN DEFAULT false,
    attention_reason TEXT,

    -- 分享設定（依照隱私等級）
    shared_with_family BOOLEAN DEFAULT false,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 唯一性約束
    UNIQUE(user_profile_id, week_start_date)
);

-- 索引
CREATE INDEX idx_spiritual_reports_user_profile_id ON public.spiritual_weekly_reports(user_profile_id);
CREATE INDEX idx_spiritual_reports_week_start ON public.spiritual_weekly_reports(week_start_date DESC);
CREATE INDEX idx_spiritual_reports_needs_attention ON public.spiritual_weekly_reports(needs_attention) WHERE needs_attention = true;

-- RLS
ALTER TABLE public.spiritual_weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly reports"
    ON public.spiritual_weekly_reports FOR SELECT
    USING (auth.uid() = auth_user_id);

-- 註解
COMMENT ON TABLE public.spiritual_weekly_reports IS '心靈照護週報 - AI 生成的每週心靈健康摘要';

-- ============================================================================
-- STEP 9: 初始化心靈內容語料（種子資料）
-- ============================================================================

-- 佛教經文
INSERT INTO public.spiritual_contents (religion, category, emotion, title, content, source, translation, tags, keywords, verified) VALUES
('buddhism', 'scripture', 'anxiety', '金剛經 - 如夢幻泡影', '一切有為法，如夢幻泡影，如露亦如電，應作如是觀。', '金剛經', '所有因緣和合而生的現象，都像夢境、幻影、露水、閃電一樣短暫無常，應該以這樣的智慧來看待。', ARRAY['無常', '放下', '智慧'], ARRAY['夢幻', '泡影', '無常', '焦慮', '煩惱'], true),
('buddhism', 'scripture', 'grief', '心經 - 照見五蘊皆空', '觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。', '般若波羅蜜多心經', '觀世音菩薩在深入修行智慧時，看清了身心的本質都是空的，因此能超越一切苦難。', ARRAY['空性', '超越苦難', '智慧'], ARRAY['五蘊', '空', '苦厄', '悲傷', '失落'], true),
('buddhism', 'scripture', 'peace', '阿彌陀經 - 極樂淨土', '彼佛國土，無有眾苦，但受諸樂，故名極樂。', '佛說阿彌陀經', '那個佛國淨土，沒有任何痛苦，只有各種快樂，所以稱為極樂世界。', ARRAY['淨土', '平靜', '希望'], ARRAY['極樂', '淨土', '無苦', '平靜', '安詳'], true),
('buddhism', 'scripture', 'gratitude', '法句經 - 知足常樂', '知足之人，雖臥地上，猶為安樂；不知足者，雖處天堂，亦不稱意。', '法句經', '懂得知足的人，即使睡在地上也感到快樂；不知足的人，即使在天堂也不會滿意。', ARRAY['知足', '感恩', '快樂'], ARRAY['知足', '感恩', '滿足', '快樂'], true),
('buddhism', 'scripture', 'loneliness', '華嚴經 - 心佛眾生三無差別', '若人欲了知，三世一切佛，應觀法界性，一切唯心造。', '華嚴經', '如果想要了解過去現在未來一切諸佛，應該觀察法界的本性，一切都是由心所創造。', ARRAY['心性', '連結', '本性'], ARRAY['唯心', '法界', '佛性', '孤獨', '連結'], true),

-- 基督教聖經
('christianity', 'scripture', 'anxiety', '腓立比書 4:6-7', '應當一無掛慮，只要凡事藉著禱告、祈求和感謝，將你們所要的告訴神。神所賜出人意外的平安，必在基督耶穌裡，保守你們的心懷意念。', '腓立比書 4:6-7', '不要為任何事憂慮，而是在每件事上通過禱告和感恩向神祈求。神所賜的平安會保護你的心思意念。', ARRAY['禱告', '平安', '信靠'], ARRAY['掛慮', '禱告', '平安', '焦慮'], true),
('christianity', 'scripture', 'grief', '詩篇 23:4', '我雖然行過死蔭的幽谷，也不怕遭害，因為你與我同在；你的杖，你的竿，都安慰我。', '詩篇 23:4', '即使走過最黑暗的低谷，我也不害怕，因為神與我同在，祂的引導安慰著我。', ARRAY['同在', '安慰', '保護'], ARRAY['死蔭', '幽谷', '安慰', '悲傷', '同在'], true),
('christianity', 'scripture', 'peace', '約翰福音 14:27', '我留下平安給你們；我將我的平安賜給你們。我所賜的，不像世人所賜的。你們心裡不要憂愁，也不要膽怯。', '約翰福音 14:27', '耶穌留下真正的平安給我們，這平安不像世界所給的，能真正安定我們的心。', ARRAY['平安', '信心', '安穩'], ARRAY['平安', '憂愁', '膽怯', '平靜'], true),
('christianity', 'scripture', 'gratitude', '帖撒羅尼迦前書 5:18', '凡事謝恩，因為這是神在基督耶穌裡向你們所定的旨意。', '帖撒羅尼迦前書 5:18', '在任何情況下都要感謝神，這是神對我們的心意。', ARRAY['感恩', '喜樂', '信靠'], ARRAY['謝恩', '感恩', '凡事', '感謝'], true),
('christianity', 'scripture', 'loneliness', '希伯來書 13:5', '因為主曾說：我總不撇下你，也不丟棄你。', '希伯來書 13:5', '神應許永遠不會離開我們，也不會拋棄我們。', ARRAY['同在', '應許', '信實'], ARRAY['不撇下', '不丟棄', '同在', '孤獨'], true),

-- 天主教經文
('catholicism', 'prayer', 'anxiety', '聖母經', '萬福瑪利亞，妳充滿聖寵，主與妳同在，妳在婦女中受讚頌，妳的親子耶穌同受讚頌。天主聖母瑪利亞，求妳現在和我們臨終時，為我們罪人祈求天主。阿們。', '聖母經', '向聖母瑪利亞祈禱，求她為我們代禱，在我們需要時陪伴我們。', ARRAY['祈禱', '代禱', '保護'], ARRAY['聖母', '祈禱', '保護', '焦慮'], true),
('catholicism', 'prayer', 'peace', '聖方濟各禱文', '主啊，使我作你和平之子，在憎恨之處播下你的愛，在傷痕之處播下你寬恕。', '聖方濟各禱文', '祈求成為傳播和平、愛與寬恕的人。', ARRAY['和平', '愛', '寬恕'], ARRAY['和平', '愛', '寬恕', '平靜'], true),
('catholicism', 'scripture', 'gratitude', '聖詠 100:4', '興高彩烈地進入祂的大門，歡欣鼓舞地邁進祂的殿庭，向祂致謝，並讚美祂的聖名。', '聖詠 100:4', '以感恩和讚美的心進入神的殿，感謝祂的恩典。', ARRAY['感恩', '讚美', '喜樂'], ARRAY['感恩', '讚美', '喜樂', '感謝'], true),

-- 道教經典
('taoism', 'scripture', 'peace', '道德經 - 清靜為天下正', '清靜為天下正。', '道德經', '保持內心清淨安靜，就能使天下歸於正道。', ARRAY['清靜', '無為', '自然'], ARRAY['清靜', '平靜', '無為', '安詳'], true),
('taoism', 'scripture', 'anxiety', '道德經 - 禍福相倚', '禍兮福之所倚，福兮禍之所伏。', '道德經', '禍與福互相依存，福與禍相互轉化。困難中蘊含轉機，順境中要保持警覺。', ARRAY['陰陽', '轉化', '智慧'], ARRAY['禍福', '轉化', '焦慮', '智慧'], true),
('taoism', 'scripture', 'gratitude', '道德經 - 知足不辱', '知足不辱，知止不殆，可以長久。', '道德經', '知道滿足就不會受到羞辱，知道適可而止就不會遭遇危險，這樣才能長久。', ARRAY['知足', '長久', '智慧'], ARRAY['知足', '感恩', '滿足', '長久'], true),
('taoism', 'scripture', 'loneliness', '莊子 - 天地與我並生', '天地與我並生，而萬物與我為一。', '莊子', '天地與我一同存在，萬物與我本是一體。', ARRAY['天人合一', '連結', '宇宙'], ARRAY['天地', '萬物', '一體', '孤獨', '連結'], true),

-- 民間信仰
('folk', 'prayer', 'peace', '觀音菩薩普門品', '南無大慈大悲救苦救難廣大靈感觀世音菩薩', '普門品', '稱念觀世音菩薩，祈求菩薩慈悲護佑，救苦救難。', ARRAY['觀音', '慈悲', '救苦'], ARRAY['觀音', '菩薩', '慈悲', '平安', '保佑'], true),
('folk', 'practice', 'gratitude', '初一十五上香', '感謝天地眾神庇佑，感恩祖先護持，願家人平安健康。', '民間習俗', '在初一十五上香禮拜，感謝神明和祖先的保佑。', ARRAY['上香', '感恩', '祭拜'], ARRAY['上香', '感恩', '祖先', '神明'], true),
('folk', 'practice', 'anxiety', '求平安符', '虔誠祈求神明庇佑，平安符隨身攜帶，心安神定。', '民間習俗', '到廟宇求平安符，祈求神明保佑平安順利。', ARRAY['平安符', '庇佑', '心安'], ARRAY['平安符', '神明', '庇佑', '焦慮'], true),

-- 無特定信仰 - 普世智慧
('none', 'meditation', 'anxiety', '腹式呼吸練習', '找一個安靜的地方坐下，閉上眼睛。慢慢地用鼻子深吸氣，讓腹部鼓起，數到四。暫停一下，然後慢慢用嘴巴呼氣，數到六。重複十次。', '正念冥想', '透過專注呼吸來放鬆身心，減輕焦慮。', ARRAY['呼吸', '冥想', '放鬆'], ARRAY['呼吸', '冥想', '焦慮', '放鬆'], true),
('none', 'practice', 'gratitude', '每日感恩三件事', '每天睡前，寫下三件讓你感恩的事情。可以是很小的事，像是今天的好天氣、一頓美味的餐點，或是朋友的一句關心。', '正向心理學', '培養感恩的習慣，增加幸福感和生活滿意度。', ARRAY['感恩', '日記', '幸福'], ARRAY['感恩', '日記', '幸福', '習慣'], true),
('none', 'meditation', 'peace', '正念觀察練習', '選擇一個物品（如一朵花、一顆石頭），用五分鐘仔細觀察它的顏色、形狀、紋理。讓心完全專注在當下。', '正念練習', '透過專注當下來培養內心平靜。', ARRAY['正念', '當下', '專注'], ARRAY['正念', '當下', '平靜', '專注'], true),
('none', 'practice', 'loneliness', '親近自然', '到公園或戶外走走，感受陽光、微風、樹木。觀察周圍的生命，感受自己與大自然的連結。', '自然療癒', '親近自然可以減輕孤獨感，感受生命的連結。', ARRAY['自然', '連結', '療癒'], ARRAY['自然', '戶外', '孤獨', '連結'], true);

-- ============================================================================
-- 完成訊息
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '✅ 心靈照護模組資料庫 Migration 完成！';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '已建立的表格:';
    RAISE NOTICE '  - emotional_journals (心情日記)';
    RAISE NOTICE '  - spiritual_contents (心靈語料庫)';
    RAISE NOTICE '  - spiritual_care_tasks (照護任務)';
    RAISE NOTICE '  - spiritual_weekly_reports (週報)';
    RAISE NOTICE '';
    RAISE NOTICE '已擴充的表格:';
    RAISE NOTICE '  - user_profiles (新增心靈偏好欄位)';
    RAISE NOTICE '  - messages (新增情緒標註欄位)';
    RAISE NOTICE '';
    RAISE NOTICE '已建立的視圖:';
    RAISE NOTICE '  - emotional_trends (情緒趨勢分析)';
    RAISE NOTICE '';
    RAISE NOTICE '已匯入初始資料:';
    RAISE NOTICE '  - 20+ 條心靈語料（佛教、基督教、天主教、道教、民間信仰、普世智慧）';
    RAISE NOTICE '';
    RAISE NOTICE '下一步: 啟動後端服務並測試 API';
    RAISE NOTICE '============================================================================';
END $$;
