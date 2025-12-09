-- Migration: 添加家屬設定表
-- 用途：存儲家屬的個人化設定（通知偏好、警示閾值、語言偏好）
-- 建立時間: 2025-12-09

-- 創建 family_settings 表
CREATE TABLE IF NOT EXISTS family_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,

    -- 通知偏好 (JSONB)
    notification_preferences JSONB DEFAULT '{
        "email": true,
        "sms": false,
        "push": true
    }'::jsonb,

    -- 警示閾值設定 (JSONB)
    alert_thresholds JSONB DEFAULT '{
        "medication_compliance": 70,
        "missed_medication": 2,
        "safe_zone_alert": true
    }'::jsonb,

    -- 語言偏好
    language_preference VARCHAR(10) DEFAULT 'zh-TW',

    -- 時間戳記
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 確保每個家屬成員只有一個設定記錄
    UNIQUE(family_member_id)
);

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_family_settings_family_member_id ON family_settings(family_member_id);

-- 添加註釋
COMMENT ON TABLE family_settings IS '家屬個人化設定表';
COMMENT ON COLUMN family_settings.family_member_id IS '家屬成員 ID (外鍵)';
COMMENT ON COLUMN family_settings.notification_preferences IS '通知偏好 (email, sms, push)';
COMMENT ON COLUMN family_settings.alert_thresholds IS '警示閾值設定 (medication_compliance, missed_medication, safe_zone_alert)';
COMMENT ON COLUMN family_settings.language_preference IS '語言偏好 (zh-TW, zh-CN, en-US)';

-- 創建觸發器以自動更新 updated_at
CREATE OR REPLACE FUNCTION update_family_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_family_settings_updated_at
    BEFORE UPDATE ON family_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_family_settings_updated_at();

-- RLS (Row Level Security) 策略
ALTER TABLE family_settings ENABLE ROW LEVEL SECURITY;

-- 允許家屬成員查看自己的設定
CREATE POLICY "家屬可以查看自己的設定"
    ON family_settings
    FOR SELECT
    USING (
        family_member_id IN (
            SELECT id FROM family_members WHERE auth_user_id = auth.uid()
        )
    );

-- 允許家屬成員插入自己的設定
CREATE POLICY "家屬可以插入自己的設定"
    ON family_settings
    FOR INSERT
    WITH CHECK (
        family_member_id IN (
            SELECT id FROM family_members WHERE auth_user_id = auth.uid()
        )
    );

-- 允許家屬成員更新自己的設定
CREATE POLICY "家屬可以更新自己的設定"
    ON family_settings
    FOR UPDATE
    USING (
        family_member_id IN (
            SELECT id FROM family_members WHERE auth_user_id = auth.uid()
        )
    );

-- 允許家屬成員刪除自己的設定
CREATE POLICY "家屬可以刪除自己的設定"
    ON family_settings
    FOR DELETE
    USING (
        family_member_id IN (
            SELECT id FROM family_members WHERE auth_user_id = auth.uid()
        )
    );
