-- ============================================================================
-- ElderCare Companion - 完整資料庫 Schema（含認證、用藥、心靈照護）
-- ============================================================================
-- 版本: 5.0 (2025-11-29 更新)
-- 更新內容:
--   v5.0 新增:
--   - 短期用藥功能（藥物次數控制、序號標記）
--   - 圖片上傳功能（藥物拍照、心情日記配圖）
--   - 地理位置功能（安全區域、位置追蹤、地理圍欄警示）
--   v4.0:
--   - 修正 elders 表增加 auth_user_id 欄位（必填）
--   - 更新所有 RLS 政策使用 auth_user_id 直接關聯（更簡潔安全）
--   - 確保 medications, medication_reminders, medication_logs 的 RLS 正確
--   - 整合所有最新的修正和優化
-- ============================================================================
-- 功能: 完整系統 Schema，整合以下功能：
--   1. 使用者認證系統（本地帳號 + Google OAuth）
--   2. 用藥提醒系統（FCM 推送通知 + Email 通知）
--   3. 心靈照護模組（情緒分析、心情日記、Agentic RAG）
--   4. 短期用藥管理（次數控制、進度追蹤）
--   5. 圖片上傳與管理（藥物外觀、心情日記配圖）
--   6. 地理位置追蹤（安全區域、位置記錄、警示通知）
-- 角色: 長輩和家屬都可以與 AI 聊天
-- ============================================================================

-- ============================================================================
-- STEP 1: 清理舊資料（如果存在）
-- ============================================================================

-- 關閉 RLS（避免刪除時權限問題）
ALTER TABLE IF EXISTS public.family_geolocation_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.geofence_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.location_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.safe_zones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.image_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mood_diary_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mood_diaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.uploaded_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spiritual_weekly_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spiritual_care_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spiritual_contents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emotional_journals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_view_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.elder_activity_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_participations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emergency_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversation_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.elder_family_relations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.elders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles DISABLE ROW LEVEL SECURITY;

-- 刪除視圖
DROP VIEW IF EXISTS public.v_short_term_medication_progress CASCADE;
DROP VIEW IF EXISTS public.emotional_trends CASCADE;
DROP VIEW IF EXISTS public.v_elder_current_medications CASCADE;
DROP VIEW IF EXISTS public.v_today_medication_schedule CASCADE;
DROP VIEW IF EXISTS public.elder_daily_stats CASCADE;
DROP VIEW IF EXISTS public.elder_full_info CASCADE;

-- 刪除觸發器
DROP TRIGGER IF EXISTS update_safe_zones_updated_at ON public.safe_zones;
DROP TRIGGER IF EXISTS update_family_geolocation_settings_updated_at ON public.family_geolocation_settings;
DROP TRIGGER IF EXISTS update_uploaded_images_updated_at ON public.uploaded_images;
DROP TRIGGER IF EXISTS update_mood_diaries_updated_at ON public.mood_diaries;
DROP TRIGGER IF EXISTS trigger_update_doses_completed ON public.medication_logs;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trigger_update_conversation_count ON public.messages;
DROP TRIGGER IF EXISTS trigger_update_reminder_stats ON public.medication_logs;
DROP TRIGGER IF EXISTS elder_age_calculation ON public.elders;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS update_elders_updated_at ON public.elders;
DROP TRIGGER IF EXISTS update_family_members_updated_at ON public.family_members;
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
DROP TRIGGER IF EXISTS update_conversation_summaries_updated_at ON public.conversation_summaries;
DROP TRIGGER IF EXISTS trigger_medications_updated_at ON public.medications;
DROP TRIGGER IF EXISTS trigger_medication_reminders_updated_at ON public.medication_reminders;
DROP TRIGGER IF EXISTS trigger_medication_logs_updated_at ON public.medication_logs;

-- 刪除函數
DROP FUNCTION IF EXISTS public.cleanup_old_location_history(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_latest_location(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_in_safe_zone(DECIMAL, DECIMAL, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_distance(DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_deleted_images(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.find_orphaned_images() CASCADE;
DROP FUNCTION IF EXISTS public.soft_delete_image(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_storage_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_diary_images(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_medication_images(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_doses_completed() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_medication_reminder_stats() CASCADE;
DROP FUNCTION IF EXISTS update_conversation_message_count() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_elder_age() CASCADE;

-- 刪除表格（依相依性順序）
DROP TABLE IF EXISTS public.family_geolocation_settings CASCADE;
DROP TABLE IF EXISTS public.geofence_alerts CASCADE;
DROP TABLE IF EXISTS public.location_history CASCADE;
DROP TABLE IF EXISTS public.safe_zones CASCADE;
DROP TABLE IF EXISTS public.image_tags CASCADE;
DROP TABLE IF EXISTS public.mood_diary_images CASCADE;
DROP TABLE IF EXISTS public.mood_diaries CASCADE;
DROP TABLE IF EXISTS public.medication_images CASCADE;
DROP TABLE IF EXISTS public.uploaded_images CASCADE;
DROP TABLE IF EXISTS public.spiritual_weekly_reports CASCADE;
DROP TABLE IF EXISTS public.spiritual_care_tasks CASCADE;
DROP TABLE IF EXISTS public.spiritual_contents CASCADE;
DROP TABLE IF EXISTS public.emotional_journals CASCADE;
DROP TABLE IF EXISTS public.family_view_logs CASCADE;
DROP TABLE IF EXISTS public.elder_activity_tracking CASCADE;
DROP TABLE IF EXISTS public.medication_logs CASCADE;
DROP TABLE IF EXISTS public.medication_reminders CASCADE;
DROP TABLE IF EXISTS public.medications CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activity_participations CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.emergency_alerts CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.conversation_summaries CASCADE;
DROP TABLE IF EXISTS public.elder_family_relations CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.elders CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

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

    -- 心靈照護偏好
    spiritual_preference VARCHAR(50),
    spiritual_details JSONB,
    mindfulness_enabled BOOLEAN DEFAULT false,
    privacy_level VARCHAR(20) DEFAULT 'private' CHECK (privacy_level IN ('private', 'family_visible', 'full_share')),

    -- FCM Token（推送通知）
    fcm_token TEXT,
    fcm_token_updated_at TIMESTAMPTZ,

    -- 狀態
    onboarding_completed BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_user_profiles_auth_user_id ON public.user_profiles(auth_user_id);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_spiritual_preference ON public.user_profiles(spiritual_preference);
CREATE INDEX idx_user_profiles_mindfulness_enabled ON public.user_profiles(mindfulness_enabled);
CREATE INDEX idx_user_profiles_fcm_token ON public.user_profiles(fcm_token) WHERE fcm_token IS NOT NULL;

-- RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = auth_user_id);

COMMENT ON TABLE public.user_profiles IS '使用者檔案表 - 統一管理所有使用者';

-- ----------------------------------------------------------------------------
-- 3.2 長輩資料表 (elders)
-- ⚠️ 重要更新: 增加 auth_user_id 欄位（必填）
-- ----------------------------------------------------------------------------
CREATE TABLE public.elders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- ⚠️ 必填: 直接關聯到 auth.users
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 關聯到使用者檔案
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- 基本資料
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
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
    health_status VARCHAR(20) DEFAULT 'good' CHECK (health_status IN ('excellent', 'good', 'fair', 'poor')),

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

    -- FCM Token（推送通知）
    fcm_token TEXT,
    fcm_token_updated_at TIMESTAMPTZ,
    device_info JSONB DEFAULT '{}',

    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_active_at TIMESTAMPTZ,

    -- 元資料
    metadata JSONB DEFAULT '{}',

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- 唯一性約束
    UNIQUE(auth_user_id),
    UNIQUE(user_profile_id)
);

-- 自動計算年齡函數
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

-- 索引
CREATE INDEX idx_elders_user_profile_id ON public.elders(user_profile_id);
CREATE INDEX idx_elders_auth_user_id ON public.elders(auth_user_id);
CREATE INDEX idx_elders_status ON public.elders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_elders_fcm_token ON public.elders(fcm_token) WHERE fcm_token IS NOT NULL;

-- ⚠️ 更新的 RLS 政策: 使用 auth_user_id 直接比對
ALTER TABLE public.elders ENABLE ROW LEVEL SECURITY;

-- SELECT: 允許使用者查看自己的長輩資料
CREATE POLICY "Users can view own elder data"
    ON public.elders FOR SELECT
    USING (auth.uid() = auth_user_id);

-- INSERT: 允許使用者插入自己的長輩資料
CREATE POLICY "Users can insert own elder data"
    ON public.elders FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

-- UPDATE: 允許使用者更新自己的長輩資料
CREATE POLICY "Users can update own elder data"
    ON public.elders FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- DELETE: 允許使用者刪除自己的長輩資料
CREATE POLICY "Users can delete own elder data"
    ON public.elders FOR DELETE
    USING (auth.uid() = auth_user_id);

COMMENT ON TABLE public.elders IS '長輩資料表 - v4.0 更新: 增加 auth_user_id 必填欄位';

-- ----------------------------------------------------------------------------
-- 3.3 家屬資料表 (family_members)
-- ----------------------------------------------------------------------------
CREATE TABLE public.family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯到使用者檔案
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 基本資料
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),

    -- 關係設定
    role VARCHAR(20) DEFAULT 'family' CHECK (role IN ('family', 'caregiver', 'admin')),

    -- 通知設定
    notification_settings JSONB DEFAULT '{
        "push_enabled": true,
        "email_enabled": true,
        "sms_enabled": false,
        "emergency_only": false,
        "daily_summary": true,
        "weekly_summary": true
    }',

    -- FCM Token（推送通知）
    fcm_token TEXT,
    fcm_token_updated_at TIMESTAMPTZ,
    device_info JSONB DEFAULT '{}',

    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_active_at TIMESTAMPTZ,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_family_members_user_profile_id ON public.family_members(user_profile_id);
CREATE INDEX idx_family_members_auth_user_id ON public.family_members(auth_user_id);
CREATE INDEX idx_family_members_fcm_token ON public.family_members(fcm_token) WHERE fcm_token IS NOT NULL;

-- RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own family profile"
    ON public.family_members FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own family profile"
    ON public.family_members FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own family profile"
    ON public.family_members FOR UPDATE
    USING (auth.uid() = auth_user_id);

COMMENT ON TABLE public.family_members IS '家屬資料表';

-- 加入外鍵約束到 user_profiles
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

    -- 關聯
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,

    -- 關係
    relationship VARCHAR(50) NOT NULL,
    is_primary_contact BOOLEAN DEFAULT false,
    is_emergency_contact BOOLEAN DEFAULT false,

    -- 權限
    can_view_conversations BOOLEAN DEFAULT true,
    can_view_health_records BOOLEAN DEFAULT true,
    can_receive_alerts BOOLEAN DEFAULT true,
    can_manage_settings BOOLEAN DEFAULT false,

    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(elder_id, family_member_id)
);

-- 索引
CREATE INDEX idx_elder_family_elder_id ON public.elder_family_relations(elder_id);
CREATE INDEX idx_elder_family_family_id ON public.elder_family_relations(family_member_id);

-- RLS
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

    -- 關聯（支援長輩和家屬）
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 如果是長輩，記錄 elder_id
    elder_id UUID REFERENCES public.elders(id) ON DELETE CASCADE,
    -- 如果是家屬，記錄 family_member_id
    family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,

    -- 會話資訊
    title VARCHAR(255),
    session_start_at TIMESTAMPTZ DEFAULT NOW(),
    session_end_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- 統計
    message_count INTEGER DEFAULT 0,
    user_message_count INTEGER DEFAULT 0,
    ai_message_count INTEGER DEFAULT 0,

    -- 分析
    primary_topic VARCHAR(100),
    topics TEXT[],
    emotions TEXT[],
    sentiment VARCHAR(20),
    sentiment_score DECIMAL(3,2),

    -- AI 總結
    needs_summary BOOLEAN DEFAULT false,
    summary_generated BOOLEAN DEFAULT false,
    summary_id UUID,

    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'archived')),

    -- 元資料
    metadata JSONB DEFAULT '{}',

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_conversations_user_profile_id ON public.conversations(user_profile_id);
CREATE INDEX idx_conversations_auth_user_id ON public.conversations(auth_user_id);
CREATE INDEX idx_conversations_elder_id ON public.conversations(elder_id);
CREATE INDEX idx_conversations_family_id ON public.conversations(family_member_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_date ON public.conversations(session_start_at DESC);

-- RLS
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

-- ----------------------------------------------------------------------------
-- 4.2 對話訊息表 (messages)
-- ----------------------------------------------------------------------------
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 訊息內容
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'voice', 'image', 'video')),

    -- 語音訊息
    audio_url TEXT,
    audio_duration_seconds INTEGER,
    transcription TEXT,

    -- AI 分析
    intent VARCHAR(100),
    emotion VARCHAR(50),
    emotion_score DECIMAL(3,2),
    entities JSONB,
    keywords TEXT[],

    -- 健康相關標記
    health_mentioned BOOLEAN DEFAULT false,
    pain_mentioned BOOLEAN DEFAULT false,
    medication_mentioned BOOLEAN DEFAULT false,
    emergency_detected BOOLEAN DEFAULT false,

    -- AI 設定
    model VARCHAR(50),
    temperature DECIMAL(2,1),
    tokens_used INTEGER,

    -- 心靈照護擴充
    emotion_detected JSONB,
    spiritual_content_used UUID,
    mindfulness_trigger BOOLEAN DEFAULT false,

    -- 元資料
    metadata JSONB DEFAULT '{}',

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 向量嵌入
    embedding vector(1536)
);

-- 索引
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_user_profile_id ON public.messages(user_profile_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_role ON public.messages(role);
CREATE INDEX idx_messages_mindfulness_trigger ON public.messages(mindfulness_trigger) WHERE mindfulness_trigger = true;
CREATE INDEX idx_messages_spiritual_content ON public.messages(spiritual_content_used) WHERE spiritual_content_used IS NOT NULL;

-- RLS
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

    -- 關聯
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    conversation_ids UUID[] NOT NULL,

    -- 時間範圍
    time_range_start TIMESTAMPTZ NOT NULL,
    time_range_end TIMESTAMPTZ NOT NULL,

    -- 統計
    total_conversations INTEGER NOT NULL,
    total_messages INTEGER NOT NULL,

    -- AI 總結內容
    overview TEXT NOT NULL,
    health_summary JSONB DEFAULT '{}',
    social_summary JSONB DEFAULT '{}',
    medication_summary JSONB DEFAULT '{}',
    appointments_summary JSONB DEFAULT '{}',
    key_moments JSONB DEFAULT '[]',
    alerts JSONB DEFAULT '[]',
    family_message TEXT,
    ai_insights JSONB DEFAULT '{}',

    -- 情緒分析
    emotion_distribution JSONB DEFAULT '{}',
    overall_sentiment VARCHAR(20),
    sentiment_trend VARCHAR(20),

    -- 話題分佈
    topic_distribution JSONB DEFAULT '{}',

    -- AI 模型資訊
    model_used VARCHAR(50),
    generation_quality_score DECIMAL(3,2),

    -- 家屬已讀狀態
    read_by_family JSONB DEFAULT '{}',

    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_summaries_user_profile_id ON public.conversation_summaries(user_profile_id);
CREATE INDEX idx_summaries_created_at ON public.conversation_summaries(created_at DESC);

-- RLS
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own summaries"
    ON public.conversation_summaries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = conversation_summaries.user_profile_id
            AND auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.conversation_summaries IS '對話總結表';

-- 加入外鍵約束
ALTER TABLE public.conversations
ADD CONSTRAINT fk_conversations_summary_id
FOREIGN KEY (summary_id) REFERENCES public.conversation_summaries(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 5: 用藥管理系統
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 藥物主表 (medications)
-- ----------------------------------------------------------------------------
CREATE TABLE public.medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯長輩
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 基本資訊
    medication_name VARCHAR(200) NOT NULL,
    medication_type VARCHAR(50),
    dosage VARCHAR(100),
    unit VARCHAR(20),

    -- 用藥說明
    instructions TEXT,
    purpose TEXT,
    side_effects TEXT,
    warnings TEXT,

    -- 處方資訊
    prescribed_by VARCHAR(100),
    prescription_date DATE,
    prescription_number VARCHAR(100),

    -- 藥物外觀
    color VARCHAR(50),
    shape VARCHAR(50),
    image_url TEXT,

    -- 庫存管理
    stock_quantity INTEGER DEFAULT 0,
    stock_alert_threshold INTEGER DEFAULT 7,
    last_refill_date DATE,

    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'expired', 'temporary')),
    is_emergency_medication BOOLEAN DEFAULT false,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.user_profiles(id),
    deleted_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_medications_elder_id ON public.medications(elder_id);
CREATE INDEX idx_medications_status ON public.medications(status) WHERE status = 'active';
CREATE INDEX idx_medications_stock ON public.medications(stock_quantity) WHERE stock_quantity <= stock_alert_threshold;

-- RLS (⚠️ v4.0 更新: 使用 auth_user_id 直接關聯)
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- SELECT: 使用者可以查看自己長輩的藥物
CREATE POLICY "Users can view their medications"
    ON public.medications FOR SELECT
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- INSERT: 使用者可以新增自己長輩的藥物
CREATE POLICY "Users can insert their medications"
    ON public.medications FOR INSERT
    TO authenticated
    WITH CHECK (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- UPDATE: 使用者可以更新自己長輩的藥物
CREATE POLICY "Users can update their medications"
    ON public.medications FOR UPDATE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- DELETE: 使用者可以刪除自己長輩的藥物
CREATE POLICY "Users can delete their medications"
    ON public.medications FOR DELETE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- Family can view related elder medications
CREATE POLICY "Family can view related elder medications"
    ON public.medications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = medications.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
            AND efr.can_view_health_records = true
        )
    );

COMMENT ON TABLE public.medications IS '藥物主表 - v4.0 更新: 簡化 RLS 政策';

-- ----------------------------------------------------------------------------
-- 5.2 用藥排程表 (medication_reminders)
-- ----------------------------------------------------------------------------
CREATE TABLE public.medication_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯藥物和長輩
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 排程設定（Cron 格式）
    cron_schedule VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Taipei',

    -- 人類可讀的提醒時間
    reminder_times JSONB,
    frequency_description VARCHAR(100),

    -- 提醒設定
    reminder_message TEXT,
    reminder_sound VARCHAR(50) DEFAULT 'default',
    vibrate BOOLEAN DEFAULT true,

    -- 進階設定
    reminder_advance_minutes INTEGER DEFAULT 0,
    auto_mark_missed_after_minutes INTEGER DEFAULT 30,

    -- FCM Token
    fcm_tokens TEXT[],

    -- 家屬通知設定
    notify_family_if_missed BOOLEAN DEFAULT true,
    family_fcm_tokens TEXT[],

    -- 狀態
    is_enabled BOOLEAN DEFAULT true,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,

    -- 統計
    total_reminders_sent INTEGER DEFAULT 0,
    total_taken INTEGER DEFAULT 0,
    total_missed INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMPTZ,

    -- 短期用藥功能 (v5.0 新增)
    is_short_term BOOLEAN DEFAULT false,
    total_doses INTEGER,
    doses_completed INTEGER DEFAULT 0,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.user_profiles(id)
);

-- 短期用藥欄位註解
COMMENT ON COLUMN public.medication_reminders.is_short_term IS '是否為短期用藥（感冒藥、抗生素等）';
COMMENT ON COLUMN public.medication_reminders.total_doses IS '短期用藥的總服用次數（例如：3天*4次/天=12次）';
COMMENT ON COLUMN public.medication_reminders.doses_completed IS '已完成的服用次數';

-- 索引
CREATE INDEX idx_medication_reminders_medication_id ON public.medication_reminders(medication_id);
CREATE INDEX idx_medication_reminders_elder_id ON public.medication_reminders(elder_id);
CREATE INDEX idx_medication_reminders_enabled ON public.medication_reminders(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_medication_reminders_schedule ON public.medication_reminders(cron_schedule);
CREATE INDEX idx_medication_reminders_short_term ON public.medication_reminders(is_short_term, is_enabled) WHERE is_short_term = true;

-- RLS (⚠️ v4.0 更新: 使用 auth_user_id 直接關聯)
ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;

-- SELECT: 使用者可以查看自己長輩的提醒
CREATE POLICY "Users can view their reminders"
    ON public.medication_reminders FOR SELECT
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- INSERT: 使用者可以新增自己長輩的提醒
CREATE POLICY "Users can insert their reminders"
    ON public.medication_reminders FOR INSERT
    TO authenticated
    WITH CHECK (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- UPDATE: 使用者可以更新自己長輩的提醒
CREATE POLICY "Users can update their reminders"
    ON public.medication_reminders FOR UPDATE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- DELETE: 使用者可以刪除自己長輩的提醒
CREATE POLICY "Users can delete their reminders"
    ON public.medication_reminders FOR DELETE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- Family can view related elder reminders
CREATE POLICY "Family can view related elder reminders"
    ON public.medication_reminders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = medication_reminders.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
            AND efr.can_view_health_records = true
        )
    );

COMMENT ON TABLE public.medication_reminders IS '用藥排程表 - v4.0 更新: 簡化 RLS 政策';

-- ----------------------------------------------------------------------------
-- 5.3 用藥記錄表 (medication_logs)
-- ----------------------------------------------------------------------------
CREATE TABLE public.medication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    medication_reminder_id UUID REFERENCES public.medication_reminders(id) ON DELETE SET NULL,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 排定時間 vs 實際時間
    scheduled_time TIMESTAMPTZ NOT NULL,
    actual_time TIMESTAMPTZ,

    -- 服藥狀態
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'missed', 'skipped', 'late')),

    -- 服藥資訊
    dosage_taken VARCHAR(100),
    notes TEXT,

    -- 確認方式
    confirmed_by VARCHAR(20) DEFAULT 'user',
    confirmed_by_user_id UUID REFERENCES public.user_profiles(id),
    confirmation_method VARCHAR(20),

    -- 延遲分鐘數
    delay_minutes INTEGER,

    -- 推送記錄
    push_sent BOOLEAN DEFAULT false,
    push_sent_at TIMESTAMPTZ,
    push_opened BOOLEAN DEFAULT false,
    push_opened_at TIMESTAMPTZ,

    -- 家屬通知記錄
    family_notified BOOLEAN DEFAULT false,
    family_notified_at TIMESTAMPTZ,
    family_notification_reason VARCHAR(50),

    -- 短期用藥功能 (v5.0 新增)
    dose_sequence INTEGER,
    dose_label VARCHAR(100),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 短期用藥欄位註解
COMMENT ON COLUMN public.medication_logs.dose_sequence IS '短期用藥的序號（第1次、第2次...）';
COMMENT ON COLUMN public.medication_logs.dose_label IS '顯示用的用藥標籤（例如：感冒藥-1）';

-- 索引
CREATE INDEX idx_medication_logs_medication_id ON public.medication_logs(medication_id);
CREATE INDEX idx_medication_logs_elder_id ON public.medication_logs(elder_id);
CREATE INDEX idx_medication_logs_scheduled_time ON public.medication_logs(scheduled_time);
CREATE INDEX idx_medication_logs_status ON public.medication_logs(status);
CREATE INDEX idx_medication_logs_pending ON public.medication_logs(scheduled_time, status) WHERE status = 'pending';
CREATE INDEX idx_medication_logs_dose_sequence ON public.medication_logs(medication_id, dose_sequence) WHERE dose_sequence IS NOT NULL;
CREATE INDEX idx_medication_logs_reminder_id ON public.medication_logs(medication_reminder_id) WHERE medication_reminder_id IS NOT NULL;

-- RLS (⚠️ v4.0 更新: 使用 auth_user_id 直接關聯)
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: 使用者可以查看自己長輩的用藥記錄
CREATE POLICY "Users can view their logs"
    ON public.medication_logs FOR SELECT
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- INSERT: 使用者可以新增自己長輩的用藥記錄
CREATE POLICY "Users can insert their logs"
    ON public.medication_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- UPDATE: 使用者可以更新自己長輩的用藥記錄
CREATE POLICY "Users can update their logs"
    ON public.medication_logs FOR UPDATE
    TO authenticated
    USING (
        elder_id IN (
            SELECT id FROM elders WHERE auth_user_id = auth.uid()
        )
    );

-- Family can view related elder medication logs
CREATE POLICY "Family can view related elder medication logs"
    ON public.medication_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = medication_logs.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
            AND efr.can_view_health_records = true
        )
    );

COMMENT ON TABLE public.medication_logs IS '用藥記錄表 - v4.0 更新: 簡化 RLS 政策';

-- ============================================================================
-- STEP 5.4: 圖片上傳功能 (v5.0 新增)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.4.1 圖片檔案表 (uploaded_images)
-- ----------------------------------------------------------------------------
CREATE TABLE public.uploaded_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploader_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    image_type VARCHAR(50) NOT NULL,
    related_id UUID,
    thumbnail_url TEXT,
    metadata JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_uploaded_images_uploader ON public.uploaded_images(uploader_id);
CREATE INDEX idx_uploaded_images_type ON public.uploaded_images(image_type);
CREATE INDEX idx_uploaded_images_related ON public.uploaded_images(related_id);
CREATE INDEX idx_uploaded_images_created ON public.uploaded_images(created_at DESC);
CREATE INDEX idx_uploaded_images_not_deleted ON public.uploaded_images(is_deleted) WHERE is_deleted = FALSE;

-- RLS
ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_upload_images" ON public.uploaded_images
    FOR INSERT
    WITH CHECK (
        uploader_id IN (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "users_can_view_own_images" ON public.uploaded_images
    FOR SELECT
    USING (
        uploader_id IN (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "users_can_delete_own_images" ON public.uploaded_images
    FOR UPDATE
    USING (
        uploader_id IN (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.uploaded_images IS '圖片檔案表 - 儲存所有上傳的圖片資訊';

-- ----------------------------------------------------------------------------
-- 5.4.2 藥物圖片表 (medication_images)
-- ----------------------------------------------------------------------------
CREATE TABLE public.medication_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    image_id UUID NOT NULL REFERENCES public.uploaded_images(id) ON DELETE CASCADE,
    image_type VARCHAR(50) DEFAULT 'appearance',
    description TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(medication_id, image_id)
);

-- 索引
CREATE INDEX idx_medication_images_medication ON public.medication_images(medication_id);
CREATE INDEX idx_medication_images_image ON public.medication_images(image_id);
CREATE INDEX idx_medication_images_primary ON public.medication_images(medication_id, is_primary) WHERE is_primary = TRUE;

-- RLS
ALTER TABLE public.medication_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_manage_medication_images" ON public.medication_images
    FOR ALL
    USING (
        medication_id IN (
            SELECT m.id FROM public.medications m
            WHERE m.elder_id IN (
                SELECT id FROM public.elders WHERE auth_user_id = auth.uid()
            )
        )
    );

COMMENT ON TABLE public.medication_images IS '藥物圖片表 - 連結藥物與圖片';

-- ----------------------------------------------------------------------------
-- 5.4.3 心情日記表 (mood_diaries)
-- ----------------------------------------------------------------------------
CREATE TABLE public.mood_diaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    title VARCHAR(200),
    content TEXT NOT NULL,
    mood_level INTEGER CHECK (mood_level >= 1 AND mood_level <= 5),
    mood_emoji VARCHAR(10),
    tags TEXT[],
    weather VARCHAR(50),
    location TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_mood_diaries_elder ON public.mood_diaries(elder_id);
CREATE INDEX idx_mood_diaries_created ON public.mood_diaries(created_at DESC);
CREATE INDEX idx_mood_diaries_mood_level ON public.mood_diaries(mood_level);
CREATE INDEX idx_mood_diaries_tags ON public.mood_diaries USING GIN(tags);
CREATE INDEX idx_mood_diaries_public ON public.mood_diaries(elder_id, is_private) WHERE is_private = FALSE;

-- RLS
ALTER TABLE public.mood_diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "elders_can_manage_own_diaries" ON public.mood_diaries
    FOR ALL
    USING (
        elder_id IN (
            SELECT id FROM public.elders WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "family_can_view_public_diaries" ON public.mood_diaries
    FOR SELECT
    USING (
        is_private = FALSE
        AND elder_id IN (
            SELECT efr.elder_id FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE fm.auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.mood_diaries IS '心情日記表 - 儲存長輩的心情日記';

-- ----------------------------------------------------------------------------
-- 5.4.4 心情日記圖片表 (mood_diary_images)
-- ----------------------------------------------------------------------------
CREATE TABLE public.mood_diary_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    diary_id UUID NOT NULL REFERENCES public.mood_diaries(id) ON DELETE CASCADE,
    image_id UUID NOT NULL REFERENCES public.uploaded_images(id) ON DELETE CASCADE,
    caption TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(diary_id, image_id)
);

-- 索引
CREATE INDEX idx_mood_diary_images_diary ON public.mood_diary_images(diary_id);
CREATE INDEX idx_mood_diary_images_image ON public.mood_diary_images(image_id);

-- RLS
ALTER TABLE public.mood_diary_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_manage_diary_images" ON public.mood_diary_images
    FOR ALL
    USING (
        diary_id IN (
            SELECT md.id FROM public.mood_diaries md
            WHERE md.elder_id IN (
                SELECT id FROM public.elders WHERE auth_user_id = auth.uid()
            )
        )
    );

COMMENT ON TABLE public.mood_diary_images IS '心情日記圖片表 - 連結心情日記與圖片';

-- ----------------------------------------------------------------------------
-- 5.4.5 圖片標籤表 (image_tags)
-- ----------------------------------------------------------------------------
CREATE TABLE public.image_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL REFERENCES public.uploaded_images(id) ON DELETE CASCADE,
    tag_name VARCHAR(100) NOT NULL,
    tag_type VARCHAR(50) DEFAULT 'manual',
    confidence DECIMAL(3, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(image_id, tag_name)
);

-- 索引
CREATE INDEX idx_image_tags_image ON public.image_tags(image_id);
CREATE INDEX idx_image_tags_name ON public.image_tags(tag_name);

-- RLS
ALTER TABLE public.image_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_manage_image_tags" ON public.image_tags
    FOR ALL
    USING (
        image_id IN (
            SELECT ui.id FROM public.uploaded_images ui
            WHERE ui.uploader_id IN (
                SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
            )
        )
    );

COMMENT ON TABLE public.image_tags IS '圖片標籤表 - 用於圖片的 AI 自動標記或手動標記';

-- ============================================================================
-- STEP 5.5: 地理位置功能 (v5.0 新增)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.5.1 安全區域表 (safe_zones)
-- ----------------------------------------------------------------------------
CREATE TABLE public.safe_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    center_latitude DECIMAL(10, 8) NOT NULL,
    center_longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    alert_on_exit BOOLEAN DEFAULT TRUE,
    alert_on_enter BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_radius CHECK (radius_meters > 0 AND radius_meters <= 10000)
);

-- 索引
CREATE INDEX idx_safe_zones_elder_id ON public.safe_zones(elder_id);
CREATE INDEX idx_safe_zones_active ON public.safe_zones(is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE public.safe_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_can_manage_safe_zones" ON public.safe_zones
    FOR ALL
    USING (
        elder_id IN (
            SELECT efr.elder_id FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE fm.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "elders_can_view_safe_zones" ON public.safe_zones
    FOR SELECT
    USING (
        elder_id IN (
            SELECT id FROM public.elders WHERE auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.safe_zones IS '安全區域表 - 定義長輩的安全活動範圍';

-- ----------------------------------------------------------------------------
-- 5.5.2 位置記錄表 (location_history)
-- ----------------------------------------------------------------------------
CREATE TABLE public.location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    altitude DECIMAL(8, 2),
    speed DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    address TEXT,
    city VARCHAR(100),
    district VARCHAR(100),
    country VARCHAR(100),
    battery_level INTEGER,
    is_manual BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_battery CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100))
);

-- 索引
CREATE INDEX idx_location_history_elder_id ON public.location_history(elder_id);
CREATE INDEX idx_location_history_recorded_at ON public.location_history(recorded_at DESC);
CREATE INDEX idx_location_history_elder_time ON public.location_history(elder_id, recorded_at DESC);

-- RLS
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_can_view_location_history" ON public.location_history
    FOR SELECT
    USING (
        elder_id IN (
            SELECT efr.elder_id FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE fm.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "elders_can_insert_location" ON public.location_history
    FOR INSERT
    WITH CHECK (
        elder_id IN (
            SELECT id FROM public.elders WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "elders_can_view_own_location" ON public.location_history
    FOR SELECT
    USING (
        elder_id IN (
            SELECT id FROM public.elders WHERE auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.location_history IS '位置記錄表 - 記錄長輩的位置歷史';

-- ----------------------------------------------------------------------------
-- 5.5.3 地理圍欄警示表 (geofence_alerts)
-- ----------------------------------------------------------------------------
CREATE TABLE public.geofence_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    safe_zone_id UUID REFERENCES public.safe_zones(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.location_history(id) ON DELETE SET NULL,
    alert_type VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    acknowledged_by UUID REFERENCES public.user_profiles(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_alert_type CHECK (alert_type IN ('exit', 'enter', 'sos', 'low_battery', 'inactive')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'acknowledged', 'resolved', 'false_alarm'))
);

-- 索引
CREATE INDEX idx_geofence_alerts_elder_id ON public.geofence_alerts(elder_id);
CREATE INDEX idx_geofence_alerts_status ON public.geofence_alerts(status) WHERE status = 'pending';
CREATE INDEX idx_geofence_alerts_created_at ON public.geofence_alerts(created_at DESC);
CREATE INDEX idx_geofence_alerts_elder_status ON public.geofence_alerts(elder_id, status, created_at DESC);

-- RLS
ALTER TABLE public.geofence_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_can_view_alerts" ON public.geofence_alerts
    FOR SELECT
    USING (
        elder_id IN (
            SELECT efr.elder_id FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE fm.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "family_can_acknowledge_alerts" ON public.geofence_alerts
    FOR UPDATE
    USING (
        elder_id IN (
            SELECT efr.elder_id FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE fm.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "elders_can_view_own_alerts" ON public.geofence_alerts
    FOR SELECT
    USING (
        elder_id IN (
            SELECT id FROM public.elders WHERE auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.geofence_alerts IS '地理圍欄警示表 - 記錄進出安全區域的警示';

-- ----------------------------------------------------------------------------
-- 5.5.4 家屬通知設定表 (family_geolocation_settings)
-- ----------------------------------------------------------------------------
CREATE TABLE public.family_geolocation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
    enable_exit_alerts BOOLEAN DEFAULT TRUE,
    enable_enter_alerts BOOLEAN DEFAULT FALSE,
    enable_sos_alerts BOOLEAN DEFAULT TRUE,
    enable_low_battery_alerts BOOLEAN DEFAULT TRUE,
    enable_inactive_alerts BOOLEAN DEFAULT TRUE,
    alert_methods JSONB DEFAULT '{"push": true, "email": false, "sms": false}'::jsonb,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    inactive_threshold_minutes INTEGER DEFAULT 120,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(family_member_id, elder_id)
);

-- 索引
CREATE INDEX idx_family_geolocation_settings_family ON public.family_geolocation_settings(family_member_id);
CREATE INDEX idx_family_geolocation_settings_elder ON public.family_geolocation_settings(elder_id);

-- RLS
ALTER TABLE public.family_geolocation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_can_manage_own_settings" ON public.family_geolocation_settings
    FOR ALL
    USING (
        family_member_id IN (
            SELECT id FROM public.family_members WHERE auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.family_geolocation_settings IS '家屬通知設定表 - 管理家屬的位置警示通知設定';

-- ============================================================================
-- STEP 6: 心靈照護模組
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 心情日記表 (emotional_journals)
-- ----------------------------------------------------------------------------
CREATE TABLE public.emotional_journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 日記資訊
    journal_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- 心情資料
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    mood_tags TEXT[],
    gratitude_items TEXT[],
    concerns TEXT[],
    daily_summary TEXT,

    -- AI 生成內容
    ai_insights TEXT,
    spiritual_guidance TEXT,

    -- 情緒分析結果
    emotion_analysis JSONB,

    -- 統計
    conversation_count INTEGER DEFAULT 0,

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 唯一性約束
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

COMMENT ON TABLE public.emotional_journals IS '心情日記表';

-- ----------------------------------------------------------------------------
-- 6.2 心靈內容語料庫 (spiritual_contents)
-- ----------------------------------------------------------------------------
CREATE TABLE public.spiritual_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 分類
    religion VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    emotion VARCHAR(50),

    -- 內容
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(255),
    translation TEXT,

    -- 多媒體
    audio_url TEXT,
    video_url TEXT,
    image_url TEXT,

    -- 標籤與關鍵字
    tags TEXT[],
    keywords TEXT[],

    -- 使用統計
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,

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

-- RLS
ALTER TABLE public.spiritual_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified spiritual contents"
    ON public.spiritual_contents FOR SELECT
    USING (verified = true);

COMMENT ON TABLE public.spiritual_contents IS '心靈內容語料庫';

-- 加入外鍵約束到 messages
ALTER TABLE public.messages
ADD CONSTRAINT fk_messages_spiritual_content_used
FOREIGN KEY (spiritual_content_used) REFERENCES public.spiritual_contents(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 6.3 心靈照護任務表 (spiritual_care_tasks)
-- ----------------------------------------------------------------------------
CREATE TABLE public.spiritual_care_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 任務資訊
    task_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled')),

    -- 任務詳情
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location TEXT,
    contact_info JSONB,

    -- 排程
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- 觸發原因
    triggered_by_emotion VARCHAR(50),
    related_journal_id UUID REFERENCES public.emotional_journals(id),

    -- 外部服務資訊
    external_service_id TEXT,
    external_service_type VARCHAR(50),

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

COMMENT ON TABLE public.spiritual_care_tasks IS '心靈照護任務派送與追蹤';

-- ----------------------------------------------------------------------------
-- 6.4 心靈照護週報表 (spiritual_weekly_reports)
-- ----------------------------------------------------------------------------
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
    mood_variance DECIMAL(5,2),
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

    -- 分享設定
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

COMMENT ON TABLE public.spiritual_weekly_reports IS '心靈照護週報';

-- ============================================================================
-- STEP 7: 家屬監控擴展
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7.1 長輩活動追蹤表 (elder_activity_tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE public.elder_activity_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯長輩
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 活動類型
    activity_type VARCHAR(50) NOT NULL,

    -- 活動詳情
    activity_details JSONB DEFAULT '{}',

    -- 地理位置
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_address TEXT,

    -- 設備資訊
    device_type VARCHAR(50),
    device_id VARCHAR(255),

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_activity_tracking_elder_id ON public.elder_activity_tracking(elder_id);
CREATE INDEX idx_activity_tracking_created_at ON public.elder_activity_tracking(created_at DESC);
CREATE INDEX idx_activity_tracking_type ON public.elder_activity_tracking(activity_type);

-- RLS
ALTER TABLE public.elder_activity_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family can view related elder activities"
    ON public.elder_activity_tracking FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.elder_family_relations efr
            INNER JOIN public.family_members fm ON efr.family_member_id = fm.id
            WHERE efr.elder_id = elder_activity_tracking.elder_id
            AND fm.auth_user_id = auth.uid()
            AND efr.status = 'active'
        )
    );

COMMENT ON TABLE public.elder_activity_tracking IS '長輩活動追蹤表';

-- ----------------------------------------------------------------------------
-- 7.2 家屬查看記錄表 (family_view_logs)
-- ----------------------------------------------------------------------------
CREATE TABLE public.family_view_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 關聯
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,

    -- 查看內容
    viewed_content_type VARCHAR(50) NOT NULL,
    viewed_content_id UUID,

    -- 時間戳記
    viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_family_view_logs_family_id ON public.family_view_logs(family_member_id);
CREATE INDEX idx_family_view_logs_elder_id ON public.family_view_logs(elder_id);
CREATE INDEX idx_family_view_logs_viewed_at ON public.family_view_logs(viewed_at DESC);

-- RLS
ALTER TABLE public.family_view_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family can view own view logs"
    ON public.family_view_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE id = family_view_logs.family_member_id
            AND auth_user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.family_view_logs IS '家屬查看記錄表';

-- ============================================================================
-- STEP 8: 視圖
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 8.1 情緒趨勢分析視圖
-- ----------------------------------------------------------------------------
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

COMMENT ON VIEW public.emotional_trends IS '每週情緒趨勢分析';

-- ----------------------------------------------------------------------------
-- 8.2 長輩當前用藥狀態視圖
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_elder_current_medications AS
SELECT
    m.elder_id,
    e.name AS elder_name,
    m.id AS medication_id,
    m.medication_name,
    m.dosage,
    m.status,
    m.stock_quantity,
    m.stock_alert_threshold,
    m.stock_quantity <= m.stock_alert_threshold AS stock_low,
    COUNT(mr.id) AS active_reminders,
    (
        SELECT COUNT(*)
        FROM public.medication_logs ml
        WHERE ml.medication_id = m.id
        AND ml.status = 'taken'
        AND ml.actual_time >= NOW() - INTERVAL '7 days'
    ) AS taken_last_7_days,
    (
        SELECT COUNT(*)
        FROM public.medication_logs ml
        WHERE ml.medication_id = m.id
        AND ml.status = 'missed'
        AND ml.scheduled_time >= NOW() - INTERVAL '7 days'
    ) AS missed_last_7_days
FROM
    public.medications m
    INNER JOIN public.elders e ON m.elder_id = e.id
    LEFT JOIN public.medication_reminders mr ON m.id = mr.medication_id AND mr.is_enabled = true
WHERE
    m.status = 'active'
    AND m.deleted_at IS NULL
GROUP BY
    m.elder_id, e.name, m.id, m.medication_name, m.dosage, m.status,
    m.stock_quantity, m.stock_alert_threshold;

COMMENT ON VIEW public.v_elder_current_medications IS '長輩當前用藥狀態視圖';

-- ----------------------------------------------------------------------------
-- 8.3 今日待服藥清單視圖
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_today_medication_schedule AS
SELECT
    ml.id,
    ml.elder_id,
    e.name AS elder_name,
    ml.medication_id,
    m.medication_name,
    m.dosage,
    ml.scheduled_time,
    ml.actual_time,
    ml.status,
    ml.delay_minutes,
    ml.push_sent,
    ml.push_opened,
    CASE
        WHEN ml.status = 'taken' THEN 'success'
        WHEN ml.status = 'missed' THEN 'danger'
        WHEN ml.scheduled_time < NOW() AND ml.status = 'pending' THEN 'warning'
        ELSE 'info'
    END AS status_color
FROM
    public.medication_logs ml
    INNER JOIN public.elders e ON ml.elder_id = e.id
    INNER JOIN public.medications m ON ml.medication_id = m.id
WHERE
    ml.scheduled_time::DATE = CURRENT_DATE
ORDER BY
    ml.scheduled_time;

COMMENT ON VIEW public.v_today_medication_schedule IS '今日用藥排程視圖';

-- ----------------------------------------------------------------------------
-- 8.4 短期用藥進度視圖 (v5.0 新增)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_short_term_medication_progress AS
SELECT
    mr.id AS reminder_id,
    m.id AS medication_id,
    m.medication_name,
    e.id AS elder_id,
    e.name AS elder_name,
    mr.start_date,
    mr.end_date,
    mr.total_doses,
    mr.doses_completed,
    CASE
        WHEN mr.total_doses > 0 THEN
            ROUND((mr.doses_completed::NUMERIC / mr.total_doses::NUMERIC) * 100, 2)
        ELSE 0
    END AS completion_percentage,
    CASE
        WHEN mr.total_doses IS NOT NULL THEN mr.total_doses - mr.doses_completed
        ELSE NULL
    END AS remaining_doses,
    CASE
        WHEN mr.total_doses IS NOT NULL AND mr.doses_completed >= mr.total_doses THEN true
        ELSE false
    END AS is_completed,
    mr.is_enabled,
    mr.created_at,
    mr.updated_at
FROM public.medication_reminders mr
JOIN public.medications m ON mr.medication_id = m.id
JOIN public.elders e ON mr.elder_id = e.id
WHERE mr.is_short_term = true
ORDER BY mr.created_at DESC;

COMMENT ON VIEW public.v_short_term_medication_progress IS '短期用藥完成進度檢視';

-- ============================================================================
-- STEP 9: 觸發器與自動化
-- ============================================================================

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

CREATE TRIGGER trigger_medications_updated_at
    BEFORE UPDATE ON public.medications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_medication_reminders_updated_at
    BEFORE UPDATE ON public.medication_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_medication_logs_updated_at
    BEFORE UPDATE ON public.medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- v5.0 新增：圖片上傳功能觸發器
CREATE TRIGGER update_uploaded_images_updated_at
    BEFORE UPDATE ON public.uploaded_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mood_diaries_updated_at
    BEFORE UPDATE ON public.mood_diaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- v5.0 新增：地理位置功能觸發器
CREATE TRIGGER update_safe_zones_updated_at
    BEFORE UPDATE ON public.safe_zones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_geolocation_settings_updated_at
    BEFORE UPDATE ON public.family_geolocation_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- v5.0 新增：短期用藥自動更新已完成次數觸發器
CREATE OR REPLACE FUNCTION update_doses_completed()
RETURNS TRIGGER AS $$
BEGIN
    -- 只在狀態變更為 'taken' 或 'late' 時更新
    IF NEW.status IN ('taken', 'late')
       AND (OLD.status IS NULL OR OLD.status NOT IN ('taken', 'late'))
       AND NEW.medication_reminder_id IS NOT NULL THEN

        -- 更新對應的 reminder 的已完成次數
        UPDATE public.medication_reminders
        SET doses_completed = doses_completed + 1,
            updated_at = NOW()
        WHERE id = NEW.medication_reminder_id
          AND is_short_term = true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_doses_completed
    AFTER UPDATE OF status ON public.medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_doses_completed();

-- 對話計數更新觸發器
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET
        message_count = message_count + 1,
        user_message_count = CASE WHEN NEW.role = 'user' THEN user_message_count + 1 ELSE user_message_count END,
        ai_message_count = CASE WHEN NEW.role = 'assistant' THEN ai_message_count + 1 ELSE ai_message_count END
    WHERE id = NEW.conversation_id;

    -- 檢查是否需要觸發總結（每 20 次對話）
    UPDATE public.conversations
    SET needs_summary = true
    WHERE id = NEW.conversation_id
    AND message_count % 20 = 0
    AND needs_summary = false;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_count AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();

-- 自動更新統計資訊
CREATE OR REPLACE FUNCTION public.fn_update_medication_reminder_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.medication_reminders
        SET
            total_reminders_sent = total_reminders_sent + 1,
            last_reminder_at = NEW.scheduled_time
        WHERE id = NEW.medication_reminder_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'taken' AND OLD.status != 'taken' THEN
            UPDATE public.medication_reminders
            SET total_taken = total_taken + 1
            WHERE id = NEW.medication_reminder_id;
        ELSIF NEW.status = 'missed' AND OLD.status != 'missed' THEN
            UPDATE public.medication_reminders
            SET total_missed = total_missed + 1
            WHERE id = NEW.medication_reminder_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_reminder_stats
    AFTER INSERT OR UPDATE ON public.medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_medication_reminder_stats();

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
-- STEP 9.5: 圖片上傳輔助函數 (v5.0 新增)
-- ============================================================================

-- 取得藥物的所有圖片
CREATE OR REPLACE FUNCTION public.get_medication_images(p_medication_id UUID)
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
    FROM public.uploaded_images ui
    INNER JOIN public.medication_images mi ON ui.id = mi.image_id
    WHERE mi.medication_id = p_medication_id
      AND ui.is_deleted = FALSE
    ORDER BY mi.is_primary DESC, mi.display_order, ui.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 取得心情日記的所有圖片
CREATE OR REPLACE FUNCTION public.get_diary_images(p_diary_id UUID)
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
    FROM public.uploaded_images ui
    INNER JOIN public.mood_diary_images mdi ON ui.id = mdi.image_id
    WHERE mdi.diary_id = p_diary_id
      AND ui.is_deleted = FALSE
    ORDER BY mdi.display_order, ui.created_at;
END;
$$ LANGUAGE plpgsql;

-- 計算使用者已使用的儲存空間
CREATE OR REPLACE FUNCTION public.get_user_storage_usage(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
    total_size BIGINT;
BEGIN
    SELECT COALESCE(SUM(file_size), 0)
    INTO total_size
    FROM public.uploaded_images
    WHERE uploader_id = p_user_id
      AND is_deleted = FALSE;

    RETURN total_size;
END;
$$ LANGUAGE plpgsql;

-- 軟刪除圖片
CREATE OR REPLACE FUNCTION public.soft_delete_image(p_image_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.uploaded_images
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = p_image_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 清理已刪除圖片
CREATE OR REPLACE FUNCTION public.cleanup_deleted_images(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.uploaded_images
    WHERE is_deleted = TRUE
      AND updated_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 找出孤立的圖片
CREATE OR REPLACE FUNCTION public.find_orphaned_images()
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
    FROM public.uploaded_images ui
    WHERE ui.is_deleted = FALSE
      AND ui.id NOT IN (
          SELECT image_id FROM public.medication_images
          UNION
          SELECT image_id FROM public.mood_diary_images
      )
      AND ui.created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 9.6: 地理位置輔助函數 (v5.0 新增)
-- ============================================================================

-- 計算兩點之間的距離（Haversine公式）
CREATE OR REPLACE FUNCTION public.calculate_distance(
    lat1 DECIMAL, lon1 DECIMAL, lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    r DECIMAL := 6371000;  -- 地球半徑（公尺）
    dlat DECIMAL;
    dlon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 檢查位置是否在安全區域內
CREATE OR REPLACE FUNCTION public.is_in_safe_zone(
    p_latitude DECIMAL, p_longitude DECIMAL, p_elder_id UUID
) RETURNS TABLE(safe_zone_id UUID, safe_zone_name VARCHAR(100), distance_meters DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT sz.id, sz.name,
        public.calculate_distance(p_latitude, p_longitude, sz.center_latitude, sz.center_longitude) AS distance
    FROM public.safe_zones sz
    WHERE sz.elder_id = p_elder_id AND sz.is_active = TRUE
      AND public.calculate_distance(p_latitude, p_longitude, sz.center_latitude, sz.center_longitude) <= sz.radius_meters
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql;

-- 取得最新位置
CREATE OR REPLACE FUNCTION public.get_latest_location(p_elder_id UUID)
RETURNS TABLE(latitude DECIMAL, longitude DECIMAL, address TEXT, recorded_at TIMESTAMPTZ, battery_level INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT lh.latitude, lh.longitude, lh.address, lh.recorded_at, lh.battery_level
    FROM public.location_history lh
    WHERE lh.elder_id = p_elder_id
    ORDER BY lh.recorded_at DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 清理舊的位置記錄
CREATE OR REPLACE FUNCTION public.cleanup_old_location_history(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.location_history
    WHERE recorded_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND id NOT IN (
        SELECT DISTINCT ON (elder_id) id FROM public.location_history
        ORDER BY elder_id, recorded_at DESC
    );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 10: 初始化心靈內容語料（種子資料）
-- ============================================================================

INSERT INTO public.spiritual_contents (religion, category, emotion, title, content, source, translation, tags, keywords, verified) VALUES
-- 佛教經文
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
    RAISE NOTICE '✅ ElderCare Companion v5.0 完整資料庫 Schema 建置完成！';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ v5.0 新增功能:';
    RAISE NOTICE '  • 短期用藥管理（次數控制、進度追蹤、自動序號）';
    RAISE NOTICE '  • 圖片上傳功能（藥物外觀、心情日記配圖）';
    RAISE NOTICE '  • 地理位置追蹤（安全區域、位置記錄、地理圍欄警示）';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ v4.0 重要更新:';
    RAISE NOTICE '  • elders 表增加 auth_user_id 必填欄位（直接關聯 auth.users）';
    RAISE NOTICE '  • 簡化 RLS 政策（medications, medication_reminders, medication_logs）';
    RAISE NOTICE '  • 使用 auth_user_id 直接比對，提升查詢效率和安全性';
    RAISE NOTICE '';
    RAISE NOTICE '已建立的核心系統:';
    RAISE NOTICE '  1. 使用者認證系統 (Supabase Auth + OAuth)';
    RAISE NOTICE '  2. 用藥提醒系統 (FCM 推送 + Email 通知 + Cron 排程)';
    RAISE NOTICE '  3. 短期用藥管理 (次數控制 + 進度追蹤 + 自動完成偵測)';
    RAISE NOTICE '  4. 心靈照護模組 (情緒分析 + Agentic RAG)';
    RAISE NOTICE '  5. 圖片上傳系統 (藥物拍照 + 心情日記配圖 + 標籤管理)';
    RAISE NOTICE '  6. 地理位置追蹤 (安全區域 + 位置記錄 + 警示通知)';
    RAISE NOTICE '  7. 家屬監控系統 (活動追蹤 + 隱私審計)';
    RAISE NOTICE '';
    RAISE NOTICE '資料表總數: 30 個';
    RAISE NOTICE '  - 原有: 21 個';
    RAISE NOTICE '  - 新增: 9 個（5個圖片相關 + 4個地理位置相關）';
    RAISE NOTICE '';
    RAISE NOTICE '視圖數量: 4 個';
    RAISE NOTICE '  - 原有: 3 個';
    RAISE NOTICE '  - 新增: 1 個（短期用藥進度視圖）';
    RAISE NOTICE '';
    RAISE NOTICE '函數總數: 17 個';
    RAISE NOTICE '  - 原有: 5 個';
    RAISE NOTICE '  - 新增: 12 個（6個圖片相關 + 4個地理位置相關 + 2個短期用藥相關）';
    RAISE NOTICE '';
    RAISE NOTICE '索引優化: 新增 10+ 個索引以提升查詢效能';
    RAISE NOTICE '';
    RAISE NOTICE '種子資料: 20+ 條心靈語料';
    RAISE NOTICE '';
    RAISE NOTICE '新增的表格:';
    RAISE NOTICE '  圖片上傳功能:';
    RAISE NOTICE '    - uploaded_images: 圖片檔案主表';
    RAISE NOTICE '    - medication_images: 藥物圖片關聯表';
    RAISE NOTICE '    - mood_diaries: 心情日記表';
    RAISE NOTICE '    - mood_diary_images: 心情日記圖片關聯表';
    RAISE NOTICE '    - image_tags: 圖片標籤表（支援 AI 自動標記）';
    RAISE NOTICE '  地理位置功能:';
    RAISE NOTICE '    - safe_zones: 安全區域定義表';
    RAISE NOTICE '    - location_history: 位置記錄表';
    RAISE NOTICE '    - geofence_alerts: 地理圍欄警示表';
    RAISE NOTICE '    - family_geolocation_settings: 家屬通知設定表';
    RAISE NOTICE '';
    RAISE NOTICE '新增的欄位:';
    RAISE NOTICE '  medication_reminders:';
    RAISE NOTICE '    - is_short_term: 是否為短期用藥';
    RAISE NOTICE '    - total_doses: 總服用次數';
    RAISE NOTICE '    - doses_completed: 已完成次數';
    RAISE NOTICE '  medication_logs:';
    RAISE NOTICE '    - dose_sequence: 用藥序號';
    RAISE NOTICE '    - dose_label: 用藥標籤';
    RAISE NOTICE '';
    RAISE NOTICE '新增的函數:';
    RAISE NOTICE '  圖片管理:';
    RAISE NOTICE '    - get_medication_images(): 取得藥物圖片';
    RAISE NOTICE '    - get_diary_images(): 取得日記圖片';
    RAISE NOTICE '    - get_user_storage_usage(): 計算儲存空間';
    RAISE NOTICE '    - soft_delete_image(): 軟刪除圖片';
    RAISE NOTICE '    - cleanup_deleted_images(): 清理已刪除圖片';
    RAISE NOTICE '    - find_orphaned_images(): 找出孤立圖片';
    RAISE NOTICE '  地理位置:';
    RAISE NOTICE '    - calculate_distance(): 計算兩點距離（Haversine）';
    RAISE NOTICE '    - is_in_safe_zone(): 檢查是否在安全區域';
    RAISE NOTICE '    - get_latest_location(): 取得最新位置';
    RAISE NOTICE '    - cleanup_old_location_history(): 清理舊位置記錄';
    RAISE NOTICE '  短期用藥:';
    RAISE NOTICE '    - update_doses_completed(): 自動更新完成次數（觸發器）';
    RAISE NOTICE '';
    RAISE NOTICE '下一步:';
    RAISE NOTICE '  1. 啟動後端服務 (npm start)';
    RAISE NOTICE '  2. 測試 API 端點 (http://localhost:3000)';
    RAISE NOTICE '  3. 測試前端功能:';
    RAISE NOTICE '     - 用藥管理: http://localhost:8080/medications.html';
    RAISE NOTICE '     - 短期用藥: 測試次數控制和進度追蹤';
    RAISE NOTICE '     - 圖片上傳: 測試藥物拍照和心情日記配圖';
    RAISE NOTICE '     - 位置追蹤: 測試安全區域和位置記錄';
    RAISE NOTICE '  4. 設定 Supabase Storage Bucket (eldercare-images)';
    RAISE NOTICE '  5. 使用診斷工具驗證功能完整性';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 注意事項:';
    RAISE NOTICE '  • 圖片上傳需在 Supabase Dashboard 創建 Storage Bucket';
    RAISE NOTICE '  • 地理位置功能需啟用 PostGIS 擴展（已自動啟用）';
    RAISE NOTICE '  • 短期用藥會自動追蹤完成進度，無需手動更新';
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
END $$;

COMMENT ON SCHEMA public IS 'ElderCare Companion v5.0 - 完整系統 Schema（含短期用藥、圖片上傳、地理位置功能）';
