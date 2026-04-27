'use client'

import { useState } from 'react'
import NodeList from './NodeList'
import FolderList from './FolderList'
import KnowledgeGraph from './KnowledgeGraph'

interface Node {
  id: string
  content: string
  type: string
  created_at: string
}

interface Edge {
  from_node_id: string
  to_node_id: string
  relationship: string
  strength: number
}

interface Folder {
  id: string
  name: string
  description: string | null
  confidence: number
  created_at: string
}

const TABS = [
  { key: 'fragments', label: 'fragments' },
  { key: 'graph', label: 'graph' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function HomeTabs({
  nodes,
  edges,
  folders,
}: {
  nodes: Node[]
  edges: Edge[]
  folders: Folder[]
}) {
  const [tab, setTab] = useState<TabKey>('fragments')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest rounded-lg border transition-all ${
              tab === t.key
                ? 'border-white/10 text-white/80 bg-white/[0.06]'
                : 'border-transparent text-neutral-600 hover:text-neutral-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fragments' && (
        <div className="space-y-10">
          <FolderList folders={folders} />
          <NodeList nodes={nodes} />
        </div>
      )}

      {tab === 'graph' && <KnowledgeGraph nodes={nodes} edges={edges} />}
    </div>
  )
}
