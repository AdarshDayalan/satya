import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  journal: { label: 'Journal', color: 'text-white/50' },
  youtube: { label: 'YouTube', color: 'text-red-400' },
  instagram: { label: 'Instagram', color: 'text-pink-400' },
  article: { label: 'Article', color: 'text-blue-400' },
  research_paper: { label: 'Paper', color: 'text-green-400' },
}

const typeColors: Record<string, string> = {
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

export default async function InputPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: input } = await supabase
    .from('inputs')
    .select('*')
    .eq('id', id)
    .single()

  if (!input) redirect('/home')

  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, content, type, created_at')
    .eq('input_id', id)
    .order('created_at', { ascending: true })

  const sourceType = input.source_type || 'journal'
  const config = SOURCE_CONFIG[sourceType] || SOURCE_CONFIG.journal
  const metadata = (input.source_metadata || {}) as Record<string, unknown>

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
          <div className="flex items-center gap-3">
            <span className={`text-[11px] uppercase tracking-widest font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-neutral-800">·</span>
            <span className="text-[11px] text-neutral-700">
              {new Date(input.created_at).toLocaleDateString()}
            </span>
            <span className="text-neutral-800">·</span>
            <span className={`text-[11px] ${input.status === 'processed' ? 'text-green-400/50' : 'text-amber-400/50'}`}>
              {input.status}
            </span>
          </div>

          {/* Source metadata */}
          {metadata.title && (
            <h2 className="text-[18px] text-white/90 leading-relaxed font-medium">
              {metadata.title as string}
            </h2>
          )}
          {metadata.author && (
            <p className="text-[13px] text-neutral-500">{metadata.author as string}</p>
          )}
          {input.source_url && (
            <a
              href={input.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-blue-400/60 hover:text-blue-400 transition-colors break-all"
            >
              {input.source_url}
            </a>
          )}

          {/* Raw content */}
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3">
            <p className="text-white/70 text-[14px] leading-relaxed whitespace-pre-wrap">
              {input.raw_content}
            </p>
          </div>
        </div>

        {/* Extracted nodes */}
        {nodes && nodes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1">
              Extracted Nodes
            </h2>
            <div className="space-y-1.5 stagger-children">
              {nodes.map((node: { id: string; content: string; type: string }) => (
                <Link
                  key={node.id}
                  href={`/nodes/${node.id}`}
                  className="node-card block bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 hover:bg-white/[0.04]"
                >
                  <p className="text-white/80 text-[14px] leading-relaxed">{node.content}</p>
                  <span className={`text-[11px] mt-1.5 inline-block ${typeColors[node.type] || 'text-neutral-600'}`}>
                    {node.type}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
