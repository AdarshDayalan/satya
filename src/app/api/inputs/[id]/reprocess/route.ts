import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModel, generateEmbedding, type AIModel, type Provider } from '@/lib/ai'
import { getUserAIConfig } from '@/lib/ai-config'
import { EXTRACT_IDEAS_PROMPT, DETECT_RELATIONSHIPS_PROMPT } from '@/lib/prompts'
import { detectSource } from '@/lib/sources'
import { extractContent } from '@/lib/extractors'

async function generateJson(
  model: AIModel,
  prompt: string
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await model.generateJSON(prompt)
    } catch (err) {
      console.error(`[satya] reprocess JSON attempt ${attempt + 1} failed:`, err)
      if (attempt === 1) throw err
    }
  }
  throw new Error('unreachable')
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the input
  const { data: input } = await supabase
    .from('inputs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!input) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get user's AI config
  let aiConfig
  try {
    aiConfig = await getUserAIConfig(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'No AI API key configured. Add your key in settings.' }, { status: 400 })
  }

  // Delete old nodes (edges cascade)
  await supabase.from('nodes').delete().eq('input_id', id)

  // Mark as processing
  await supabase.from('inputs').update({ status: 'processing' }).eq('id', id)

  try {
    const source = detectSource(input.raw_content)
    const { enrichedContent } = await extractContent(
      input.raw_content,
      source.type,
      { videoId: source.videoId, url: source.url }
    )

    const model = getModel(aiConfig.apiKey, aiConfig.provider as Provider, aiConfig.model)
    const prompt = EXTRACT_IDEAS_PROMPT.replace('{{raw_content}}', enrichedContent)
    const extracted = (await generateJson(model, prompt)) as {
      summary: string
      nodes: Array<{ content: string; type: string }>
    }

    const createdNodes: Array<{ id: string; content: string; type: string }> = []
    const createdEdges: Array<{ from_node_id: string; to_node_id: string; relationship: string }> = []

    for (const node of extracted.nodes) {
      let embedding: number[] | null = null
      try {
        embedding = await generateEmbedding(aiConfig.apiKey, node.content, aiConfig.provider as Provider)
        if (embedding && embedding.length === 0) embedding = null
      } catch (embErr) {
        console.error('[satya] Embedding failed:', embErr)
      }

      const { data: savedNode } = await supabase
        .from('nodes')
        .insert({
          user_id: user.id,
          input_id: id,
          content: node.content,
          type: node.type || 'idea',
          summary: extracted.summary,
          embedding: embedding ? JSON.stringify(embedding) : null,
        })
        .select()
        .single()

      if (!savedNode) continue
      createdNodes.push(savedNode)

      // Find candidate nodes for relationship detection
      let candidates: Array<{ id: string; content: string }> = []

      if (embedding) {
        const { data: nearbyNodes } = await supabase.rpc('match_nodes', {
          query_embedding: JSON.stringify(embedding),
          match_user_id: user.id,
          match_count: 5,
        })
        candidates = (nearbyNodes ?? []).filter(
          (n: { id: string }) => n.id !== savedNode.id
        )
      }

      // Fallback: use sibling nodes from this batch if no embedding matches
      if (candidates.length === 0 && createdNodes.length > 1) {
        candidates = createdNodes
          .filter((c) => c.id !== savedNode.id)
          .map((c) => ({ id: c.id, content: c.content }))
      }

      if (candidates.length > 0) {
        try {
          const relPrompt = DETECT_RELATIONSHIPS_PROMPT
            .replace('{{new_node}}', JSON.stringify({ id: savedNode.id, content: savedNode.content }))
            .replace('{{nearby_nodes}}', JSON.stringify(candidates))

          const parsed = (await generateJson(model, relPrompt)) as {
            relationships: Array<{ existing_node_id: string; relationship: string; strength: number; reason: string }>
          }

          for (const rel of parsed.relationships) {
            if (rel.relationship === 'none' || rel.relationship === 'related' || rel.strength < 0.7) continue
            const { data: edge } = await supabase
              .from('edges')
              .insert({
                user_id: user.id,
                from_node_id: savedNode.id,
                to_node_id: rel.existing_node_id,
                relationship: rel.relationship,
                strength: rel.strength,
                reason: rel.reason,
              })
              .select()
              .single()
            if (edge) createdEdges.push(edge)
          }
        } catch (relErr) {
          console.error('[satya] Relationship detection failed:', relErr)
        }
      }
    }

    await supabase
      .from('inputs')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ nodes: createdNodes, edges: createdEdges })
  } catch (err) {
    console.error('[satya] Reprocess failed:', err)
    await supabase.from('inputs').update({ status: 'failed' }).eq('id', id)
    return NextResponse.json({ error: 'Reprocess failed' }, { status: 500 })
  }
}
