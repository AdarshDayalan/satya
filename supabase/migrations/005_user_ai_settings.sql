-- User-provided AI keys so each user brings their own
ALTER TABLE profiles
  ADD COLUMN ai_provider text NOT NULL DEFAULT 'gemini',
  ADD COLUMN ai_api_key text DEFAULT '',
  ADD COLUMN ai_model text DEFAULT '';

-- Encrypt at rest via Supabase vault is recommended but out of scope here.
-- The key is only readable by the owning user via RLS (already set).
