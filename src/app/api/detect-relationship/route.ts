import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModel, type Provider } from '@/lib/ai'
import { getUserAIConfig } from '@/lib/ai-config'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { from_content, to_content } = await req.json()

  let aiConfig
  try {
    aiConfig = await getUserAIConfig(supabase, user.id)
  } catch {
    return NextResponse.json({ relationship: 'supports', strength: 0.8 })
  }

  try {
    const model = getModel(aiConfig.apiKey, aiConfig.provider as Provider, aiConfig.model)
    const result = await model.generateJSON(
      `Given two ideas in a knowledge graph, determine their relationship in one word and a strength score.

Idea A: "${from_content}"
Idea B: "${to_content}"

Return JSON: { "relationship": "supports | contradicts | refines | example_of | causes | similar", "strength": 0.0 to 1.0 }

Pick the most specific relationship. Be concise.`
    )
    return NextResponse.json({
      relationship: result.relationship || 'supports',
      strength: typeof result.strength === 'number' ? result.strength : 0.8,
    })
  } catch {
    return NextResponse.json({ relationship: 'supports', strength: 0.8 })
  }
}
