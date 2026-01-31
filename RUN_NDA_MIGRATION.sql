-- =====================================================
-- NDA PERSISTENCE FIX - Run this in Supabase SQL Editor
-- =====================================================
-- This migration adds the NDA tracking columns and RPC functions
-- that are REQUIRED for the global NDA gate to work properly.
-- 
-- After running this, users who sign the NDA will have their
-- status persisted and won't need to sign again on each login.
-- =====================================================

-- Step 1: Add NDA tracking columns to onboarding_data table
ALTER TABLE onboarding_data 
ADD COLUMN IF NOT EXISTS nda_signed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS nda_pdf_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS nda_version TEXT DEFAULT 'v1.0',
ADD COLUMN IF NOT EXISTS nda_signer_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS nda_signer_ip TEXT DEFAULT NULL;

-- Step 2: Create index for efficient NDA status checks
CREATE INDEX IF NOT EXISTS idx_onboarding_data_nda_signed 
ON onboarding_data(user_id) 
WHERE nda_signed_at IS NOT NULL;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN onboarding_data.nda_signed_at IS 'Timestamp when user signed the global NDA';
COMMENT ON COLUMN onboarding_data.nda_pdf_url IS 'URL to the signed NDA PDF in storage';
COMMENT ON COLUMN onboarding_data.nda_version IS 'Version of the NDA that was signed';
COMMENT ON COLUMN onboarding_data.nda_signer_name IS 'Full legal name provided during NDA signing';
COMMENT ON COLUMN onboarding_data.nda_signer_ip IS 'IP address at time of NDA signing for audit';

-- Step 4: Create or replace the RPC function to check NDA status
CREATE OR REPLACE FUNCTION check_user_nda_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'hasSignedNda', nda_signed_at IS NOT NULL,
    'signedAt', nda_signed_at,
    'ndaVersion', nda_version,
    'signerName', nda_signer_name
  ) INTO result
  FROM onboarding_data
  WHERE user_id = p_user_id;
  
  -- If no record found, return default (not signed)
  IF result IS NULL THEN
    RETURN jsonb_build_object(
      'hasSignedNda', false,
      'signedAt', null,
      'ndaVersion', null,
      'signerName', null
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Step 5: Create or replace the RPC function to record NDA signature
CREATE OR REPLACE FUNCTION sign_global_nda(
  p_signer_name TEXT,
  p_nda_version TEXT DEFAULT 'v1.0',
  p_pdf_url TEXT DEFAULT NULL,
  p_signer_ip TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  result JSONB;
BEGIN
  -- Get current user ID from auth context
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Update or insert NDA signature (upsert pattern)
  INSERT INTO onboarding_data (
    user_id, 
    nda_signed_at, 
    nda_signer_name, 
    nda_version, 
    nda_pdf_url, 
    nda_signer_ip, 
    updated_at
  )
  VALUES (
    v_user_id, 
    NOW(), 
    p_signer_name, 
    p_nda_version, 
    p_pdf_url, 
    p_signer_ip, 
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    nda_signed_at = NOW(),
    nda_signer_name = p_signer_name,
    nda_version = p_nda_version,
    nda_pdf_url = COALESCE(p_pdf_url, onboarding_data.nda_pdf_url),
    nda_signer_ip = p_signer_ip,
    updated_at = NOW();
  
  RETURN jsonb_build_object(
    'success', true,
    'signedAt', NOW(),
    'signerName', p_signer_name,
    'ndaVersion', p_nda_version
  );
END;
$$;

-- Step 6: Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_user_nda_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sign_global_nda(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Step 7: Verify the migration ran successfully
DO $$
DECLARE
  col_count INTEGER;
  func_count INTEGER;
BEGIN
  -- Check columns exist
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns 
  WHERE table_name = 'onboarding_data' 
  AND column_name IN ('nda_signed_at', 'nda_pdf_url', 'nda_version', 'nda_signer_name', 'nda_signer_ip');
  
  -- Check functions exist
  SELECT COUNT(*) INTO func_count
  FROM pg_proc 
  WHERE proname IN ('check_user_nda_status', 'sign_global_nda');
  
  IF col_count >= 5 AND func_count >= 2 THEN
    RAISE NOTICE '✅ NDA migration successful! Columns: %, Functions: %', col_count, func_count;
  ELSE
    RAISE WARNING '⚠️ Migration may be incomplete. Columns: %, Functions: %', col_count, func_count;
  END IF;
END;
$$;

-- =====================================================
-- DONE! After running this:
-- 1. Deploy the nda-signed-notification Supabase function
-- 2. Test by signing out and signing back in
-- 3. Sign the NDA - it should now persist
-- =====================================================
