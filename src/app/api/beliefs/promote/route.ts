import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/beliefs/promote — promote an existing node to a belief, or
// demote it back to a regular concept if `demote: true`.
//
// Body: { node_id: string, demote?: boolean }
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { node_id, demote } = await req.json()
  if (!node_id) return NextResponse.json({ error: 'node_id required' }, { status: 400 })

  const { data: node } = await supabase
    .from('nodes')
    .select('id, type')
    .eq('id', node_id)
    .eq('user_id', user.id)
    .single()

  if (!node) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (demote) {
    const { data, error } = await supabase
      .from('nodes')
      .update({ type: 'concept', stability: null, promoted_at: null })
      .eq('id', node_id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ node: data })
  }

  const { data, error } = await supabase
    .from('nodes')
    .update({ type: 'belief', promoted_at: new Date().toISOString() })
    .eq('id', node_id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.rpc('recompute_belief_stability', { belief_id: node_id })

  const { data: refreshed } = await supabase
    .from('nodes')
    .select('id, content, type, stability, promoted_at')
    .eq('id', node_id)
    .single()

  return NextResponse.json({ node: refreshed ?? data })
}
