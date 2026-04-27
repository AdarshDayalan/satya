import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModel, generateEmbedding } from '@/lib/ai'
import { getUserAIConfig } from '@/lib/ai-config'
import type { Provider, AIModel } from '@/lib/ai'
import {
  EXTRACT_IDEAS_PROMPT,
  DETECT_RELATIONSHIPS_PROMPT,
  SUGGEST_FOLDER_PROMPT,
} from '@/lib/prompts'
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
      console.error(`[satya] JSON attempt ${attempt + 1} failed:`, err)
      if (attempt === 1) throw err
    }
  }
  throw new Error('unreachable')
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's AI config
  let aiConfig
  try {
    aiConfig = await getUserAIConfig(supabase, user.id)
  } catch {
    return NextResponse.json(
      { error: 'No AI API key configured. Add your key in settings.' },
      { status: 400 }
    )
  }

  const { raw_content } = await req.json()

  // Auto-detect source type from content
  const source = detectSource(raw_content)

  // Extract enriched content from source (YouTube transcript, article text, etc.)
  const { enrichedContent, metadata: sourceMetadata } = await extractContent(
    raw_content,
    source.type,
    { videoId: source.videoId, url: source.url, startTime: source.startTime, endTime: source.endTime, redditPath: source.redditPath, pubmedId: source.pubmedId }
  )

  // Step 1: Save raw input (never lost)
  const { data: input, error: inputError } = await supabase
    .from('inputs')
    .insert({
      user_id: user.id,
      raw_content,
      source_url: source.url || null,
      input_type: source.type,
      source_type: source.type,
      source_metadata: sourceMetadata,
      status: 'processing',
    })
    .select()
    .single()

  if (inputError) {
    return NextResponse.json({ error: 'Failed to save input' }, { status: 500 })
  }

  try {
    const model = getModel(aiConfig.apiKey, aiConfig.provider as Provider, aiConfig.model)

    // Step 2: Extract meaning nodes (with retry)
    const prompt = EXTRACT_IDEAS_PROMPT.replace('{{raw_content}}', enrichedContent)
    const extracted = (await generateJson(model, prompt)) as {
      summary: string
      nodes: Array<{ content: string; type: string }>
    }

    // Step 3: Create nodes with embeddings and find relationships
    const createdNodes: Array<{ id: string; content: string; type: string }> = []
    const createdEdges: Array<{
      from_node_id: string
      to_node_id: string
      relationship: string
    }> = []

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
          input_id: input.id,
          content: node.content,
          type: node.type || 'idea',
          summary: extracted.summary,
          embedding: embedding ? JSON.stringify(embedding) : null,
        })
        .select()
        .single()

      if (!savedNode) continue
      createdNodes.push(savedNode)

      // Step 4: Find similar nodes and detect relationships
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
          const relPrompt = DETECT_RELATIONSHIPS_PROMPT.replace(
            '{{new_node}}',
            JSON.stringify({ id: savedNode.id, content: savedNode.content })
          ).replace('{{nearby_nodes}}', JSON.stringify(candidates))

          const parsed = (await generateJson(model, relPrompt)) as {
            relationships: Array<{
              existing_node_id: string
              relationship: string
              strength: number
              reason: string
            }>
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

    // Step 5: Suggest emergent folder
    let folderSuggestion = null
    if (createdEdges.length > 0) {
      try {
        // Gather local neighborhood: created nodes + connected nodes
        const connectedNodeIds = new Set<string>()
        for (const edge of createdEdges) {
          connectedNodeIds.add(edge.to_node_id)
        }
        for (const node of createdNodes) {
          connectedNodeIds.add(node.id)
        }

        // Get second-degree connections for strong edges
        const { data: secondDegree } = await supabase
          .from('edges')
          .select('from_node_id, to_node_id')
          .or(
            [...connectedNodeIds]
              .map((id) => `from_node_id.eq.${id},to_node_id.eq.${id}`)
              .join(',')
          )
          .gte('strength', 0.7)

        for (const e of secondDegree ?? []) {
          connectedNodeIds.add(e.from_node_id)
          connectedNodeIds.add(e.to_node_id)
        }

        // Only suggest if cluster is large enough
        if (connectedNodeIds.size >= 5) {
          const { data: clusterNodes } = await supabase
            .from('nodes')
            .select('id, content, type')
            .in('id', [...connectedNodeIds])

          const folderPrompt = SUGGEST_FOLDER_PROMPT.replace(
            '{{cluster_nodes}}',
            JSON.stringify(clusterNodes)
          )

          const folderResult = (await generateJson(model, folderPrompt)) as {
            should_create_folder: boolean
            folder_name: string
            description: string
            confidence: number
          }

          if (folderResult.should_create_folder && folderResult.confidence >= 0.75) {
            const { data: folder } = await supabase
              .from('folders')
              .insert({
                user_id: user.id,
                name: folderResult.folder_name,
                description: folderResult.description,
                confidence: folderResult.confidence,
                created_by: 'ai',
              })
              .select()
              .single()

            if (folder) {
              const folderNodeRows = [...connectedNodeIds].map((nodeId) => ({
                folder_id: folder.id,
                node_id: nodeId,
                added_by: 'ai',
              }))

              await supabase.from('folder_nodes').insert(folderNodeRows)
              folderSuggestion = folder
            }
          }
        }
      } catch {
        // Folder suggestion failed — not critical
      }
    }

    await supabase
      .from('inputs')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', input.id)

    return NextResponse.json({
      input,
      nodes: createdNodes,
      edges: createdEdges,
      folder: folderSuggestion,
    })
  } catch (err) {
    console.error('[satya] Processing failed:', err)
    await supabase
      .from('inputs')
      .update({ status: 'failed' })
      .eq('id', input.id)

    return NextResponse.json({
      error: 'Processing failed',
      message: err instanceof Error ? err.message : 'Unknown error',
      input,
    }, { status: 500 })
  }
}
