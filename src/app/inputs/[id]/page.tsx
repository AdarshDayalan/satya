import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import JournalEditor from '@/components/JournalEditor'
import InputActions from '@/components/InputActions'
import MarkdownContent from '@/components/MarkdownContent'

const SOURCE_CONFIG: Record<string, { label: string; color: string; isPage: boolean }> = {
  journal: { label: 'Journal', color: 'text-white/50', isPage: true },
  youtube: { label: 'YouTube', color: 'text-red-400', isPage: false },
  instagram: { label: 'Instagram', color: 'text-pink-400', isPage: false },
  article: { label: 'Article', color: 'text-blue-400', isPage: false },
  research_paper: { label: 'Paper', color: 'text-green-400', isPage: false },
  reddit: { label: 'Reddit', color: 'text-orange-400', isPage: false },
  pubmed: { label: 'PubMed', color: 'text-cyan-400', isPage: false },
}

const typeColors: Record<string, string> = {
  concept: 'text-pink-400/60',
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
  const isJournal = config.isPage

  // Extract title from first markdown heading or metadata
  const firstLine = input.raw_content?.split('\n')[0] || ''
  const markdownTitle = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '') : null
  const title = (metadata.title as string) || markdownTitle

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.008] blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-4 py-3 flex items-center justify-between">
        <Link href="/home" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">
          &larr; back
        </Link>
        {!isJournal && <InputActions inputId={input.id} status={input.status} />}
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 space-y-8 relative z-10">
        <div className="animate-fade-up space-y-3">
          {/* Header meta */}
          <div className="flex items-center gap-3">
            <span className={`text-[11px] uppercase tracking-widest font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-neutral-800">·</span>
            <span className="text-[11px] text-neutral-700">
              {new Date(input.created_at).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            {input.status !== 'processed' && (
              <>
                <span className="text-neutral-800">·</span>
                <span className={`text-[11px] ${input.status === 'failed' ? 'text-red-400/50' : 'text-amber-400/50'}`}>
                  {input.status}
                </span>
              </>
            )}
          </div>

          {/* Title for non-journal sources */}
          {!isJournal && title && (
            <h1 className="text-[22px] font-light text-white/90 leading-relaxed">{title}</h1>
          )}
          {!isJournal && metadata.author && (
            <p className="text-[13px] text-neutral-500">{metadata.author as string}</p>
          )}
          {input.source_url && (
            <a
              href={input.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-blue-400/60 hover:text-blue-400 transition-colors break-all inline-block"
            >
              {input.source_url}
            </a>
          )}
        </div>

        {/* Journal = editable markdown page */}
        {isJournal ? (
          <JournalEditor
            inputId={input.id}
            content={input.raw_content}
            status={input.status}
          />
        ) : (
          /* Non-journal: render as markdown too but read-only */
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-5 py-4">
            <MarkdownContent content={input.raw_content} />
          </div>
        )}

        {/* Extracted nodes */}
        {nodes && nodes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1">
              Extracted meaning
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
