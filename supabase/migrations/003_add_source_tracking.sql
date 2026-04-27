-- Add source tracking to inputs
ALTER TABLE inputs
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'journal',
  ADD COLUMN IF NOT EXISTS source_metadata jsonb DEFAULT '{}'::jsonb;

-- Index for sidebar grouping/filtering
CREATE INDEX IF NOT EXISTS idx_inputs_source_type ON inputs (user_id, source_type, created_at DESC);
