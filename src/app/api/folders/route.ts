import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Create folder manually
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, node_ids } = await req.json()

  const { data: folder, error } = await supabase
    .from('folders')
    .insert({
      user_id: user.id,
      name,
      description: description || null,
      confidence: 1.0,
      created_by: 'user',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Link nodes if provided
  if (node_ids?.length > 0) {
    const rows = node_ids.map((nodeId: string) => ({
      folder_id: folder.id,
      node_id: nodeId,
      added_by: 'user',
    }))
    await supabase.from('folder_nodes').insert(rows)
  }

  return NextResponse.json(folder)
}
