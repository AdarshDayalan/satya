import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: node } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!node) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: edgesFrom }, { data: edgesTo }] = await Promise.all([
    supabase.from('edges').select('id, to_node_id, relationship, strength, reason').eq('from_node_id', id),
    supabase.from('edges').select('id, from_node_id, relationship, strength, reason').eq('to_node_id', id),
  ])

  const connectedIds = [
    ...(edgesFrom ?? []).map((e) => e.to_node_id),
    ...(edgesTo ?? []).map((e) => e.from_node_id),
  ]

  let connectedNodes: Record<string, { id: string; content: string; type: string }> = {}
  if (connectedIds.length > 0) {
    const { data } = await supabase.from('nodes').select('id, content, type').in('id', connectedIds)
    for (const n of data ?? []) connectedNodes[n.id] = n
  }

  const connections = [
    ...(edgesFrom ?? []).map((e) => ({
      node: connectedNodes[e.to_node_id] || { id: e.to_node_id, content: '?', type: 'raw' },
      relationship: e.relationship, strength: e.strength, reason: e.reason, edgeId: e.id,
    })),
    ...(edgesTo ?? []).map((e) => ({
      node: connectedNodes[e.from_node_id] || { id: e.from_node_id, content: '?', type: 'raw' },
      relationship: e.relationship, strength: e.strength, reason: e.reason, edgeId: e.id,
    })),
  ]

  return NextResponse.json({ node, connections })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.content !== undefined) updates.content = body.content
  if (body.type !== undefined) updates.type = body.type
  if (body.summary !== undefined) updates.summary = body.summary
  if (body.weight !== undefined) updates.weight = body.weight

  const { data, error } = await supabase
    .from('nodes')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Edges cascade-delete via FK
  const { error } = await supabase
    .from('nodes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ deleted: true })
}
