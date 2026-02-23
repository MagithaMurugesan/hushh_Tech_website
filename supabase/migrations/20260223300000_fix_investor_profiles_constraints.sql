-- Fix investor_profiles constraints that were blocking auto-creation
-- Root cause: NOT NULL constraints + phone unique constraint prevented
-- the profile page from auto-creating rows for completed users.

-- 1. Make phone fields nullable with defaults
ALTER TABLE investor_profiles ALTER COLUMN phone_country_code SET DEFAULT '+1';
ALTER TABLE investor_profiles ALTER COLUMN phone_country_code DROP NOT NULL;
ALTER TABLE investor_profiles ALTER COLUMN phone_number SET DEFAULT '';
ALTER TABLE investor_profiles ALTER COLUMN phone_number DROP NOT NULL;

-- 2. Make investor_profile and organisation nullable
ALTER TABLE investor_profiles ALTER COLUMN investor_profile DROP NOT NULL;
ALTER TABLE investor_profiles ALTER COLUMN investor_profile SET DEFAULT NULL;
ALTER TABLE investor_profiles ALTER COLUMN organisation DROP NOT NULL;
ALTER TABLE investor_profiles ALTER COLUMN organisation SET DEFAULT NULL;

-- 3. Add missing columns
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS shadow_profile JSONB DEFAULT NULL;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ DEFAULT NULL;

-- 4. Drop overly restrictive phone unique constraint
-- (blocks inserts when users don't have phone yet)
ALTER TABLE investor_profiles DROP CONSTRAINT IF EXISTS investor_profiles_phone_unique;
