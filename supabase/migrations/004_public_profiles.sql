-- Public profiles for sharing knowledge graphs
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$')
);

CREATE TABLE published_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, node_id)
);

CREATE TABLE published_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, folder_id)
);

-- Indexes
CREATE INDEX idx_profiles_user_id ON profiles (user_id);
CREATE INDEX idx_profiles_slug ON profiles (slug);
CREATE INDEX idx_published_nodes_profile ON published_nodes (profile_id);
CREATE INDEX idx_published_folders_profile ON published_folders (profile_id);

-- RLS: owners can manage their profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public profiles readable" ON profiles FOR SELECT USING (true);

ALTER TABLE published_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage published nodes" ON published_nodes FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Public nodes readable" ON published_nodes FOR SELECT USING (true);

ALTER TABLE published_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage published folders" ON published_folders FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Public folders readable" ON published_folders FOR SELECT USING (true);

-- Allow public read on nodes/folders/edges for published items
CREATE POLICY "Public read published nodes" ON nodes FOR SELECT
  USING (id IN (SELECT node_id FROM published_nodes));

CREATE POLICY "Public read published edges" ON edges FOR SELECT
  USING (
    from_node_id IN (SELECT node_id FROM published_nodes)
    OR to_node_id IN (SELECT node_id FROM published_nodes)
  );

CREATE POLICY "Public read published folders" ON folders FOR SELECT
  USING (id IN (SELECT folder_id FROM published_folders));
