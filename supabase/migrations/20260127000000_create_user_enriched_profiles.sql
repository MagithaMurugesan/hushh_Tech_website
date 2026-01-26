-- Create table for storing AI-enriched user profiles from hushh-profile-search API
-- This data is used to pre-populate onboarding forms and display on profile dashboard

CREATE TABLE IF NOT EXISTS user_enriched_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identity Core (parsed from API)
  age INT,
  dob DATE,
  occupation TEXT,
  nationality TEXT,
  marital_status TEXT,
  
  -- Address (structured JSONB for flexibility)
  address JSONB DEFAULT '{}',
  -- Example: {"line1": "123 Main St", "city": "SF", "state": "CA", "zipCode": "94102", "country": "USA"}
  
  -- Phone (structured JSONB)
  phone JSONB DEFAULT '{}',
  -- Example: {"countryCode": "+1", "number": "5551234567"}
  
  -- Preferences (30+ categories stored as JSONB for flexibility)
  preferences JSONB DEFAULT '{}',
  -- Contains all preference fields from API (diet, hobbies, brands, travel, etc.)
  
  -- AI Confidence & Metadata
  confidence FLOAT DEFAULT 0,
  net_worth_score INT DEFAULT 0,
  net_worth_context TEXT,
  
  -- Search context
  search_query TEXT,
  raw_api_response JSONB,
  sources JSONB DEFAULT '[]',
  
  -- Field source tracking (which fields were AI-suggested vs user-edited)
  field_sources JSONB DEFAULT '{}',
  -- Example: {"nationality": "ai_suggested", "phone": "user_edited"}
  
  -- Status
  is_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint on user_id
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_enriched_profiles_user_id ON user_enriched_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_enriched_profiles_confidence ON user_enriched_profiles(confidence);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_enriched_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_enriched_profiles_updated_at ON user_enriched_profiles;
CREATE TRIGGER trigger_update_user_enriched_profiles_updated_at
  BEFORE UPDATE ON user_enriched_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_enriched_profiles_updated_at();

-- RLS Policies
ALTER TABLE user_enriched_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own enriched profile
CREATE POLICY "Users can view own enriched profile"
  ON user_enriched_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own enriched profile
CREATE POLICY "Users can insert own enriched profile"
  ON user_enriched_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own enriched profile
CREATE POLICY "Users can update own enriched profile"
  ON user_enriched_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do anything (for API calls)
CREATE POLICY "Service role can manage all enriched profiles"
  ON user_enriched_profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE user_enriched_profiles IS 'Stores AI-enriched user profiles from hushh-profile-search API. Used for onboarding pre-population and profile dashboard display.';
COMMENT ON COLUMN user_enriched_profiles.preferences IS 'JSONB containing 30+ preference categories (diet, hobbies, travel, entertainment, etc.)';
COMMENT ON COLUMN user_enriched_profiles.field_sources IS 'Tracks which fields were AI-suggested vs user-edited for analytics and trust scoring';
