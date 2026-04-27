'use client'

import { useState } from 'react'
import Portal from './Portal'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ActionMenu from './ActionMenu'
import EditModal from './EditModal'
import ConfirmDialog from './ConfirmDialog'
import CreateEdgeModal from './CreateEdgeModal'

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
  concept: 'text-pink-400/60',
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

const NODE_TYPES = ['concept', 'idea', 'question', 'source', 'synthesis']

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
  node: { id: string; content: string; type: string; weight: number; created_at: string; input_id: string | null }
  connections: Connection[]
  sourceInput?: SourceInput | null
  allNodes: Array<{ id: string; content: string; type: string }>
}

export default function NodeDetail({ node, connections, sourceInput, allNodes }: NodeDetailProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingEdge, setDeletingEdge] = useState<string | null>(null)
  const [editingEdge, setEditingEdge] = useState<Connection | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [edgeStrength, setEdgeStrength] = useState(0.8)
  const [edgeRelationship, setEdgeRelationship] = useState('supports')

  const grouped: Record<string, Connection[]> = {}
  for (const c of connections) {
    if (!grouped[c.relationship]) grouped[c.relationship] = []
    grouped[c.relationship].push(c)
  }

  async function handleSave(content: string) {
    setEditing(false)
    fetch(`/api/nodes/${node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(() => router.refresh())
  }

  function handleTypeChange(newType: string) {
    fetch(`/api/nodes/${node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newType }),
    }).then(() => router.refresh())
  }

  function handleWeightChange(newWeight: number) {
    fetch(`/api/nodes/${node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight: newWeight }),
    })
  }

  async function handleDelete() {
    router.push('/home')
    fetch(`/api/nodes/${node.id}`, { method: 'DELETE' })
  }

  function handleDeleteEdge(edgeId: string) {
    setDeletingEdge(null)
    fetch(`/api/edges/${edgeId}`, { method: 'DELETE' }).then(() => router.refresh())
  }

  function handleUpdateEdge() {
    if (!editingEdge) return
    setEditingEdge(null)
    fetch(`/api/edges/${editingEdge.edgeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strength: edgeStrength, relationship: edgeRelationship }),
    }).then(() => router.refresh())
  }

  return (
    <>
      <div className="animate-fade-up space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <select
              value={node.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="text-[11px] uppercase tracking-widest bg-transparent border border-white/[0.06] rounded px-1.5 py-0.5 focus:outline-none focus:border-white/[0.15] cursor-pointer [&>option]:bg-[#111]"
              style={{ color: typeColors[node.type]?.replace('/60', '') || '#888' }}
            >
              {NODE_TYPES.map((t) => (
                <option key={t} value={t} className="text-white/80">{t}</option>
              ))}
            </select>
          </div>
          <ActionMenu actions={[
            { label: 'Edit content', onClick: () => setEditing(true) },
            { label: 'Connect to...', onClick: () => setConnecting(true) },
            { label: 'Delete', onClick: () => setDeleting(true), danger: true },
          ]} />
        </div>
        <p className="text-[18px] text-white/90 leading-relaxed">{node.content}</p>
        <div className="flex items-center gap-4">
          <p className="text-[11px] text-neutral-700">
            {new Date(node.created_at).toLocaleDateString()}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-600">weight</span>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              defaultValue={node.weight}
              onMouseUp={(e) => handleWeightChange(parseFloat((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => handleWeightChange(parseFloat((e.target as HTMLInputElement).value))}
              className="w-20 accent-purple-400"
            />
            <span className="text-[10px] text-neutral-500">{node.weight.toFixed(1)}</span>
          </div>
        </div>
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

      {/* Connections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1">
            Connections
          </h2>
          <button
            onClick={() => setConnecting(true)}
            className="text-[11px] text-purple-400/60 hover:text-purple-400 transition-colors"
          >
            + connect
          </button>
        </div>

        {Object.keys(grouped).length > 0 ? (
          <div className="space-y-6">
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
                        className="node-card block bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 pr-16"
                      >
                        <p className="text-white/80 text-[14px] leading-relaxed">{item.node.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {item.reason && (
                            <p className="text-neutral-700 text-[11px] italic">{item.reason}</p>
                          )}
                          <span className="text-[10px] text-neutral-700">strength: {item.strength.toFixed(1)}</span>
                        </div>
                      </Link>
                      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => { setEditingEdge(item); setEdgeStrength(item.strength); setEdgeRelationship(item.relationship) }}
                          className="p-1 rounded text-neutral-700 hover:text-white/70"
                          title="Edit connection"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M7 2l3 3-7 7H0v-3z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingEdge(item.edgeId)}
                          className="p-1 rounded text-neutral-700 hover:text-red-400"
                          title="Remove connection"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M2 2l8 8M10 2l-8 8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-700 text-sm">no connections yet — this fragment floats alone</p>
        )}
      </div>

      {/* Edit edge modal */}
      {editingEdge && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingEdge(null)} />
          <div className="relative z-[101] bg-[#0a0a0a] border border-white/[0.08] rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4 shadow-2xl">
            <h2 className="text-sm font-medium text-white/80">Edit Connection</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-500 uppercase tracking-widest">Relationship</label>
                <select
                  value={edgeRelationship}
                  onChange={(e) => setEdgeRelationship(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[#111] border border-white/[0.08] rounded-lg text-white/80 text-[12px] focus:outline-none [&>option]:bg-[#111]"
                >
                  {['supports', 'contradicts', 'refines', 'example_of', 'causes', 'similar'].map((r) => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-500 uppercase tracking-widest">Strength ({edgeStrength.toFixed(1)})</label>
                <input
                  type="range" min="0.1" max="1.0" step="0.1"
                  value={edgeStrength}
                  onChange={(e) => setEdgeStrength(parseFloat(e.target.value))}
                  className="w-full accent-purple-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingEdge(null)} className="px-3 py-1.5 text-xs text-neutral-400">cancel</button>
              <button onClick={handleUpdateEdge} className="px-4 py-1.5 text-xs text-white/70 bg-white/[0.08] rounded-lg hover:bg-white/[0.12] border border-white/[0.08]">save</button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      <EditModal isOpen={editing} onClose={() => setEditing(false)} onSave={handleSave} title="Edit node" initialValue={node.content} />
      <ConfirmDialog isOpen={deleting} onClose={() => setDeleting(false)} onConfirm={handleDelete} title="Delete node" message="This will remove this node and all its connections." />
      <ConfirmDialog isOpen={!!deletingEdge} onClose={() => setDeletingEdge(null)} onConfirm={() => deletingEdge && handleDeleteEdge(deletingEdge)} title="Remove connection" message="This will remove this relationship." />
      <CreateEdgeModal open={connecting} onClose={() => setConnecting(false)} onCreated={() => router.refresh()} nodes={allNodes} fromNodeId={node.id} />
    </>
  )
}
