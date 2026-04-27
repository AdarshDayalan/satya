import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectSource } from '@/lib/sources'

// Determine if input is a journal entry (prose with embedded links) or bare URL list
function splitBulkInput(raw: string): string[] {
  const lines = raw.split('\n')
  const urlRegex = /https?:\/\/[^\s]+/

  const urlCount = lines.filter(l => urlRegex.test(l)).length

  // 0 or 1 URL → single input
  if (urlCount <= 1) return [raw]

  // Check if this is prose with embedded links (journal) vs bare URL list
  const proseLines = lines.filter(l => !urlRegex.test(l) && l.trim().length > 0)
  const totalProseChars = proseLines.reduce((sum, l) => sum + l.trim().length, 0)

  // If substantial prose, it's a journal — keep as one entry
  // The processing pipeline will extract and research each URL internally
  if (totalProseChars > 100) return [raw]

  // Bare URL list — split into individual items
  const chunks: string[] = []
  let currentContext: string[] = []

  for (const line of lines) {
    if (urlRegex.test(line)) {
      const contextText = currentContext.filter(l => l.trim()).join('\n')
      const chunk = contextText ? `${contextText}\n${line}` : line
      chunks.push(chunk.trim())
      currentContext = []
    } else {
      currentContext.push(line)
    }
  }

  const trailing = currentContext.filter(l => l.trim()).join('\n')
  if (trailing && chunks.length > 0) {
    chunks[chunks.length - 1] += `\n${trailing}`
  } else if (trailing) {
    chunks.push(trailing)
  }

  return chunks.filter(c => c.trim())
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { raw_content } = await req.json()

  // Split into individual items if bulk paste
  const items = splitBulkInput(raw_content)

  const inputs = []
  for (const item of items) {
    const source = detectSource(item)

    const { data: input, error } = await supabase
      .from('inputs')
      .insert({
        user_id: user.id,
        raw_content: item,
        source_url: source.url || null,
        input_type: source.type,
        source_type: source.type,
        status: 'pending',
      })
      .select('id, status, source_type, created_at')
      .single()

    if (!error && input) inputs.push(input)
  }

  if (inputs.length === 0) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({
    input: inputs[0],
    inputs,
    count: inputs.length,
    bulk: inputs.length > 1,
  })
}
