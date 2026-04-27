import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: input } = await supabase
    .from('inputs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!input) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, content, type')
    .eq('input_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ input, nodes: nodes ?? [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { raw_content } = await req.json()
  const { data, error } = await supabase
    .from('inputs')
    .update({ raw_content })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ input: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete nodes (edges cascade), then input
  await supabase.from('nodes').delete().eq('input_id', id).eq('user_id', user.id)
  const { error } = await supabase.from('inputs').delete().eq('id', id).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ deleted: true })
}
