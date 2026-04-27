import { SupabaseClient } from '@supabase/supabase-js'

export type AIConfig = {
  apiKey: string
  provider: string
  model: string
}

export async function getUserAIConfig(supabase: SupabaseClient, userId: string): Promise<AIConfig> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('ai_provider, ai_api_key, ai_model')
    .eq('user_id', userId)
    .single()

  const apiKey = profile?.ai_api_key || ''

  if (!apiKey) {
    throw new Error('No AI API key configured. Go to settings to add your key.')
  }

  return {
    apiKey,
    provider: profile?.ai_provider || 'gemini',
    model: profile?.ai_model || '',
  }
}
