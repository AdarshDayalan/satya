import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PublicProfile from '@/components/PublicProfile'

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!profile) notFound()

  // Fetch published node IDs
  const { data: publishedNodeRows } = await supabase
    .from('published_nodes')
    .select('node_id')
    .eq('profile_id', profile.id)

  const publishedNodeIds = (publishedNodeRows ?? []).map((r) => r.node_id)

  if (publishedNodeIds.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-light text-white/90">{profile.display_name}</h1>
          <p className="text-neutral-600 text-sm">nothing published yet</p>
        </div>
      </div>
    )
  }

  // Fetch published nodes with their data
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, content, type, input_id, created_at')
    .in('id', publishedNodeIds)
    .order('created_at', { ascending: false })

  // Fetch edges between published nodes
  const { data: edges } = await supabase
    .from('edges')
    .select('from_node_id, to_node_id, relationship, strength')
    .in('from_node_id', publishedNodeIds)
    .in('to_node_id', publishedNodeIds)

  // Fetch published folders
  const { data: publishedFolderRows } = await supabase
    .from('published_folders')
    .select('folder_id')
    .eq('profile_id', profile.id)

  const publishedFolderIds = (publishedFolderRows ?? []).map((r) => r.folder_id)

  let folders: { id: string; name: string; description: string | null }[] = []
  if (publishedFolderIds.length > 0) {
    const { data } = await supabase
      .from('folders')
      .select('id, name, description')
      .in('id', publishedFolderIds)
    folders = data ?? []
  }

  // Fetch source info for nodes
  const inputIds = [...new Set((nodes ?? []).map((n) => n.input_id).filter(Boolean))]
  let inputs: Record<string, { source_type: string; source_metadata: Record<string, unknown> }> = {}
  if (inputIds.length > 0) {
    const { data } = await supabase
      .from('inputs')
      .select('id, source_type, source_metadata')
      .in('id', inputIds)
    for (const inp of data ?? []) {
      inputs[inp.id] = { source_type: inp.source_type, source_metadata: inp.source_metadata || {} }
    }
  }

  return (
    <PublicProfile
      profile={profile}
      nodes={nodes ?? []}
      edges={edges ?? []}
      folders={folders}
      inputs={inputs}
    />
  )
}
