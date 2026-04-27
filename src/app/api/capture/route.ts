import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectSource } from '@/lib/sources'

// Step 1: Save input instantly — returns immediately
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { raw_content } = await req.json()
  const source = detectSource(raw_content)

  const { data: input, error } = await supabase
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ input })
}
