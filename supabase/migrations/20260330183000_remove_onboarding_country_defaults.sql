-- Remove misleading onboarding country defaults.
-- These fields should remain NULL until the user actually confirms them.

ALTER TABLE public.onboarding_data
  ALTER COLUMN citizenship_country DROP DEFAULT,
  ALTER COLUMN residence_country DROP DEFAULT,
  ALTER COLUMN address_country DROP DEFAULT;

-- Clear country placeholders on rows that have not reached the relevant steps yet.
-- Step 4 owns citizenship/residence.
UPDATE public.onboarding_data
SET
  citizenship_country = NULL,
  residence_country = NULL,
  updated_at = now()
WHERE COALESCE(current_step, 0) < 4
  AND (
    citizenship_country IS NOT NULL
    OR residence_country IS NOT NULL
  );

-- Step 8 owns address country.
UPDATE public.onboarding_data
SET
  address_country = NULL,
  updated_at = now()
WHERE COALESCE(current_step, 0) < 8
  AND address_country IS NOT NULL;
