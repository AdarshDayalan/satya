-- Manual weight control for node sizing in graph
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS weight float DEFAULT 1.0;
