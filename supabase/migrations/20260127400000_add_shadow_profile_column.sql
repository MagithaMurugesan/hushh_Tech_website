-- Add shadow_profile column to investor_profiles for storing Shadow Investigator results
-- This enables data persistence so shared profile links can display shadow profile data

ALTER TABLE public.investor_profiles
ADD COLUMN IF NOT EXISTS shadow_profile JSONB DEFAULT NULL;

-- Add index for faster queries on shadow_profile
CREATE INDEX IF NOT EXISTS idx_investor_profiles_shadow_profile
ON public.investor_profiles USING gin (shadow_profile);

-- Add comment for documentation
COMMENT ON COLUMN public.investor_profiles.shadow_profile IS
'Stores the Shadow Investigator profile data (OSINT-based profile enrichment from Gemini 3 Pro Preview with Google Search grounding)';
