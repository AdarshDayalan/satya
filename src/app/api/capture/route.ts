import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectSource } from '@/lib/sources'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { raw_content } = await req.json()

  const source = detectSource(raw_content)
  const urls = [...new Set((raw_content.match(/https?:\/\/[^\s)>\]]+/g) || []) as string[])]

  // Save the main input
  const { data: mainInput, error: mainErr } = await supabase
    .from('inputs')
    .insert({
      user_id: user.id,
      raw_content,
      source_url: source.url || null,
      input_type: source.type,
      source_type: source.type,
      status: 'pending',
    })
    .select('id, status, source_type, created_at')
    .single()

  if (mainErr || !mainInput) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  const inputs = [mainInput]

  // For journal entries with embedded URLs, also create individual source inputs
  // so each link gets independently scraped, extracted, and turned into nodes.
  const childUrls: string[] = []
  if (source.type === 'journal' && urls.length > 0) {
    for (const url of urls) {
      const urlSource = detectSource(url)
      const { data: child } = await supabase
        .from('inputs')
        .insert({
          user_id: user.id,
          raw_content: url,
          source_url: url,
          input_type: urlSource.type,
          source_type: urlSource.type,
          parent_input_id: mainInput.id,
          status: 'pending',
        })
        .select('id, status, source_type, created_at')
        .single()

      if (child) { inputs.push(child); childUrls.push(url) }
    }
  }

  return NextResponse.json({
    input: mainInput,
    inputs,
    count: inputs.length,
    bulk: inputs.length > 1,
    embedded_urls: childUrls.length,
  })
}
