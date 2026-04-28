import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recomputeStabilityFor } from '@/lib/self'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { from_node_id, to_node_id, relationship, strength, reason } = await req.json()

  if (!from_node_id || !to_node_id) {
    return NextResponse.json({ error: 'Both node IDs required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('edges')
    .insert({
      user_id: user.id,
      from_node_id,
      to_node_id,
      relationship: relationship || 'supports',
      strength: strength ?? 0.8,
      reason: reason || '',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await recomputeStabilityFor(supabase, [from_node_id, to_node_id])

  return NextResponse.json(data)
}
