import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ publishedNodes: [], publishedFolders: [] })

  const [{ data: publishedNodes }, { data: publishedFolders }] = await Promise.all([
    supabase
      .from('published_nodes')
      .select('node_id')
      .eq('profile_id', profile.id),
    supabase
      .from('published_folders')
      .select('folder_id')
      .eq('profile_id', profile.id),
  ])

  return NextResponse.json({
    publishedNodes: (publishedNodes ?? []).map((r) => r.node_id),
    publishedFolders: (publishedFolders ?? []).map((r) => r.folder_id),
  })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, node_id, folder_id } = await req.json()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Create a profile first at /publish' }, { status: 400 })
  }

  if (node_id) {
    if (action === 'publish') {
      const { error } = await supabase
        .from('published_nodes')
        .upsert({ profile_id: profile.id, node_id }, { onConflict: 'profile_id,node_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      await supabase
        .from('published_nodes')
        .delete()
        .eq('profile_id', profile.id)
        .eq('node_id', node_id)
    }
  }

  if (folder_id) {
    if (action === 'publish') {
      // Publish folder + all its nodes
      const { error } = await supabase
        .from('published_folders')
        .upsert({ profile_id: profile.id, folder_id }, { onConflict: 'profile_id,folder_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      const { data: folderNodes } = await supabase
        .from('folder_nodes')
        .select('node_id')
        .eq('folder_id', folder_id)

      if (folderNodes?.length) {
        const rows = folderNodes.map((fn) => ({ profile_id: profile.id, node_id: fn.node_id }))
        await supabase
          .from('published_nodes')
          .upsert(rows, { onConflict: 'profile_id,node_id' })
      }
    } else {
      await supabase
        .from('published_folders')
        .delete()
        .eq('profile_id', profile.id)
        .eq('folder_id', folder_id)
    }
  }

  return NextResponse.json({ ok: true })
}
