-- Migration: Add AI prefill tracking columns to onboarding_data
-- This tracks when AI-powered profile search has pre-filled user data

-- Add columns to track AI pre-fill status
ALTER TABLE onboarding_data 
ADD COLUMN IF NOT EXISTS ai_prefilled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_prefilled_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN onboarding_data.ai_prefilled IS 'Whether this record was pre-filled using AI-powered web intelligence';
COMMENT ON COLUMN onboarding_data.ai_prefilled_at IS 'Timestamp when AI pre-fill occurred';

-- Create index for querying AI-prefilled records
CREATE INDEX IF NOT EXISTS idx_onboarding_data_ai_prefilled 
ON onboarding_data(ai_prefilled) 
WHERE ai_prefilled = TRUE;
