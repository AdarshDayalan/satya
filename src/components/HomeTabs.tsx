'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NodeList from './NodeList'
import FolderList from './FolderList'
import KnowledgeGraph from './KnowledgeGraph'
import CreateNodeModal from './CreateNodeModal'

interface Node {
  id: string
  content: string
  type: string
  input_id: string | null
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

interface FolderNode {
  folder_id: string
  node_id: string
}

interface Input {
  id: string
  raw_content: string
  source_type: string
  source_metadata: Record<string, unknown>
}

const TABS = [
  { key: 'graph', label: 'field' },
  { key: 'fragments', label: 'fragments' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function HomeTabs({
  nodes,
  edges,
  folders,
  folderNodes,
  inputs,
  onSelect,
}: {
  nodes: Node[]
  edges: Edge[]
  folders: Folder[]
  folderNodes: FolderNode[]
  inputs: Input[]
  onSelect?: (type: 'node' | 'input', id: string) => void
}) {
  const [tab, setTab] = useState<TabKey>('graph')
  const [createOpen, setCreateOpen] = useState(false)
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 px-1">
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

      {tab === 'graph' && (
        <div className="relative">
          <KnowledgeGraph nodes={nodes} edges={edges} folders={folders} folderNodes={folderNodes} />
          <button
            onClick={() => setCreateOpen(true)}
            className="absolute bottom-3 right-3 text-[11px] text-neutral-600 hover:text-white/70 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
          >
            + node
          </button>
          <CreateNodeModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => router.refresh()} />
        </div>
      )}

      {tab === 'fragments' && (
        <div className="space-y-10">
          <FolderList folders={folders} />
          <NodeList nodes={nodes} inputs={inputs} onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}
