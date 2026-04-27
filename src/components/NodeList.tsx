'use client'

import Link from 'next/link'

interface Node {
  id: string
  content: string
  type: string
  input_id: string | null
  created_at: string
}

interface Input {
  id: string
  raw_content: string
  source_type: string
  source_metadata: Record<string, unknown>
}

const typeColors: Record<string, string> = {
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  journal: { label: 'journal', color: 'text-white/40' },
  youtube: { label: 'YouTube', color: 'text-red-400/50' },
  instagram: { label: 'Instagram', color: 'text-pink-400/50' },
  article: { label: 'article', color: 'text-blue-400/50' },
  research_paper: { label: 'paper', color: 'text-green-400/50' },
  reddit: { label: 'Reddit', color: 'text-orange-400/50' },
  pubmed: { label: 'PubMed', color: 'text-cyan-400/50' },
}

export default function NodeList({ nodes, inputs }: { nodes: Node[]; inputs: Input[] }) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-neutral-600 text-sm">nothing here yet</p>
        <p className="text-neutral-700 text-xs">drop a thought, a link, a fragment of truth</p>
      </div>
    )
  }

  const inputMap = new Map(inputs.map((i) => [i.id, i]))

  return (
    <div className="space-y-2">
      <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1 mb-3">
        Fragments
      </h2>
      <div className="space-y-1.5 stagger-children">
        {nodes.map((node) => {
          const input = node.input_id ? inputMap.get(node.input_id) : null
          const sourceConfig = input ? (SOURCE_CONFIG[input.source_type] || SOURCE_CONFIG.journal) : null
          const sourceTitle = input
            ? (input.source_metadata?.title as string) ||
              input.raw_content.slice(0, 50) + (input.raw_content.length > 50 ? '…' : '')
            : null

          return (
            <Link
              key={node.id}
              href={`/nodes/${node.id}`}
              className="node-card block bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 hover:bg-white/[0.04]"
            >
              <p className="text-white/80 text-[14px] leading-relaxed">{node.content}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-[11px] ${typeColors[node.type] || 'text-neutral-600'}`}>
                  {node.type}
                </span>
                <span className="text-neutral-800">·</span>
                <span className="text-[11px] text-neutral-700">
                  {new Date(node.created_at).toLocaleDateString()}
                </span>
                {sourceConfig && (
                  <>
                    <span className="text-neutral-800">·</span>
                    <span className={`text-[10px] ${sourceConfig.color}`}>
                      from {sourceConfig.label}
                    </span>
                    {sourceTitle && (
                      <span className="text-[10px] text-neutral-600 truncate max-w-[200px]">
                        {sourceTitle}
                      </span>
                    )}
                  </>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
