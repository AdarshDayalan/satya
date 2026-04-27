import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

  // Get edges where this node is involved
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

  // Group by relationship type
  const grouped: Record<string, typeof connections> = {}
  for (const c of connections) {
    const key = c.relationship
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(c)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800 px-4 py-4">
        <Link href="/home" className="text-sm text-neutral-400 hover:text-white transition">
          &larr; Back
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <span className="text-xs uppercase tracking-wide text-neutral-500">{node.type}</span>
          <p className="text-lg text-white mt-1">{node.content}</p>
          <p className="text-xs text-neutral-500 mt-2">
            {new Date(node.created_at).toLocaleDateString()}
          </p>
        </div>

        {Object.keys(grouped).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
              Connections
            </h2>
            {Object.entries(grouped).map(([rel, items]) => (
              <div key={rel}>
                <h3 className="text-xs text-neutral-500 uppercase mb-2">{rel}</h3>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <Link
                      key={i}
                      href={`/nodes/${item.node.id}`}
                      className="block bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 hover:border-neutral-600 transition"
                    >
                      <p className="text-sm text-white">{item.node.content}</p>
                      {item.reason && (
                        <p className="text-xs text-neutral-500 mt-1">{item.reason}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {Object.keys(grouped).length === 0 && (
          <p className="text-neutral-500 text-sm">No connections yet.</p>
        )}
      </main>
    </div>
  )
}
