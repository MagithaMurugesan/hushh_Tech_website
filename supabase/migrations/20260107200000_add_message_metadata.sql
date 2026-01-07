i-- ============================================
-- Add metadata column to hushh_ai_messages
-- Stores structured data like calendar events
-- ============================================

-- Add metadata column for storing calendar events and other structured data
ALTER TABLE hushh_ai_messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add size constraint (50KB max for metadata to prevent performance issues)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'metadata_size_limit'
  ) THEN
    ALTER TABLE hushh_ai_messages
    ADD CONSTRAINT metadata_size_limit
    CHECK (metadata IS NULL OR pg_column_size(metadata) < 51200);
  END IF;
END $$;

-- Add attendees count limit (max 50 attendees per calendar event)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calendar_attendees_limit'
  ) THEN
    ALTER TABLE hushh_ai_messages
    ADD CONSTRAINT calendar_attendees_limit
    CHECK (
      metadata IS NULL OR
      (metadata->'calendarEvent') IS NULL OR
      (metadata->'calendarEvent'->'attendees') IS NULL OR
      jsonb_array_length(metadata->'calendarEvent'->'attendees') <= 50
    );
  END IF;
END $$;

-- Drop old generic index if exists
DROP INDEX IF EXISTS idx_hushh_ai_messages_metadata;

-- Create partial GIN index for calendar events (only index non-null calendar metadata)
CREATE INDEX IF NOT EXISTS idx_messages_calendar_events
  ON hushh_ai_messages
  USING GIN ((metadata->'calendarEvent'))
  WHERE metadata->'calendarEvent' IS NOT NULL;

-- Create index for querying by calendar event ID
CREATE INDEX IF NOT EXISTS idx_messages_calendar_event_id
  ON hushh_ai_messages ((metadata->'calendarEvent'->>'id'))
  WHERE metadata->'calendarEvent' IS NOT NULL;

-- Ensure old messages have empty object instead of NULL for consistency
UPDATE hushh_ai_messages
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN hushh_ai_messages.metadata IS 'JSONB metadata for messages (max 50KB). Supports calendarEvent and future metadata types.';
