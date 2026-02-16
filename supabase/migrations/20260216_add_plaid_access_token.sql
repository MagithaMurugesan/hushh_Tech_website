-- Add plaid_access_token column to user_financial_data table
-- This stores the Plaid access_token so Step 13 can call /auth/get for auto-fill
ALTER TABLE user_financial_data
ADD COLUMN IF NOT EXISTS plaid_access_token TEXT;

-- Add comment for documentation
COMMENT ON COLUMN user_financial_data.plaid_access_token IS 'Plaid access_token for calling Auth/Identity APIs to auto-fill wire transfer details';
