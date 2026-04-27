-- Add source_url to nodes so ideas can reference the specific URL they came from
-- (especially for journal entries with multiple embedded links)
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS source_url text;
