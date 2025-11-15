-- ============================================
-- Google Calendar Integration - Database Migration
-- ============================================
-- Purpose: Add tables and columns needed for Google Calendar sync
-- Created: 2025-11-15
-- ============================================

-- 1. Create google_calendar_tokens table
-- Stores OAuth tokens for Google Calendar API access
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one token record per user
  CONSTRAINT unique_user_token UNIQUE (user_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id
ON google_calendar_tokens(user_id);

-- Add index for expiry checks
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_expires_at
ON google_calendar_tokens(expires_at);

-- 2. Add calendar_event_id column to medication_reminders table
-- Stores Google Calendar event IDs (comma-separated for multiple events)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medication_reminders'
    AND column_name = 'calendar_event_id'
  ) THEN
    ALTER TABLE medication_reminders
    ADD COLUMN calendar_event_id TEXT;
  END IF;
END $$;

-- Add comment to explain the column
COMMENT ON COLUMN medication_reminders.calendar_event_id IS
'Google Calendar event IDs (comma-separated for multiple daily events). Format: "eventId1,eventId2,eventId3"';

-- 3. Enable Row Level Security (RLS) on google_calendar_tokens
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only access their own tokens
CREATE POLICY google_calendar_tokens_user_policy ON google_calendar_tokens
  FOR ALL
  USING (auth.uid() = user_id);

-- 4. Create updated_at trigger for google_calendar_tokens
CREATE OR REPLACE FUNCTION update_google_calendar_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER google_calendar_tokens_updated_at_trigger
  BEFORE UPDATE ON google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_calendar_tokens_updated_at();

-- ============================================
-- Verification Queries
-- ============================================

-- Check if table was created successfully
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'google_calendar_tokens'
ORDER BY ordinal_position;

-- Check if medication_reminders column was added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'medication_reminders'
  AND column_name = 'calendar_event_id';

-- ============================================
-- Rollback Script (if needed)
-- ============================================

-- To rollback these changes, run:
-- DROP TRIGGER IF EXISTS google_calendar_tokens_updated_at_trigger ON google_calendar_tokens;
-- DROP FUNCTION IF EXISTS update_google_calendar_tokens_updated_at();
-- DROP TABLE IF EXISTS google_calendar_tokens CASCADE;
-- ALTER TABLE medication_reminders DROP COLUMN IF EXISTS calendar_event_id;
