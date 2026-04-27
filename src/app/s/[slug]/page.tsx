import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PublicProfile from '@/components/PublicProfile'

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch space by slug — RLS ensures only public spaces are readable by anon
  const { data: space } = await supabase
    .from('spaces')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (!space) notFound()

  // Fetch space items
  const { data: items } = await supabase
    .from('space_items')
    .select('node_id, input_id')
    .eq('space_id', space.id)
    .order('sort_order', { ascending: true })

  const nodeIds = (items ?? []).map((i) => i.node_id).filter(Boolean)

  if (nodeIds.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-light text-white/90">{space.name}</h1>
          <p className="text-neutral-600 text-sm">{space.description || 'nothing here yet'}</p>
        </div>
      </div>
    )
  }

  // Fetch nodes
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, content, type, input_id, created_at')
    .in('id', nodeIds)
    .order('created_at', { ascending: false })

  // Fetch edges between these nodes
  const { data: edges } = await supabase
    .from('edges')
    .select('from_node_id, to_node_id, relationship, strength')
    .in('from_node_id', nodeIds)
    .in('to_node_id', nodeIds)

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
      profile={{ display_name: space.name, slug: space.slug }}
      nodes={nodes ?? []}
      edges={edges ?? []}
      folders={[]}
      inputs={inputs}
    />
  )
}
