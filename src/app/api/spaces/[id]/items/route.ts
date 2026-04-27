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
