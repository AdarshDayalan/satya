import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns the folder ids a given node belongs to. Used by the wishlist picker
// to show which folders the node is already saved to.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const nodeId = searchParams.get('node_id')
  if (!nodeId) return NextResponse.json({ error: 'node_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('folder_nodes')
    .select('folder_id')
    .eq('node_id', nodeId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ folder_ids: (data || []).map(r => r.folder_id) })
}
