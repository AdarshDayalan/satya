import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify space ownership
  const { data: space } = await supabase.from('spaces').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { node_id, input_id } = await req.json()

  const { data, error } = await supabase
    .from('space_items')
    .insert({ space_id: id, node_id: node_id || null, input_id: input_id || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Bulk sync — apply add/remove diff in one request
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: space } = await supabase.from('spaces').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { add_nodes = [], remove_nodes = [], add_inputs = [], remove_inputs = [] } = await req.json()

  // Remove items
  if (remove_nodes.length > 0) {
    await supabase.from('space_items').delete().eq('space_id', id).in('node_id', remove_nodes)
  }
  if (remove_inputs.length > 0) {
    await supabase.from('space_items').delete().eq('space_id', id).in('input_id', remove_inputs)
  }

  // Add items
  const inserts = [
    ...add_nodes.map((node_id: string) => ({ space_id: id, node_id, input_id: null })),
    ...add_inputs.map((input_id: string) => ({ space_id: id, node_id: null, input_id })),
  ]
  if (inserts.length > 0) {
    await supabase.from('space_items').insert(inserts)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { item_id } = await req.json()

  const { error } = await supabase
    .from('space_items')
    .delete()
    .eq('id', item_id)
    .eq('space_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ deleted: true })
}
