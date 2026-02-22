-- Add signal_prepared column to track Signal opt-in status
ALTER TABLE user_financial_data
  ADD COLUMN IF NOT EXISTS signal_prepared boolean DEFAULT false;

COMMENT ON COLUMN user_financial_data.signal_prepared IS 'Whether /signal/prepare has been called for this Item';
