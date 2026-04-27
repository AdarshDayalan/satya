import Link from 'next/link'

interface Node {
  id: string
  content: string
  type: string
  created_at: string
}

const typeColors: Record<string, string> = {
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

export default function NodeList({ nodes }: { nodes: Node[] }) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-neutral-600 text-sm">nothing here yet</p>
        <p className="text-neutral-700 text-xs">drop a thought, a link, a fragment of truth</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1 mb-3">
        Fragments
      </h2>
      <div className="space-y-1.5 stagger-children">
        {nodes.map((node) => (
          <Link
            key={node.id}
            href={`/nodes/${node.id}`}
            className="node-card block bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 hover:bg-white/[0.04]"
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
      </div>
    </div>
  )
}
