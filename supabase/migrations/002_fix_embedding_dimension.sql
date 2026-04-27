-- Gemini text-embedding-004 outputs 768 dimensions, not 1536
alter table nodes alter column embedding type vector(768);

-- Recreate match_nodes with correct dimension
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
