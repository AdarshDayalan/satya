'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ActionMenu from './ActionMenu'
import EditModal from './EditModal'
import ConfirmDialog from './ConfirmDialog'

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

interface Connection {
  node: { id: string; content: string; type: string }
  relationship: string
  strength: number
  reason: string
  edgeId: string
}

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  journal: { label: 'Journal', color: 'text-white/50' },
  youtube: { label: 'YouTube', color: 'text-red-400' },
  instagram: { label: 'Instagram', color: 'text-pink-400' },
  article: { label: 'Article', color: 'text-blue-400' },
  research_paper: { label: 'Paper', color: 'text-green-400' },
  reddit: { label: 'Reddit', color: 'text-orange-400' },
  pubmed: { label: 'PubMed', color: 'text-cyan-400' },
}

interface SourceInput {
  id: string
  raw_content: string
  source_type: string
  source_metadata: Record<string, unknown>
  source_url?: string
  created_at: string
}

interface NodeDetailProps {
  node: { id: string; content: string; type: string; created_at: string; input_id: string | null }
  connections: Connection[]
  sourceInput?: SourceInput | null
}

export default function NodeDetail({ node, connections, sourceInput }: NodeDetailProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingEdge, setDeletingEdge] = useState<string | null>(null)

  const grouped: Record<string, Connection[]> = {}
  for (const c of connections) {
    if (!grouped[c.relationship]) grouped[c.relationship] = []
    grouped[c.relationship].push(c)
  }

  async function handleSave(content: string) {
    await fetch(`/api/nodes/${node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    router.refresh()
  }

  async function handleDelete() {
    await fetch(`/api/nodes/${node.id}`, { method: 'DELETE' })
    router.push('/home')
  }

  async function handleDeleteEdge(edgeId: string) {
    await fetch(`/api/edges/${edgeId}`, { method: 'DELETE' })
    setDeletingEdge(null)
    router.refresh()
  }

  return (
    <>
      <div className="animate-fade-up space-y-3 group">
        <div className="flex items-start justify-between">
          <span className={`text-[11px] uppercase tracking-widest ${typeColors[node.type] || 'text-neutral-600'}`}>
            {node.type}
          </span>
          <ActionMenu actions={[
            { label: 'Edit', onClick: () => setEditing(true) },
            { label: 'Delete', onClick: () => setDeleting(true), danger: true },
          ]} />
        </div>
        <p className="text-[18px] text-white/90 leading-relaxed">{node.content}</p>
        <p className="text-[11px] text-neutral-700">
          {new Date(node.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Source context */}
      {sourceInput && (
        <div className="space-y-2">
          <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1">
            Source
          </h2>
          <Link
            href={`/inputs/${sourceInput.id}`}
            className="block bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 hover:bg-white/[0.04] transition-colors space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-medium ${(SOURCE_CONFIG[sourceInput.source_type] || SOURCE_CONFIG.journal).color}`}>
                {(SOURCE_CONFIG[sourceInput.source_type] || SOURCE_CONFIG.journal).label}
              </span>
              {typeof sourceInput.source_metadata?.title === 'string' && (
                <>
                  <span className="text-neutral-800">·</span>
                  <span className="text-[12px] text-white/70 font-medium truncate">
                    {sourceInput.source_metadata.title}
                  </span>
                </>
              )}
            </div>
            {sourceInput.source_url && (
              <p className="text-[11px] text-blue-400/50 truncate">{sourceInput.source_url}</p>
            )}
            <p className="text-[13px] text-white/50 leading-relaxed line-clamp-3 whitespace-pre-wrap">
              {sourceInput.raw_content}
            </p>
            <p className="text-[10px] text-neutral-700">
              {new Date(sourceInput.created_at).toLocaleDateString()}
            </p>
          </Link>
        </div>
      )}

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
                {items.map((item) => (
                  <div key={item.edgeId} className="group relative">
                    <Link
                      href={`/nodes/${item.node.id}`}
                      className="node-card block bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 pr-10"
                    >
                      <p className="text-white/80 text-[14px] leading-relaxed">{item.node.content}</p>
                      {item.reason && (
                        <p className="text-neutral-700 text-[11px] mt-1.5 italic">{item.reason}</p>
                      )}
                    </Link>
                    <button
                      onClick={() => setDeletingEdge(item.edgeId)}
                      className="absolute top-3 right-3 p-1 rounded text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove connection"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 3l8 8M11 3l-8 8" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-neutral-700 text-sm">no connections yet — this fragment floats alone</p>
      )}

      <EditModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        onSave={handleSave}
        title="Edit node"
        initialValue={node.content}
      />

      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={handleDelete}
        title="Delete node"
        message="This will remove this node and all its connections. This cannot be undone."
      />

      <ConfirmDialog
        isOpen={!!deletingEdge}
        onClose={() => setDeletingEdge(null)}
        onConfirm={() => deletingEdge && handleDeleteEdge(deletingEdge)}
        title="Remove connection"
        message="This will remove this relationship between the two nodes."
      />
    </>
  )
}
