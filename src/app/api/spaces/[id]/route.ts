import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: space } = await supabase
    .from('spaces')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: items } = await supabase
    .from('space_items')
    .select('*')
    .eq('space_id', id)
    .order('sort_order')

  // Fetch referenced nodes and inputs
  const nodeIds = (items ?? []).filter(i => i.node_id).map(i => i.node_id)
  const inputIds = (items ?? []).filter(i => i.input_id).map(i => i.input_id)

  const [{ data: nodes }, { data: inputs }] = await Promise.all([
    nodeIds.length > 0
      ? supabase.from('nodes').select('id, content, type, created_at').in('id', nodeIds)
      : { data: [] },
    inputIds.length > 0
      ? supabase.from('inputs').select('id, raw_content, source_type, source_metadata, created_at').in('id', inputIds)
      : { data: [] },
  ])

  return NextResponse.json({ space, items: items ?? [], nodes: nodes ?? [], inputs: inputs ?? [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.is_public !== undefined) updates.is_public = body.is_public
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('spaces')
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

  const { error } = await supabase.from('spaces').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ deleted: true })
}
