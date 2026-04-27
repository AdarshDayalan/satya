/**
 * Reprocess all inputs with updated prompts.
 * Run: npx tsx scripts/reprocess-all.ts
 */
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { detectSource } from '../src/lib/sources'
import { extractContent } from '../src/lib/extractors'
import {
  EXTRACT_IDEAS_PROMPT,
  DETECT_RELATIONSHIPS_PROMPT,
  SUGGEST_FOLDER_PROMPT,
} from '../src/lib/prompts'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''

// Get user's API key from profiles
async function getApiKey(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase.from('profiles').select('ai_api_key').limit(1).single()
  const profile = data as { ai_api_key?: string } | null
  return profile?.ai_api_key || GEMINI_KEY
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim()
  return JSON.parse(cleaned)
}

async function generateJson(model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>, prompt: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      return extractJson(result.response.text())
    } catch (err) {
      console.error(`  JSON attempt ${attempt + 1} failed:`, (err as Error).message?.slice(0, 100))
      if (attempt === 1) throw err
    }
  }
  throw new Error('unreachable')
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const apiKey = await getApiKey(supabase)

  if (!apiKey) {
    console.error('No API key found. Set GEMINI_API_KEY or configure in user_settings.')
    process.exit(1)
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })

  console.log('=== STEP 1: Wipe all edges, folder_nodes, and nodes ===')
  await supabase.from('folder_nodes').delete().neq('folder_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('edges').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('nodes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('  Wiped.')

  console.log('\n=== STEP 2: Fetch all inputs ===')
  const { data: inputs } = await supabase
    .from('inputs')
    .select('*')
    .order('created_at', { ascending: true })

  if (!inputs || inputs.length === 0) {
    console.log('  No inputs found.')
    return
  }
  console.log(`  Found ${inputs.length} inputs.`)

  const allCreatedNodes: Array<{ id: string; content: string; type: string }> = []

  console.log('\n=== STEP 3: Extract nodes from each input ===')
  for (const input of inputs) {
    console.log(`\n--- Input ${input.id.slice(0, 8)} (${input.source_type || 'journal'}) ---`)
    console.log(`  "${input.raw_content.slice(0, 80)}..."`)

    // Enrich content
    const source = detectSource(input.raw_content)
    let enrichedContent = input.raw_content
    try {
      const { enrichedContent: ec } = await extractContent(
        input.raw_content,
        source.type,
        { videoId: source.videoId, url: source.url, startTime: source.startTime, endTime: source.endTime, redditPath: source.redditPath, pubmedId: source.pubmedId }
      )
      enrichedContent = ec
    } catch (err) {
      console.log(`  Enrichment failed, using raw: ${(err as Error).message?.slice(0, 60)}`)
    }

    // Extract nodes
    try {
      const prompt = EXTRACT_IDEAS_PROMPT.replace('{{raw_content}}', enrichedContent)
      const extracted = await generateJson(model, prompt) as {
        summary: string
        nodes: Array<{ content: string; type: string }>
      }

      console.log(`  Extracted ${extracted.nodes.length} nodes:`)
      for (const node of extracted.nodes) {
        // Generate embedding
        let embedding: number[] | null = null
        try {
          const embModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })
          const embResult = await embModel.embedContent(node.content)
          embedding = embResult.embedding.values
        } catch { /* continue */ }

        const { data: savedNode } = await supabase
          .from('nodes')
          .insert({
            user_id: input.user_id,
            input_id: input.id,
            content: node.content,
            type: node.type || 'idea',
            summary: extracted.summary,
            embedding: embedding ? JSON.stringify(embedding) : null,
          })
          .select()
          .single()

        if (savedNode) {
          allCreatedNodes.push(savedNode)
          console.log(`    [${node.type}] ${node.content.slice(0, 70)}`)
        }
      }

      await supabase.from('inputs').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', input.id)
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message?.slice(0, 100)}`)
      await supabase.from('inputs').update({ status: 'failed' }).eq('id', input.id)
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log(`\n=== STEP 4: Detect relationships (${allCreatedNodes.length} total nodes) ===`)
  let edgeCount = 0

  for (let i = 0; i < allCreatedNodes.length; i++) {
    const node = allCreatedNodes[i]

    // Find nearby nodes by embedding similarity (or just use all other nodes for small graphs)
    const candidates = allCreatedNodes.filter(n => n.id !== node.id).slice(0, 15)
    if (candidates.length === 0) continue

    try {
      const relPrompt = DETECT_RELATIONSHIPS_PROMPT
        .replace('{{new_node}}', JSON.stringify({ id: node.id, content: node.content }))
        .replace('{{nearby_nodes}}', JSON.stringify(candidates.map(c => ({ id: c.id, content: c.content, type: c.type }))))

      const parsed = await generateJson(model, relPrompt) as {
        relationships: Array<{
          existing_node_id: string
          relationship: string
          strength: number
          reason: string
        }>
      }

      for (const rel of parsed.relationships) {
        if (rel.relationship === 'none' || rel.strength < 0.5) continue
        // Verify the target node exists
        if (!allCreatedNodes.some(n => n.id === rel.existing_node_id)) continue

        const { data: edge } = await supabase
          .from('edges')
          .insert({
            user_id: inputs[0].user_id,
            from_node_id: node.id,
            to_node_id: rel.existing_node_id,
            relationship: rel.relationship,
            strength: rel.strength,
            reason: rel.reason,
          })
          .select()
          .single()

        if (edge) {
          edgeCount++
          console.log(`  ${node.content.slice(0, 30)}... --[${rel.relationship} ${rel.strength}]--> ${candidates.find(c => c.id === rel.existing_node_id)?.content.slice(0, 30)}...`)
        }
      }
    } catch (err) {
      console.error(`  Relationship detection failed for ${node.id.slice(0, 8)}: ${(err as Error).message?.slice(0, 80)}`)
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n=== DONE ===`)
  console.log(`  ${allCreatedNodes.length} nodes created`)
  console.log(`  ${edgeCount} edges created`)
}

main().catch(console.error)
