import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Add node to folder
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: folderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { node_id } = await req.json()

  const { error } = await supabase
    .from('folder_nodes')
    .insert({ folder_id: folderId, node_id, added_by: 'user' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ added: true })
}

// Remove node from folder
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: folderId } = await params
  const { searchParams } = new URL(req.url)
  const nodeId = searchParams.get('node_id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('folder_nodes')
    .delete()
    .eq('folder_id', folderId)
    .eq('node_id', nodeId!)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ removed: true })
}
