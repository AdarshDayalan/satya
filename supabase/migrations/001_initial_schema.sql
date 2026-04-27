-- Enable pgvector
create extension if not exists vector with schema extensions;

-- Inputs: raw things the user drops in
create table inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  raw_content text,
  source_url text,
  input_type text default 'text',
  status text default 'pending',
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- Nodes: meaning units
create table nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  input_id uuid references inputs(id) on delete cascade,
  content text not null,
  type text default 'idea',
  summary text,
  embedding vector(768),
  created_at timestamptz default now()
);

-- Edges: relationships between nodes
create table edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  from_node_id uuid references nodes(id) on delete cascade not null,
  to_node_id uuid references nodes(id) on delete cascade not null,
  relationship text not null,
  strength float default 0.5,
  reason text,
  created_at timestamptz default now()
);

-- Folders: emergent cluster views
create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  confidence float default 0.5,
  created_by text default 'ai',
  created_at timestamptz default now()
);

-- Folder-nodes join table
create table folder_nodes (
  folder_id uuid references folders(id) on delete cascade,
  node_id uuid references nodes(id) on delete cascade,
  added_by text default 'ai',
  created_at timestamptz default now(),
  primary key (folder_id, node_id)
);

-- RLS
alter table inputs enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;
alter table folders enable row level security;
alter table folder_nodes enable row level security;

create policy "Users manage own inputs" on inputs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own nodes" on nodes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own edges" on edges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own folders" on folders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own folder_nodes" on folder_nodes for all
  using (exists (select 1 from folders where folders.id = folder_id and folders.user_id = auth.uid()))
  with check (exists (select 1 from folders where folders.id = folder_id and folders.user_id = auth.uid()));

-- Vector similarity search
create or replace function match_nodes(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 10
)
returns table (id uuid, content text, type text, similarity float)
language sql stable
as $$
  select nodes.id, nodes.content, nodes.type,
    1 - (nodes.embedding <=> query_embedding) as similarity
  from nodes
  where nodes.user_id = match_user_id
  order by nodes.embedding <=> query_embedding
  limit match_count;
$$;
