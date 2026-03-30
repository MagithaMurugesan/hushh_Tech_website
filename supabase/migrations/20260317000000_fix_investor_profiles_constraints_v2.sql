-- =====================================================
-- Fix investor_profiles constraints
-- 1. Widen age CHECK from (18-100) to (18-120)
-- 2. Drop email UNIQUE constraint (user_id UNIQUE is sufficient)
-- 3. Make age nullable with default 30 for auto-creation flow
-- =====================================================

-- 1. Drop old age CHECK and add wider range
ALTER TABLE investor_profiles DROP CONSTRAINT IF EXISTS investor_profiles_age_check;
ALTER TABLE investor_profiles ADD CONSTRAINT investor_profiles_age_check CHECK (age >= 18 AND age <= 120);

-- 2. Drop email unique constraint — user_id is the real identifier
-- Email uniqueness can block legitimate flows (multi-provider auth)
ALTER TABLE investor_profiles DROP CONSTRAINT IF EXISTS investor_profiles_email_key;

-- 3. Make age nullable with default for auto-creation flow
ALTER TABLE investor_profiles ALTER COLUMN age DROP NOT NULL;
ALTER TABLE investor_profiles ALTER COLUMN age SET DEFAULT 30;

-- 4. Make name and email nullable for auto-creation edge cases
ALTER TABLE investor_profiles ALTER COLUMN name DROP NOT NULL;
ALTER TABLE investor_profiles ALTER COLUMN name SET DEFAULT '';
ALTER TABLE investor_profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE investor_profiles ALTER COLUMN email SET DEFAULT '';
