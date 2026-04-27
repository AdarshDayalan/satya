-- Spaces: curated public views into the knowledge graph
CREATE TABLE spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text DEFAULT '',
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE TABLE space_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  node_id uuid REFERENCES nodes(id) ON DELETE CASCADE,
  input_id uuid REFERENCES inputs(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CHECK (node_id IS NOT NULL OR input_id IS NOT NULL)
);

CREATE INDEX idx_spaces_user ON spaces(user_id);
CREATE INDEX idx_spaces_slug ON spaces(slug);
CREATE INDEX idx_space_items_space ON space_items(space_id);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own spaces" ON spaces FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public spaces readable" ON spaces FOR SELECT USING (is_public = true);

ALTER TABLE space_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage space items" ON space_items FOR ALL
  USING (space_id IN (SELECT id FROM spaces WHERE user_id = auth.uid()));
CREATE POLICY "Public space items readable" ON space_items FOR SELECT
  USING (space_id IN (SELECT id FROM spaces WHERE is_public = true));
