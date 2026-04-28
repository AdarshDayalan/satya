-- Link child source inputs back to their parent journal entry
ALTER TABLE inputs ADD COLUMN IF NOT EXISTS parent_input_id uuid REFERENCES inputs(id) ON DELETE SET NULL;
