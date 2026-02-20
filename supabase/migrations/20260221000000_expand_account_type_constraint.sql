-- Migration: Expand account_type constraint
-- Description: Adds 'individual', 'joint', 'trust' values to the account_type CHECK constraint.
-- These values are used by the onboarding Step 5 and the investor profile page.
-- Existing values ('wealth_1m', 'wealth_5m', 'ultra_25m', 'general', 'retirement') are preserved.

DO $$
BEGIN
  -- Drop the old constraint
  ALTER TABLE public.onboarding_data
  DROP CONSTRAINT IF EXISTS onboarding_data_account_type_check;

  -- Add updated constraint with both legacy and new UI values
  ALTER TABLE public.onboarding_data
  ADD CONSTRAINT onboarding_data_account_type_check
  CHECK (account_type = ANY (ARRAY[
    -- Legacy tier-based values
    'wealth_1m', 'wealth_5m', 'ultra_25m',
    -- Legacy category values
    'general', 'retirement',
    -- New onboarding UI values (Step 5 + profile page)
    'individual', 'joint', 'trust'
  ]));

  RAISE NOTICE 'Successfully expanded account_type constraint to include individual, joint, trust';
END $$;
