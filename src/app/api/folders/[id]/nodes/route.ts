import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Add node to folder
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: folderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const nodeIds: string[] = body.node_ids || (body.node_id ? [body.node_id] : [])

  if (nodeIds.length === 0) return NextResponse.json({ error: 'No node_id(s) provided' }, { status: 400 })

  const rows = nodeIds.map(nid => ({ folder_id: folderId, node_id: nid, added_by: 'user' }))
  const { error } = await supabase
    .from('folder_nodes')
    .upsert(rows, { onConflict: 'folder_id,node_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ added: nodeIds.length })
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
