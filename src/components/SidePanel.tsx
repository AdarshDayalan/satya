'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import EditModal from './EditModal'
import ConfirmDialog from './ConfirmDialog'
import CreateEdgeModal from './CreateEdgeModal'

const typeColors: Record<string, string> = {
  concept: 'text-pink-400/60',
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

const relColors: Record<string, string> = {
  supports: 'text-green-400/70',
  contradicts: 'text-red-400/70',
  refines: 'text-blue-400/70',
  similar: 'text-purple-400/70',
  causes: 'text-amber-400/70',
  example_of: 'text-cyan-400/70',
  related: 'text-neutral-500',
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

interface SidePanelProps {
  type: 'node' | 'input'
  id: string
  onClose: () => void
  onNavigate: (type: 'node' | 'input', id: string) => void
  allNodes: Array<{ id: string; content: string; type: string }>
}

interface NodeData {
  id: string; content: string; type: string; weight: number; created_at: string; input_id: string | null
}

interface Connection {
  node: { id: string; content: string; type: string }
  relationship: string; strength: number; reason: string; edgeId: string
}

interface InputData {
  id: string; raw_content: string; source_type: string; source_metadata: Record<string, unknown>
  source_url: string | null; status: string; created_at: string
}

export default function SidePanel({ type, id, onClose, onNavigate, allNodes }: SidePanelProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [nodeData, setNodeData] = useState<NodeData | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [inputData, setInputData] = useState<InputData | null>(null)
  const [inputNodes, setInputNodes] = useState<Array<{ id: string; content: string; type: string }>>([])
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (type === 'node') {
      const res = await fetch(`/api/nodes/${id}`)
      if (res.ok) {
        const data = await res.json()
        setNodeData(data.node)
        setConnections(data.connections || [])
      }
    } else {
      const res = await fetch(`/api/inputs/${id}`)
      if (res.ok) {
        const data = await res.json()
        setInputData(data.input)
        setInputNodes(data.nodes || [])
      }
    }
    setLoading(false)
  }, [type, id])

  useEffect(() => { fetchData() }, [fetchData])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSaveNode(content: string) {
    await fetch(`/api/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    fetchData()
    router.refresh()
  }

  async function handleDeleteNode() {
    await fetch(`/api/nodes/${id}`, { method: 'DELETE' })
    onClose()
    router.refresh()
  }

  async function handleSaveInput(content: string) {
    await fetch(`/api/inputs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_content: content }),
    })
    fetchData()
    router.refresh()
  }

  async function handleDeleteInput() {
    await fetch(`/api/inputs/${id}`, { method: 'DELETE' })
    onClose()
    router.refresh()
  }

  return (
    <div className="w-96 shrink-0 border-l border-white/[0.06] bg-[#080808] overflow-y-auto flex flex-col"
      style={{ minHeight: 'calc(100vh - 49px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-white/[0.06] shrink-0">
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
          {type === 'node' ? 'Node' : 'Source'}
        </span>
        <button onClick={onClose} className="text-neutral-600 hover:text-white/70 text-[11px]">✕</button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[12px] text-neutral-600 animate-pulse">loading...</span>
        </div>
      ) : type === 'node' && nodeData ? (
        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
          {/* Node content */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-widest ${typeColors[nodeData.type] || 'text-neutral-600'}`}>
                {nodeData.type}
              </span>
              <span className="text-neutral-800">·</span>
              <span className="text-[10px] text-neutral-700">
                {new Date(nodeData.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-[14px] text-white/85 leading-relaxed">{nodeData.content}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-[11px] text-neutral-500 hover:text-white/70">edit</button>
            <button onClick={() => setConnecting(true)} className="text-[11px] text-neutral-500 hover:text-white/70">connect</button>
            <button onClick={() => setDeleting(true)} className="text-[11px] text-neutral-500 hover:text-red-400/70">delete</button>
          </div>

          {/* Connections */}
          {connections.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] text-neutral-500 uppercase tracking-widest">Connections</h3>
              {connections.map((c, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate('node', c.node.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors"
                >
                  <p className="text-[12px] text-white/70 leading-snug">{c.node.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] ${relColors[c.relationship] || 'text-neutral-600'}`}>
                      {c.relationship.replace('_', ' ')}
                    </span>
                    {c.reason && (
                      <>
                        <span className="text-neutral-800">·</span>
                        <span className="text-[10px] text-neutral-700 truncate">{c.reason}</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {connections.length === 0 && (
            <p className="text-[11px] text-neutral-700 italic">no connections yet</p>
          )}

          <EditModal isOpen={editing} onClose={() => setEditing(false)} onSave={handleSaveNode} title="Edit node" initialValue={nodeData.content} />
          <ConfirmDialog isOpen={deleting} onClose={() => setDeleting(false)} onConfirm={handleDeleteNode} title="Delete node" message="This will remove this node and all its connections." />
          <CreateEdgeModal open={connecting} onClose={() => setConnecting(false)} onCreated={() => { fetchData(); router.refresh() }} nodes={allNodes} fromNodeId={nodeData.id} />
        </div>
      ) : type === 'input' && inputData ? (
        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
          {/* Source info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-widest font-medium ${SOURCE_CONFIG[inputData.source_type]?.color || 'text-white/50'}`}>
                {SOURCE_CONFIG[inputData.source_type]?.label || inputData.source_type}
              </span>
              <span className="text-neutral-800">·</span>
              <span className="text-[10px] text-neutral-700">
                {new Date(inputData.created_at).toLocaleDateString()}
              </span>
              <span className="text-neutral-800">·</span>
              <span className={`text-[10px] ${inputData.status === 'processed' ? 'text-green-400/50' : 'text-amber-400/50'}`}>
                {inputData.status}
              </span>
            </div>

            {inputData.source_metadata?.title ? (
              <h2 className="text-[14px] text-white/85 font-medium leading-snug">
                {String(inputData.source_metadata.title)}
              </h2>
            ) : null}
            {inputData.source_metadata?.author ? (
              <p className="text-[12px] text-neutral-500">{String(inputData.source_metadata.author)}</p>
            ) : null}
            {inputData.source_url && (
              <a href={inputData.source_url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-blue-400/60 hover:text-blue-400 break-all">
                {inputData.source_url}
              </a>
            )}
          </div>

          {/* Raw content */}
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2.5">
            <p className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap">
              {inputData.raw_content}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-[11px] text-neutral-500 hover:text-white/70">edit</button>
            <button onClick={() => setDeleting(true)} className="text-[11px] text-neutral-500 hover:text-red-400/70">delete</button>
          </div>

          {/* Extracted nodes */}
          {inputNodes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] text-neutral-500 uppercase tracking-widest">Extracted Nodes</h3>
              {inputNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onNavigate('node', node.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors"
                >
                  <p className="text-[12px] text-white/70 leading-snug">{node.content}</p>
                  <span className={`text-[10px] mt-1 inline-block ${typeColors[node.type] || 'text-neutral-600'}`}>
                    {node.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          <EditModal isOpen={editing} onClose={() => setEditing(false)} onSave={handleSaveInput} title="Edit source" initialValue={inputData.raw_content} />
          <ConfirmDialog isOpen={deleting} onClose={() => setDeleting(false)} onConfirm={handleDeleteInput} title="Delete source" message="This will permanently delete this source and all extracted nodes." />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[12px] text-neutral-600">not found</span>
        </div>
      )}
    </div>
  )
}
