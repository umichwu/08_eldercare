-- ============================================================================
-- ElderCare Companion - Complete Database Schema
-- ============================================================================
-- 版本: 3.0
-- 日期: 2025-10-24
-- 說明: 整合所有功能的完整資料庫架構
-- 包含: 認證系統、對話系統、快捷功能（天氣、用藥、笑話、健康諮詢）
-- ============================================================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 關閉 RLS（避免刪除時權限問題）
ALTER TABLE IF EXISTS public.health_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.health_consultations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.joke_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.jokes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weather_queries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_participations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emergency_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversation_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.elder_family_relations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.elders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles DISABLE ROW LEVEL SECURITY;

-- 刪除視圖
DROP VIEW IF EXISTS public.elder_daily_stats;
DROP VIEW IF EXISTS public.elder_full_info;

-- 刪除表格（依相依性順序）
DROP TABLE IF EXISTS public.health_tracking CASCADE;
DROP TABLE IF EXISTS public.health_consultations CASCADE;
DROP TABLE IF EXISTS public.joke_logs CASCADE;
DROP TABLE IF EXISTS public.jokes CASCADE;
DROP TABLE IF EXISTS public.medication_logs CASCADE;
DROP TABLE IF EXISTS public.medication_reminders CASCADE;
DROP TABLE IF EXISTS public.weather_queries CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activity_participations CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.emergency_alerts CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.medications CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.conversation_summaries CASCADE;
DROP TABLE IF EXISTS public.elder_family_relations CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.elders CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- 刪除觸發器函數
DROP FUNCTION IF EXISTS public.update_conversation_message_count() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_elder_age() CASCADE;

-- ============================================================================
-- STEP 2: 啟用擴展功能
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- STEP 3: 使用者認證系統
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 使用者檔案表 (user_profiles)
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯到 Supabase Auth
    auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 基本資料
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    phone VARCHAR(20),

    -- 使用者角色
    role VARCHAR(20) NOT NULL CHECK (role IN ('elder', 'family', 'both')),

    -- 關聯到角色表（會在角色建立後填入）
    elder_id UUID,
    family_member_id UUID,

    -- OAuth 資訊
    oauth_provider VARCHAR(50),
    oauth_provider_id TEXT,

    -- 偏好設定
    language VARCHAR(10) DEFAULT 'zh-TW',
    theme VARCHAR(20) DEFAULT 'light',
    font_size INTEGER DEFAULT 24,

    -- 狀態
    onboarding_completed BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_user_profiles_auth_user_id ON public.user_profiles(auth_user_id);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = auth_user_id);

COMMENT ON TABLE public.user_profiles IS '使用者檔案表 - 統一管理所有使用者';

-- ----------------------------------------------------------------------------
-- 3.2 長輩資料表 (elders)
-- ----------------------------------------------------------------------------
CREATE TABLE public.elders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 基本資料
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    birth_date DATE,
    age INTEGER,

    -- 聯絡資訊
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    location GEOGRAPHY(POINT),

    -- 健康資訊
    blood_type VARCHAR(5),
    allergies TEXT[],
    chronic_diseases TEXT[],
    emergency_contacts JSONB,

    -- 個人化設定
    language VARCHAR(10) DEFAULT 'zh-TW',
    voice_type VARCHAR(20) DEFAULT 'female',
    font_size INTEGER DEFAULT 24,
    theme VARCHAR(20) DEFAULT 'light',

    -- AI 個人化設定
    personality_profile JSONB,
    interests TEXT[],
    conversation_style VARCHAR(20) DEFAULT 'friendly',

    -- 安全設定
    fall_detection_enabled BOOLEAN DEFAULT true,
    sos_enabled BOOLEAN DEFAULT true,
    geofence_enabled BOOLEAN DEFAULT false,
    geofence_radius INTEGER DEFAULT 1000,

    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_active_at TIMESTAMPTZ,

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_elders_user_profile_id ON public.elders(user_profile_id);
CREATE INDEX idx_elders_auth_user_id ON public.elders(auth_user_id);
CREATE INDEX idx_elders_status ON public.elders(status) WHERE deleted_at IS NULL;

ALTER TABLE public.elders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own elder profile"
    ON public.elders FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own elder profile"
    ON public.elders FOR UPDATE
    USING (auth.uid() = auth_user_id);

COMMENT ON TABLE public.elders IS '長輩資料表';

-- ----------------------------------------------------------------------------
-- 3.3 家屬資料表 (family_members)
-- ----------------------------------------------------------------------------
CREATE TABLE public.family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),

    role VARCHAR(20) DEFAULT 'family' CHECK (role IN ('family', 'caregiver', 'admin')),

    notification_settings JSONB DEFAULT '{
        "push_enabled": true,
        "email_enabled": true,
        "sms_enabled": false,
        "emergency_only": false,
        "daily_summary": true,
        "weekly_summary": true
    }',

    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_active_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_family_members_user_profile_id ON public.family_members(user_profile_id);
CREATE INDEX idx_family_members_auth_user_id ON public.family_members(auth_user_id);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own family profile"
    ON public.family_members FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own family profile"
    ON public.family_members FOR UPDATE
    USING (auth.uid() = auth_user_id);

COMMENT ON TABLE public.family_members IS '家屬資料表';

-- 加入外鍵約束
ALTER TABLE public.user_profiles
ADD CONSTRAINT fk_user_profiles_elder_id
FOREIGN KEY (elder_id) REFERENCES public.elders(id) ON DELETE SET NULL;

ALTER TABLE public.user_profiles
ADD CONSTRAINT fk_user_profiles_family_member_id
FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3.4 家屬-長輩關聯表 (elder_family_relations)
-- ----------------------------------------------------------------------------
CREATE TABLE public.elder_family_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,

    relationship VARCHAR(50) NOT NULL,
    is_primary_contact BOOLEAN DEFAULT false,
    is_emergency_contact BOOLEAN DEFAULT false,

    can_view_conversations BOOLEAN DEFAULT true,
    can_view_health_records BOOLEAN DEFAULT true,
    can_receive_alerts BOOLEAN DEFAULT true,
    can_manage_settings BOOLEAN DEFAULT false,

    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(elder_id, family_member_id)
);

CREATE INDEX idx_elder_family_elder_id ON public.elder_family_relations(elder_id);
CREATE INDEX idx_elder_family_family_id ON public.elder_family_relations(family_member_id);

ALTER TABLE public.elder_family_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elders can view own family relations"
    ON public.elder_family_relations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elders
            WHERE id = elder_family_relations.elder_id
            AND auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Family can view own elder relations"
    ON public.elder_family_relations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE id = elder_family_relations.family_member_id
            AND auth_user_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 4: 對話系統
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 對話會話表 (conversations)
-- ----------------------------------------------------------------------------
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    elder_id UUID REFERENCES public.elders(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,

    title VARCHAR(255),
    session_start_at TIMESTAMPTZ DEFAULT NOW(),
    session_end_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- 統計（包含新增的 messages_since_last_summary）
    message_count INTEGER DEFAULT 0,
    user_message_count INTEGER DEFAULT 0,
    ai_message_count INTEGER DEFAULT 0,
    messages_since_last_summary INTEGER DEFAULT 0,

    primary_topic VARCHAR(100),
    topics TEXT[],
    emotions TEXT[],
    sentiment VARCHAR(20),
    sentiment_score DECIMAL(3,2),

    needs_summary BOOLEAN DEFAULT false,
    summary_generated BOOLEAN DEFAULT false,
    summary_id UUID,

    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'archived')),

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_profile_id ON public.conversations(user_profile_id);
CREATE INDEX idx_conversations_auth_user_id ON public.conversations(auth_user_id);
CREATE INDEX idx_conversations_elder_id ON public.conversations(elder_id);
CREATE INDEX idx_conversations_family_id ON public.conversations(family_member_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_date ON public.conversations(session_start_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
    ON public.conversations FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can create own conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own conversations"
    ON public.conversations FOR UPDATE
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Family can view elder conversations"
    ON public.conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            JOIN public.family_members fm ON fm.id = efr.family_member_id
            WHERE efr.elder_id = conversations.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.can_view_conversations = true
            AND efr.status = 'active'
        )
    );

COMMENT ON TABLE public.conversations IS '對話會話表';
COMMENT ON COLUMN public.conversations.messages_since_last_summary IS '自上次總結後的訊息數量';

-- ----------------------------------------------------------------------------
-- 4.2 對話訊息表 (messages)
-- ----------------------------------------------------------------------------
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'voice', 'image', 'video')),

    audio_url TEXT,
    audio_duration_seconds INTEGER,
    transcription TEXT,

    intent VARCHAR(100),
    emotion VARCHAR(50),
    emotion_score DECIMAL(3,2),
    entities JSONB,
    keywords TEXT[],

    health_mentioned BOOLEAN DEFAULT false,
    pain_mentioned BOOLEAN DEFAULT false,
    medication_mentioned BOOLEAN DEFAULT false,
    emergency_detected BOOLEAN DEFAULT false,

    model VARCHAR(50),
    temperature DECIMAL(2,1),
    tokens_used INTEGER,

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),

    embedding vector(1536)
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_user_profile_id ON public.messages(user_profile_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_role ON public.messages(role);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
    ON public.messages FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can create own messages"
    ON public.messages FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Family can view elder messages"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.elder_family_relations efr ON efr.elder_id = c.elder_id
            JOIN public.family_members fm ON fm.id = efr.family_member_id
            WHERE c.id = messages.conversation_id
            AND fm.auth_user_id = auth.uid()
            AND efr.can_view_conversations = true
            AND efr.status = 'active'
        )
    );

COMMENT ON TABLE public.messages IS '對話訊息表';

-- ----------------------------------------------------------------------------
-- 4.3 對話總結表 (conversation_summaries)
-- ----------------------------------------------------------------------------
CREATE TABLE public.conversation_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 支援單一對話和多對話總結
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    conversation_ids UUID[],

    time_range_start TIMESTAMPTZ,
    time_range_end TIMESTAMPTZ,

    total_conversations INTEGER,
    total_messages INTEGER,

    -- 總結內容
    summary TEXT,
    overview TEXT,
    health_summary JSONB DEFAULT '{}',
    social_summary JSONB DEFAULT '{}',
    medication_summary JSONB DEFAULT '{}',
    appointments_summary JSONB DEFAULT '{}',
    key_moments JSONB DEFAULT '[]',
    alerts JSONB DEFAULT '[]',
    family_message TEXT,
    ai_insights JSONB DEFAULT '{}',

    emotion_distribution JSONB DEFAULT '{}',
    overall_sentiment VARCHAR(20),
    sentiment_trend VARCHAR(20),

    topic_distribution JSONB DEFAULT '{}',

    -- 總結類型和狀態
    summary_type VARCHAR(20) DEFAULT 'auto' CHECK (summary_type IN ('auto', 'manual', 'daily', 'weekly')),
    is_latest BOOLEAN DEFAULT true,

    model_used VARCHAR(50),
    token_count INTEGER,
    generation_quality_score DECIMAL(3,2),

    read_by_family JSONB DEFAULT '{}',

    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_summaries_user_profile_id ON public.conversation_summaries(user_profile_id);
CREATE INDEX idx_summaries_conversation_id ON public.conversation_summaries(conversation_id);
CREATE INDEX idx_summaries_created_at ON public.conversation_summaries(created_at DESC);

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own summaries"
    ON public.conversation_summaries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = conversation_summaries.user_profile_id
            AND auth_user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.elder_family_relations efr ON efr.elder_id = c.elder_id
            JOIN public.family_members fm ON fm.id = efr.family_member_id
            WHERE c.id = conversation_summaries.conversation_id
            AND fm.auth_user_id = auth.uid()
            AND efr.can_view_conversations = true
            AND efr.status = 'active'
        )
    );

CREATE POLICY "Users can create own summaries"
    ON public.conversation_summaries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = conversation_summaries.user_profile_id
            AND auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.conversation_summaries IS '對話總結表';
COMMENT ON COLUMN public.conversation_summaries.conversation_id IS '單一對話 ID（用於自動總結）';
COMMENT ON COLUMN public.conversation_summaries.is_latest IS '是否為最新總結';
COMMENT ON COLUMN public.conversation_summaries.summary_type IS '總結類型：auto（自動）、manual（手動）、daily（每日）、weekly（每週）';
COMMENT ON COLUMN public.conversation_summaries.summary IS '總結文字（用於單一對話）';
COMMENT ON COLUMN public.conversation_summaries.token_count IS 'AI 使用的 token 數量';

-- 加入外鍵約束
ALTER TABLE public.conversations
ADD CONSTRAINT fk_conversations_summary_id
FOREIGN KEY (summary_id) REFERENCES public.conversation_summaries(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 5: 快捷功能表（天氣、用藥、笑話、健康諮詢）
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 天氣查詢記錄表
-- ----------------------------------------------------------------------------
CREATE TABLE public.weather_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

    location VARCHAR(255),
    query_text TEXT NOT NULL,
    weather_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_queries_user_profile_id ON public.weather_queries(user_profile_id);
CREATE INDEX idx_weather_queries_created_at ON public.weather_queries(created_at DESC);

ALTER TABLE public.weather_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weather queries"
    ON public.weather_queries FOR SELECT
    USING (auth.uid() = (SELECT auth_user_id FROM public.user_profiles WHERE id = user_profile_id));

CREATE POLICY "Users can insert own weather queries"
    ON public.weather_queries FOR INSERT
    WITH CHECK (auth.uid() = (SELECT auth_user_id FROM public.user_profiles WHERE id = user_profile_id));

COMMENT ON TABLE public.weather_queries IS '天氣查詢記錄表';

-- ----------------------------------------------------------------------------
-- 5.2 用藥提醒表
-- ----------------------------------------------------------------------------
CREATE TABLE public.medication_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    notes TEXT,

    reminder_times TIME[],
    is_active BOOLEAN DEFAULT true,

    last_reminded_at TIMESTAMPTZ,
    next_reminder_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.medication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_reminder_id UUID NOT NULL REFERENCES public.medication_reminders(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    taken_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_time TIME,
    status VARCHAR(20) DEFAULT 'taken' CHECK (status IN ('taken', 'skipped', 'delayed')),
    notes TEXT
);

CREATE INDEX idx_medication_reminders_user_profile_id ON public.medication_reminders(user_profile_id);
CREATE INDEX idx_medication_reminders_active ON public.medication_reminders(user_profile_id, is_active) WHERE is_active = true;
CREATE INDEX idx_medication_logs_user_profile_id ON public.medication_logs(user_profile_id);
CREATE INDEX idx_medication_logs_taken_at ON public.medication_logs(taken_at DESC);

ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own medication reminders"
    ON public.medication_reminders FOR ALL
    USING (auth.uid() = (SELECT auth_user_id FROM public.user_profiles WHERE id = user_profile_id));

CREATE POLICY "Users can manage own medication logs"
    ON public.medication_logs FOR ALL
    USING (auth.uid() = (SELECT auth_user_id FROM public.user_profiles WHERE id = user_profile_id));

COMMENT ON TABLE public.medication_reminders IS '用藥提醒表';
COMMENT ON TABLE public.medication_logs IS '用藥記錄表';

-- ----------------------------------------------------------------------------
-- 5.3 笑話資料表
-- ----------------------------------------------------------------------------
CREATE TABLE public.jokes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    title VARCHAR(255),
    content TEXT NOT NULL,
    category VARCHAR(50),
    language VARCHAR(10) DEFAULT 'zh-TW',

    difficulty_level VARCHAR(20) DEFAULT 'easy' CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    is_elder_friendly BOOLEAN DEFAULT true,

    source VARCHAR(255),
    times_told INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.joke_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    joke_id UUID NOT NULL REFERENCES public.jokes(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

    reaction VARCHAR(20) CHECK (reaction IN ('loved', 'liked', 'neutral', 'disliked')),

    told_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jokes_category ON public.jokes(category);
CREATE INDEX idx_jokes_language ON public.jokes(language);
CREATE INDEX idx_jokes_elder_friendly ON public.jokes(is_elder_friendly) WHERE is_elder_friendly = true;
CREATE INDEX idx_joke_logs_user_profile_id ON public.joke_logs(user_profile_id);
CREATE INDEX idx_joke_logs_told_at ON public.joke_logs(told_at DESC);

ALTER TABLE public.jokes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.joke_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view jokes"
    ON public.jokes FOR SELECT
    USING (true);

CREATE POLICY "Users can view own joke logs"
    ON public.joke_logs FOR SELECT
    USING (auth.uid() = (SELECT auth_user_id FROM public.user_profiles WHERE id = user_profile_id));

CREATE POLICY "Users can insert own joke logs"
    ON public.joke_logs FOR INSERT
    WITH CHECK (auth.uid() = (SELECT auth_user_id FROM public.user_profiles WHERE id = user_profile_id));

COMMENT ON TABLE public.jokes IS '笑話資料表';
COMMENT ON TABLE public.joke_logs IS '笑話使用記錄表';

-- ----------------------------------------------------------------------------
-- 5.4 健康諮詢表
-- ----------------------------------------------------------------------------
CREATE TABLE public.health_consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

    symptoms TEXT NOT NULL,
    symptom_category VARCHAR(100),
    severity_level VARCHAR(20) CHECK (severity_level IN ('mild', 'moderate', 'severe', 'emergency')),

    ai_response TEXT,
    ai_suggestions JSONB,

    requires_followup BOOLEAN DEFAULT false,
    followup_notes TEXT,
    is_emergency BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.health_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    health_consultation_id UUID REFERENCES public.health_consultations(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    status VARCHAR(50) CHECK (status IN ('improved', 'same', 'worse', 'resolved')),
    notes TEXT,

    tracked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_consultations_user_profile_id ON public.health_consultations(user_profile_id);
CREATE INDEX idx_health_consultations_created_at ON public.health_consultations(created_at DESC);
CREATE INDEX idx_health_consultations_severity ON public.health_consultations(severity_level);
CREATE INDEX idx_health_consultations_emergency ON public.health_consultations(is_emergency) WHERE is_emergency = true;
CREATE INDEX idx_health_tracking_user_profile_id ON public.health_tracking(user_profile_id);

ALTER TABLE public.health_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own health consultations"
    ON public.health_consultations FOR ALL
    USING (auth.uid() = (SELECT auth_user_id FROM public.user_profiles WHERE id = user_profile_id));

CREATE POLICY "Users can manage own health tracking"
    ON public.health_tracking FOR ALL
    USING (auth.uid() = (SELECT auth_user_id FROM public.user_profiles WHERE id = user_profile_id));

COMMENT ON TABLE public.health_consultations IS '健康諮詢記錄表';
COMMENT ON TABLE public.health_tracking IS '健康追蹤表';

-- ============================================================================
-- STEP 6: 觸發器與自動化
-- ============================================================================

-- 自動計算年齡
CREATE OR REPLACE FUNCTION public.calculate_elder_age()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.birth_date IS NOT NULL THEN
        NEW.age = EXTRACT(YEAR FROM AGE(NOW(), NEW.birth_date));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER elder_age_calculation
BEFORE INSERT OR UPDATE OF birth_date ON public.elders
FOR EACH ROW EXECUTE FUNCTION public.calculate_elder_age();

-- 更新 updated_at 時間戳記
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_elders_updated_at BEFORE UPDATE ON public.elders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_members_updated_at BEFORE UPDATE ON public.family_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_summaries_updated_at BEFORE UPDATE ON public.conversation_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medication_reminders_updated_at BEFORE UPDATE ON public.medication_reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jokes_updated_at BEFORE UPDATE ON public.jokes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_consultations_updated_at BEFORE UPDATE ON public.health_consultations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 對話計數更新觸發器（整合 messages_since_last_summary）
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET
        message_count = message_count + 1,
        user_message_count = CASE WHEN NEW.role = 'user' THEN user_message_count + 1 ELSE user_message_count END,
        ai_message_count = CASE WHEN NEW.role = 'assistant' THEN ai_message_count + 1 ELSE ai_message_count END,
        messages_since_last_summary = messages_since_last_summary + 1
    WHERE id = NEW.conversation_id;

    -- 檢查是否需要觸發總結（每 20 次對話）
    UPDATE public.conversations
    SET needs_summary = true
    WHERE id = NEW.conversation_id
    AND messages_since_last_summary >= 20
    AND needs_summary = false;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_count
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_message_count();

-- 自動建立 user_profile 觸發器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _display_name TEXT;
    _role TEXT;
BEGIN
    _display_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'display_name', '')), '');
    IF _display_name IS NULL THEN
        _display_name := SPLIT_PART(NEW.email, '@', 1);
    END IF;

    _role := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')), '');
    IF _role IS NULL OR _role NOT IN ('elder', 'family', 'both') THEN
        _role := 'family';
    END IF;

    INSERT INTO public.user_profiles (auth_user_id, email, oauth_provider, display_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
        _display_name,
        _role
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 7: 初始資料（範例笑話）
-- ============================================================================

INSERT INTO public.jokes (title, content, category, language, difficulty_level, is_elder_friendly) VALUES
    ('醫生的建議', '醫生：「您需要多運動。」
病人：「那我走路去醫院可以嗎？」
醫生：「當然可以！」
病人：「好，那我明天走路來掛號。」', '生活趣事', 'zh-TW', 'easy', true),

    ('買菜趣事', '老伯在市場買菜：「這青菜多少錢？」
老闆：「一把 30 元。」
老伯：「太貴了！我去別家買。」
（繞一圈後回來）
老伯：「還是你這把好看，給我兩把！」', '生活趣事', 'zh-TW', 'easy', true),

    ('打電話', '奶奶第一次用智慧型手機打電話。
打完後很興奮地說：「哇！這手機真厲害，我在這裡講話，對方在那麼遠的地方就聽得到！」
孫子：「奶奶，以前的電話也是這樣啊...」', '科技趣事', 'zh-TW', 'easy', true),

    ('養生之道', '記者問長壽老人：「請問您長壽的秘訣是什麼？」
老人：「每天都要笑。」
記者：「那今天笑了嗎？」
老人：「笑了，看到你來採訪我就笑了。」', '生活趣事', 'zh-TW', 'easy', true),

    ('記憶力', '老張對老李說：「唉，年紀大了記性不好，常常忘東忘西。」
老李：「我也是啊！昨天出門忘記帶鑰匙。」
老張：「那你怎麼辦？」
老李：「我忘了...」', '冷笑話', 'zh-TW', 'easy', true);

-- ============================================================================
-- 完成訊息
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '✅ ElderCare Companion Database Schema v3.0 建立完成！';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '📊 核心表格：';
    RAISE NOTICE '   - user_profiles, elders, family_members, elder_family_relations';
    RAISE NOTICE '   - conversations, messages, conversation_summaries';
    RAISE NOTICE '📊 快捷功能表格：';
    RAISE NOTICE '   - weather_queries (天氣查詢)';
    RAISE NOTICE '   - medication_reminders, medication_logs (用藥提醒)';
    RAISE NOTICE '   - jokes, joke_logs (笑話)';
    RAISE NOTICE '   - health_consultations, health_tracking (健康諮詢)';
    RAISE NOTICE '🎭 範例資料：5 個適合長輩的笑話已插入';
    RAISE NOTICE '🔐 Row Level Security (RLS) 已啟用所有表格';
    RAISE NOTICE '⚡ 自動化觸發器已設定';
    RAISE NOTICE '============================================================================';
END $$;
