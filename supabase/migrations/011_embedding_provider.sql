-- Allow users to configure a separate embedding provider/key
alter table profiles add column if not exists embedding_provider text;
alter table profiles add column if not exists embedding_api_key text;
