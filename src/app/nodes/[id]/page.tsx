import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const relColors: Record<string, string> = {
  supports: 'rel-supports',
  contradicts: 'rel-contradicts',
  refines: 'rel-refines',
  similar: 'rel-similar',
  causes: 'rel-causes',
  example_of: 'rel-example_of',
  related: 'rel-related',
}

const typeColors: Record<string, string> = {
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

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
    .select('*, to_node:nodes!edges_to_node_id_fkey(id, content, type)')
    .eq('from_node_id', id)

  const { data: edgesTo } = await supabase
    .from('edges')
    .select('*, from_node:nodes!edges_from_node_id_fkey(id, content, type)')
    .eq('to_node_id', id)

  const connections = [
    ...(edgesFrom ?? []).map((e: Record<string, unknown>) => ({
      node: e.to_node as { id: string; content: string; type: string },
      relationship: e.relationship as string,
      strength: e.strength as number,
      reason: e.reason as string,
    })),
    ...(edgesTo ?? []).map((e: Record<string, unknown>) => ({
      node: e.from_node as { id: string; content: string; type: string },
      relationship: e.relationship as string,
      strength: e.strength as number,
      reason: e.reason as string,
    })),
  ]

  const grouped: Record<string, typeof connections> = {}
  for (const c of connections) {
    if (!grouped[c.relationship]) grouped[c.relationship] = []
    grouped[c.relationship].push(c)
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.008] blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-4 py-3">
        <Link href="/home" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">
          &larr; back
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 space-y-8 relative z-10">
        <div className="animate-fade-up space-y-3">
          <span className={`text-[11px] uppercase tracking-widest ${typeColors[node.type] || 'text-neutral-600'}`}>
            {node.type}
          </span>
          <p className="text-[18px] text-white/90 leading-relaxed">{node.content}</p>
          <p className="text-[11px] text-neutral-700">
            {new Date(node.created_at).toLocaleDateString()}
          </p>
        </div>

        {Object.keys(grouped).length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1">
              Connections
            </h2>
            {Object.entries(grouped).map(([rel, items]) => (
              <div key={rel} className="space-y-1.5">
                <h3 className={`text-[11px] uppercase tracking-widest px-1 ${relColors[rel] || 'text-neutral-600'}`}>
                  {rel.replace('_', ' ')}
                </h3>
                <div className="space-y-1.5 stagger-children">
                  {items.map((item, i) => (
                    <Link
                      key={i}
                      href={`/nodes/${item.node.id}`}
                      className="node-card block bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3"
                    >
                      <p className="text-white/80 text-[14px] leading-relaxed">{item.node.content}</p>
                      {item.reason && (
                        <p className="text-neutral-700 text-[11px] mt-1.5 italic">{item.reason}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-700 text-sm">no connections yet — this fragment floats alone</p>
        )}
      </main>
    </div>
  )
}
