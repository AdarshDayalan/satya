import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NodeDetail from '@/components/NodeDetail'

export default async function NodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: node } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', id)
    .single()

  if (!node) redirect('/home')

  const { data: edgesFrom } = await supabase
    .from('edges')
    .select('id, relationship, strength, reason, to_node:nodes!edges_to_node_id_fkey(id, content, type)')
    .eq('from_node_id', id)

  const { data: edgesTo } = await supabase
    .from('edges')
    .select('id, relationship, strength, reason, from_node:nodes!edges_from_node_id_fkey(id, content, type)')
    .eq('to_node_id', id)

  // Fetch the source input for this node
  let sourceInput = null
  if (node.input_id) {
    const { data } = await supabase
      .from('inputs')
      .select('id, raw_content, source_type, source_metadata, source_url, created_at')
      .eq('id', node.input_id)
      .single()
    sourceInput = data
  }

  // Get all nodes for the connect modal
  const { data: allNodes } = await supabase
    .from('nodes')
    .select('id, content, type')
    .order('created_at', { ascending: false })
    .limit(100)

  const connections = [
    ...(edgesFrom ?? []).map((e: Record<string, unknown>) => ({
      node: e.to_node as { id: string; content: string; type: string },
      relationship: e.relationship as string,
      strength: e.strength as number,
      reason: e.reason as string,
      edgeId: e.id as string,
    })),
    ...(edgesTo ?? []).map((e: Record<string, unknown>) => ({
      node: e.from_node as { id: string; content: string; type: string },
      relationship: e.relationship as string,
      strength: e.strength as number,
      reason: e.reason as string,
      edgeId: e.id as string,
    })),
  ]

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.008] blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-4 py-3">
        <Link href="/home" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">
          &larr; back
        </Link>
      </header>

      <main className="px-10 py-8 space-y-8 relative z-10 max-w-[900px]">
        <NodeDetail node={node} connections={connections} sourceInput={sourceInput} allNodes={allNodes ?? []} />
      </main>
    </div>
  )
}
