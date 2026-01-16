-- =====================================================
-- Add Email OTP Authentication to Hushh Agent
-- =====================================================
-- This migration adds email field and email OTP table
-- for passwordless email authentication

-- Step 1: Add email column to hushh_agent_users
ALTER TABLE public.hushh_agent_users
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Make phone_number optional (since user can auth via email OR phone)
ALTER TABLE public.hushh_agent_users
ALTER COLUMN phone_number DROP NOT NULL;

-- Add check constraint: user must have email OR phone
ALTER TABLE public.hushh_agent_users
ADD CONSTRAINT email_or_phone_required 
CHECK (email IS NOT NULL OR phone_number IS NOT NULL);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_hushh_agent_users_email 
    ON public.hushh_agent_users(email);

-- =====================================================
-- Email OTP Storage Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.hushh_agent_email_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Email address
    email TEXT NOT NULL,
    
    -- 6-digit OTP code (hashed for security)
    otp_hash TEXT NOT NULL,
    
    -- Expiry time (5 minutes from creation)
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Track attempts (max 3 attempts per OTP)
    attempts INT DEFAULT 0,
    
    -- Status
    verified BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

-- Index for quick email+time lookups
CREATE INDEX IF NOT EXISTS idx_email_otps_email_expires 
    ON public.hushh_agent_email_otps(email, expires_at DESC);

-- Enable RLS
ALTER TABLE public.hushh_agent_email_otps ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert from edge functions
CREATE POLICY "Allow insert email otps"
    ON public.hushh_agent_email_otps
    FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (true);

-- Policy: Allow select for verification
CREATE POLICY "Allow select email otps"
    ON public.hushh_agent_email_otps
    FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

-- Policy: Allow update for verification status
CREATE POLICY "Allow update email otps"
    ON public.hushh_agent_email_otps
    FOR UPDATE
    TO anon, authenticated, service_role
    USING (true);

-- =====================================================
-- Email Sessions Table (for session management)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.hushh_agent_email_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to user
    user_id UUID REFERENCES public.hushh_agent_users(id) ON DELETE CASCADE,
    
    -- Session token (JWT or UUID)
    session_token TEXT UNIQUE NOT NULL,
    
    -- Expiry (30 days by default)
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Device info for security
    device_fingerprint TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session token lookups
CREATE INDEX IF NOT EXISTS idx_email_sessions_token 
    ON public.hushh_agent_email_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_email_sessions_user_id 
    ON public.hushh_agent_email_sessions(user_id);

-- Enable RLS
ALTER TABLE public.hushh_agent_email_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow insert email sessions"
    ON public.hushh_agent_email_sessions
    FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (true);

CREATE POLICY "Allow select email sessions"
    ON public.hushh_agent_email_sessions
    FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

CREATE POLICY "Allow update email sessions"
    ON public.hushh_agent_email_sessions
    FOR UPDATE
    TO anon, authenticated, service_role
    USING (true);

-- =====================================================
-- Cleanup Function: Delete expired OTPs and sessions
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_auth_data()
RETURNS void AS $$
BEGIN
    -- Delete expired OTPs
    DELETE FROM public.hushh_agent_email_otps
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    -- Deactivate expired sessions
    UPDATE public.hushh_agent_email_sessions
    SET is_active = FALSE
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    -- Delete old inactive sessions (older than 90 days)
    DELETE FROM public.hushh_agent_email_sessions
    WHERE is_active = FALSE AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE public.hushh_agent_email_otps IS 
    'Stores OTP codes for email authentication (5 min expiry)';

COMMENT ON TABLE public.hushh_agent_email_sessions IS 
    'Active user sessions for email-authenticated users';

COMMENT ON COLUMN public.hushh_agent_users.email IS 
    'User email address (verified via OTP)';
