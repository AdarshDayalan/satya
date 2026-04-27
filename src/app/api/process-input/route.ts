import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModel, generateEmbedding } from '@/lib/gemini'
import { EXTRACT_IDEAS_PROMPT, DETECT_RELATIONSHIPS_PROMPT } from '@/lib/prompts'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { raw_content, source_url, input_type } = await req.json()

  // Step 1: Save raw input
  const { data: input, error: inputError } = await supabase
    .from('inputs')
    .insert({
      user_id: user.id,
      raw_content,
      source_url: source_url || null,
      input_type: input_type || 'text',
      status: 'processing',
    })
    .select()
    .single()

  if (inputError) {
    return NextResponse.json({ error: 'Failed to save input' }, { status: 500 })
  }

  try {
    // Step 2: Extract meaning nodes
    const model = getModel()
    const prompt = EXTRACT_IDEAS_PROMPT.replace('{{raw_content}}', raw_content)
    const extractResult = await model.generateContent(prompt)
    const extractText = extractResult.response.text()
    const extracted = JSON.parse(extractText)

    // Step 3: Create nodes with embeddings and find relationships
    const createdNodes: Array<{ id: string; content: string; type: string }> = []
    const createdEdges: Array<{ from_node_id: string; to_node_id: string; relationship: string }> = []

    for (const node of extracted.nodes) {
      // Generate embedding
      let embedding: number[] | null = null
      try {
        embedding = await generateEmbedding(node.content)
      } catch {
        // Continue without embedding
      }

      // Save node
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
      if (embedding) {
        const { data: nearbyNodes } = await supabase.rpc('match_nodes', {
          query_embedding: JSON.stringify(embedding),
          match_user_id: user.id,
          match_count: 5,
        })

        // Exclude nodes from same input
        const candidates = (nearbyNodes ?? []).filter(
          (n: { id: string }) => !createdNodes.some((c) => c.id === n.id)
        )

        if (candidates.length > 0) {
          const relPrompt = DETECT_RELATIONSHIPS_PROMPT
            .replace('{{new_node}}', JSON.stringify({ id: savedNode.id, content: savedNode.content }))
            .replace('{{nearby_nodes}}', JSON.stringify(candidates))

          try {
            const relResult = await model.generateContent(relPrompt)
            const relText = relResult.response.text()
            const parsed = JSON.parse(relText)

            for (const rel of parsed.relationships) {
              if (rel.relationship === 'none' || rel.strength < 0.55) continue

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
          } catch {
            // Relationship detection failed — nodes are still saved
          }
        }
      }
    }

    // Mark input as processed
    await supabase
      .from('inputs')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', input.id)

    return NextResponse.json({
      input,
      nodes: createdNodes,
      edges: createdEdges,
    })
  } catch {
    // AI failed — mark input as failed but don't lose it
    await supabase
      .from('inputs')
      .update({ status: 'failed' })
      .eq('id', input.id)

    return NextResponse.json({ error: 'Processing failed', input }, { status: 500 })
  }
}
