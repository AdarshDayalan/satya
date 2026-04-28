import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModel, generateEmbedding, type AIModel, type Provider } from '@/lib/ai'
import { getUserAIConfig } from '@/lib/ai-config'
import { DETECT_RELATIONSHIPS_PROMPT } from '@/lib/prompts'

async function generateJson(model: AIModel, prompt: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await model.generateJSON(prompt) } catch (err) {
      if (attempt === 1) throw err
    }
  }
  throw new Error('unreachable')
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const maxNodes = body.max_nodes || 20

  let aiConfig
  try { aiConfig = await getUserAIConfig(supabase, user.id) } catch {
    return NextResponse.json({ error: 'No AI key configured' }, { status: 400 })
  }

  // Find nodes with fewest connections (most likely to be under-connected)
  const { data: weakNodes } = await supabase.rpc('find_weak_nodes', {
    p_user_id: user.id,
    p_limit: maxNodes,
  })

  if (!weakNodes || weakNodes.length === 0) {
    return NextResponse.json({ message: 'No weak nodes found', new_edges: 0 })
  }

  const model = getModel(aiConfig.apiKey, aiConfig.provider as Provider, aiConfig.model)
  let newEdges = 0

  for (const node of weakNodes) {
    // Find candidates via embedding similarity
    let candidates: Array<{ id: string; content: string; similarity?: number }> = []

    if (node.embedding) {
      const { data: nearby } = await supabase.rpc('match_nodes', {
        query_embedding: node.embedding,
        match_user_id: user.id,
        match_count: 10,
      })
      // Filter: skip self, skip nodes already connected, require decent similarity
      const { data: existingEdges } = await supabase
        .from('edges')
        .select('from_node_id, to_node_id')
        .or(`from_node_id.eq.${node.id},to_node_id.eq.${node.id}`)

      const connected = new Set<string>()
      for (const e of existingEdges ?? []) {
        connected.add(e.from_node_id)
        connected.add(e.to_node_id)
      }

      candidates = (nearby ?? [])
        .filter((n: { id: string; similarity: number }) =>
          n.id !== node.id && !connected.has(n.id) && n.similarity > 0.35
        )
        .slice(0, 5)
    } else {
      // No embedding — generate one
      try {
        const emb = await generateEmbedding(aiConfig.embeddingApiKey, node.content, aiConfig.embeddingProvider as Provider)
        if (emb.length > 0) {
          await supabase.from('nodes').update({ embedding: JSON.stringify(emb) }).eq('id', node.id)

          const { data: nearby } = await supabase.rpc('match_nodes', {
            query_embedding: JSON.stringify(emb),
            match_user_id: user.id,
            match_count: 10,
          })

          const { data: existingEdges } = await supabase
            .from('edges')
            .select('from_node_id, to_node_id')
            .or(`from_node_id.eq.${node.id},to_node_id.eq.${node.id}`)

          const connected = new Set<string>()
          for (const e of existingEdges ?? []) {
            connected.add(e.from_node_id)
            connected.add(e.to_node_id)
          }

          candidates = (nearby ?? [])
            .filter((n: { id: string; similarity: number }) =>
              n.id !== node.id && !connected.has(n.id) && n.similarity > 0.35
            )
            .slice(0, 5)
        }
      } catch { /* embedding failed, skip */ }
    }

    if (candidates.length === 0) continue

    try {
      const relPrompt = DETECT_RELATIONSHIPS_PROMPT
        .replace('{{new_node}}', JSON.stringify({ id: node.id, content: node.content }))
        .replace('{{nearby_nodes}}', JSON.stringify(candidates))

      const parsed = (await generateJson(model, relPrompt)) as {
        relationships: Array<{ existing_node_id: string; relationship: string; strength: number; reason: string }>
      }

      for (const rel of parsed.relationships) {
        if (rel.relationship === 'none' || rel.strength < 0.6) continue

        const { error } = await supabase.from('edges').insert({
          user_id: user.id,
          from_node_id: node.id,
          to_node_id: rel.existing_node_id,
          relationship: rel.relationship,
          strength: rel.strength,
          reason: rel.reason,
        })
        if (!error) newEdges++
      }
    } catch { /* relationship detection failed for this node */ }
  }

  return NextResponse.json({ processed: weakNodes.length, new_edges: newEdges })
}
