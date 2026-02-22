-- Add auth_numbers and identity_match columns to user_financial_data
ALTER TABLE user_financial_data
  ADD COLUMN IF NOT EXISTS auth_numbers jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS identity_match jsonb DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN user_financial_data.auth_numbers IS 'Plaid Auth: account numbers, routing numbers (ACH/EFT)';
COMMENT ON COLUMN user_financial_data.identity_match IS 'Plaid Identity Match: score comparing user input vs bank records';
