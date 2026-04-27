import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const typeColors: Record<string, string> = {
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: folder } = await supabase
    .from('folders')
    .select('*')
    .eq('id', id)
    .single()

  if (!folder) redirect('/home')

  const { data: folderNodes } = await supabase
    .from('folder_nodes')
    .select('node:nodes(id, content, type, created_at)')
    .eq('folder_id', id)

  const nodes = (folderNodes ?? [])
    .map((fn: Record<string, unknown>) => fn.node as { id: string; content: string; type: string; created_at: string })
    .filter(Boolean)

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-purple-500/[0.01] blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-4 py-3">
        <Link href="/home" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">
          &larr; back
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 space-y-8 relative z-10">
        <div className="animate-fade-up space-y-3">
          <span className="text-[11px] uppercase tracking-widest text-purple-400/50">
            emerging theme
          </span>
          <h1 className="text-[22px] font-light text-white/90">{folder.name}</h1>
          {folder.description && (
            <p className="text-neutral-500 text-[14px] leading-relaxed">{folder.description}</p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-neutral-700">
            <span>{nodes.length} fragments</span>
            <span>·</span>
            <span>{Math.round(folder.confidence * 100)}% confidence</span>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1 mb-3">
            Cluster
          </h2>
          <div className="space-y-1.5 stagger-children">
            {nodes.map((node) => (
              <Link
                key={node.id}
                href={`/nodes/${node.id}`}
                className="node-card block bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3"
              >
                <p className="text-white/80 text-[14px] leading-relaxed">{node.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[11px] ${typeColors[node.type] || 'text-neutral-600'}`}>
                    {node.type}
                  </span>
                  <span className="text-neutral-800">·</span>
                  <span className="text-[11px] text-neutral-700">
                    {new Date(node.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
            {nodes.length === 0 && (
              <p className="text-neutral-700 text-sm">this theme is still forming</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
