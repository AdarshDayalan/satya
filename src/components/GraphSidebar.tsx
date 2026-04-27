'use client'

import { useGraphNavigation, useGraphSidebarData } from './GraphNavigationContext'

const TYPE_DOTS: Record<string, string> = {
  concept: 'bg-pink-400',
  idea: 'bg-blue-400',
  question: 'bg-amber-400',
  source: 'bg-green-400',
  synthesis: 'bg-purple-400',
  raw: 'bg-neutral-500',
}

interface GraphSidebarProps {
  nodes: Array<{ id: string; content: string; type: string }>
  edges: Array<{ from_node_id: string; to_node_id: string; relationship: string; strength: number }>
  onNodeDetail?: (nodeId: string) => void
}

export default function GraphSidebar({ nodes, edges, onNodeDetail }: GraphSidebarProps) {
  const { pushFocus, popFocus, jumpTo, resetFocus, focusStack } = useGraphNavigation()
  const { sidebarNodes, breadcrumbs } = useGraphSidebarData(nodes, edges)

  return (
    <aside className="w-56 shrink-0 border-r border-white/[0.04] bg-[#080808] overflow-y-auto flex flex-col">
      {/* Breadcrumbs */}
      <div className="px-3 py-2.5 border-b border-white/[0.04] space-y-1">
        <button
          onClick={resetFocus}
          className={`text-[10px] uppercase tracking-widest transition-colors ${
            focusStack.length === 0
              ? 'text-white/60 font-medium'
              : 'text-neutral-600 hover:text-neutral-400'
          }`}
        >
          All concepts
        </button>

        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.id} className="flex items-center gap-1" style={{ paddingLeft: `${(i + 1) * 8}px` }}>
            <span className="text-neutral-700 text-[10px]">›</span>
            <button
              onClick={() => {
                if (i === breadcrumbs.length - 1) return // Already focused
                jumpTo(i)
              }}
              className={`text-[11px] truncate transition-colors text-left ${
                i === breadcrumbs.length - 1
                  ? 'text-white/70 font-medium'
                  : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {crumb.label}
            </button>
          </div>
        ))}
      </div>

      {/* Back button */}
      {focusStack.length > 0 && (
        <button
          onClick={popFocus}
          className="px-3 py-1.5 text-[11px] text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.03] transition-colors text-left border-b border-white/[0.04]"
        >
          ← back
        </button>
      )}

      {/* Node list at current depth */}
      <div className="flex-1 py-1">
        {sidebarNodes.length === 0 && (
          <p className="px-3 py-4 text-[11px] text-neutral-700 italic">no children</p>
        )}
        {sidebarNodes.map((node) => (
          <button
            key={node.id}
            onClick={() => pushFocus(node.id)}
            onDoubleClick={() => onNodeDetail?.(node.id)}
            className="w-full text-left px-3 py-1.5 flex items-start gap-2 hover:bg-white/[0.04] transition-colors group"
          >
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TYPE_DOTS[node.type] || TYPE_DOTS.raw} opacity-60`} />
            <span className="text-[12px] text-white/60 group-hover:text-white/80 leading-snug line-clamp-2">
              {node.content}
            </span>
          </button>
        ))}
      </div>

      {/* Count */}
      <div className="px-3 py-2 border-t border-white/[0.04]">
        <span className="text-[10px] text-neutral-700">{sidebarNodes.length} nodes</span>
      </div>
    </aside>
  )
}
