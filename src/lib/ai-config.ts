import { SupabaseClient } from '@supabase/supabase-js'

export type AIConfig = {
  apiKey: string
  provider: string
  model: string
  embeddingProvider: string
  embeddingApiKey: string
}

export async function getUserAIConfig(supabase: SupabaseClient, userId: string): Promise<AIConfig> {
  const { data } = await supabase
    .from('profiles')
    .select('ai_provider, ai_api_key, ai_model, embedding_provider, embedding_api_key')
    .eq('user_id', userId)
    .single()

  const profile = data as {
    ai_api_key?: string; ai_provider?: string; ai_model?: string
    embedding_provider?: string; embedding_api_key?: string
  } | null
  const apiKey = profile?.ai_api_key || ''

  if (!apiKey) {
    throw new Error('No AI API key configured. Go to settings to add your key.')
  }

  const provider = profile?.ai_provider || 'gemini'

  return {
    apiKey,
    provider,
    model: profile?.ai_model || '',
    // Embedding defaults: use same provider/key unless explicitly set
    embeddingProvider: profile?.embedding_provider || provider,
    embeddingApiKey: profile?.embedding_api_key || apiKey,
  }
}
