import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recomputeStabilityFor } from '@/lib/self'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.relationship !== undefined) updates.relationship = body.relationship
  if (body.strength !== undefined) updates.strength = body.strength
  if (body.reason !== undefined) updates.reason = body.reason

  const { data, error } = await supabase
    .from('edges')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (data) {
    await recomputeStabilityFor(supabase, [data.from_node_id, data.to_node_id])
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: edge } = await supabase
    .from('edges')
    .select('from_node_id, to_node_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('edges')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (edge) {
    await recomputeStabilityFor(supabase, [edge.from_node_id, edge.to_node_id])
  }

  return NextResponse.json({ deleted: true })
}
