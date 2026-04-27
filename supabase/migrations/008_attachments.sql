-- Node attachments: links, images, video clips, files
CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('link', 'image', 'video', 'file')),
  url text NOT NULL,
  title text,
  description text,
  thumbnail_url text,
  mime_type text,
  file_size int,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_attachments_node ON attachments (node_id);
CREATE INDEX idx_attachments_user ON attachments (user_id);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attachments" ON attachments FOR ALL USING (auth.uid() = user_id);
