import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// List the user's folders. Pass `?favorites=1` to limit to user-created folders
// (excluding AI-auto-generated theme folders) — used by the favorites picker in SidePanel.
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const favoritesOnly = searchParams.get('favorites') === '1'

  let query = supabase
    .from('folders')
    .select('id, name, created_by')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (favoritesOnly) query = query.eq('created_by', 'user')

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ folders: data || [] })
}

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
