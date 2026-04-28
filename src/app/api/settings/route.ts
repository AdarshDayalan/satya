import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('ai_provider, ai_model, ai_api_key, trust_weights, embedding_provider, embedding_api_key')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ ai_provider: 'gemini', ai_model: '', ai_api_key: '', trust_weights: {} })
  }

  // Mask the key for display — only show last 4 chars
  const masked = profile.ai_api_key
    ? '•'.repeat(Math.max(0, profile.ai_api_key.length - 4)) + profile.ai_api_key.slice(-4)
    : ''

  const embMasked = profile.embedding_api_key
    ? '•'.repeat(Math.max(0, profile.embedding_api_key.length - 4)) + profile.embedding_api_key.slice(-4)
    : ''

  return NextResponse.json({
    ai_provider: profile.ai_provider,
    ai_model: profile.ai_model,
    ai_api_key_masked: masked,
    has_key: !!profile.ai_api_key,
    trust_weights: profile.trust_weights || {},
    embedding_provider: profile.embedding_provider || '',
    embedding_api_key_masked: embMasked,
    has_embedding_key: !!profile.embedding_api_key,
  })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ai_provider, ai_model, ai_api_key, trust_weights, embedding_provider, embedding_api_key } = await req.json()

  // Upsert into profile
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const updates: Record<string, unknown> = {
    ai_provider: ai_provider || 'gemini',
    ai_model: ai_model || '',
  }

  // Only update key if a new one was provided (not masked)
  if (ai_api_key && !ai_api_key.startsWith('•')) {
    updates.ai_api_key = ai_api_key
  }

  // Embedding provider settings
  if (embedding_provider !== undefined) {
    updates.embedding_provider = embedding_provider || null
  }
  if (embedding_api_key && !embedding_api_key.startsWith('•')) {
    updates.embedding_api_key = embedding_api_key
  }

  // Update trust weights if provided
  if (trust_weights !== undefined) {
    updates.trust_weights = trust_weights
  }

  if (existing) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    const { error } = await supabase
      .from('profiles')
      .insert({ user_id: user.id, slug: user.id.slice(0, 8), ...updates })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
