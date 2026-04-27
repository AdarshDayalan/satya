'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSelection } from './SelectionContext'
import MarkdownContent from './MarkdownContent'
import EditModal from './EditModal'
import ConfirmDialog from './ConfirmDialog'
import CreateEdgeModal from './CreateEdgeModal'
import AttachmentCard from './AttachmentCard'
import AddAttachment from './AddAttachment'

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
  fullWidth?: boolean
}

export default function SidePanel({ type, id, onClose, onNavigate, allNodes, fullWidth }: SidePanelProps) {
  const { store, updateNode, removeNode, updateInput, removeInput } = useSelection()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Read directly from store — instant, no fetch
  const nodeData = type === 'node' ? store.nodes.get(id) ?? null : null
  const connections = type === 'node' ? store.nodeEdges(id) : []
  const inputData = type === 'input' ? store.inputs.get(id) ?? null : null
  const inputNodesList = type === 'input' ? store.inputNodes(id) : []

  // Attachments (fetched lazily for nodes)
  interface Attachment {
    id: string; kind: 'link' | 'image' | 'video' | 'file'; url: string
    title: string | null; description: string | null; thumbnail_url: string | null
  }
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const fetchAttachments = useCallback(async () => {
    if (type !== 'node') return
    const res = await fetch(`/api/attachments?node_id=${id}`)
    if (res.ok) {
      const data = await res.json()
      setAttachments(data.attachments || [])
    }
  }, [type, id])

  useEffect(() => { fetchAttachments() }, [fetchAttachments])

  async function handleDeleteAttachment(attachmentId: string) {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId))
    await fetch('/api/attachments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: attachmentId }),
    })
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSaveNode(content: string) {
    // Optimistic update
    updateNode(id, { content })
    setEditing(false)
    // Sync to server in background
    await fetch(`/api/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  }

  async function handleDeleteNode() {
    removeNode(id)
    onClose()
    await fetch(`/api/nodes/${id}`, { method: 'DELETE' })
  }

  async function handleSaveInput(content: string) {
    updateInput(id, { raw_content: content })
    setEditing(false)
    await fetch(`/api/inputs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_content: content }),
    })
  }

  async function handleDeleteInput() {
    removeInput(id)
    onClose()
    await fetch(`/api/inputs/${id}`, { method: 'DELETE' })
  }

  return (
    <div className={`${fullWidth ? 'flex-1' : 'w-96 shrink-0'} border-l border-white/[0.06] bg-[#080808] overflow-y-auto flex flex-col h-full`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-white/[0.06] shrink-0">
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
          {type === 'node' ? 'Node' : 'Source'}
        </span>
        <button onClick={onClose} className="text-neutral-600 hover:text-white/70 text-[11px]">✕</button>
      </div>

      {type === 'node' && nodeData ? (
        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
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
            <MarkdownContent content={nodeData.content} />
          </div>

          {/* Source attribution */}
          {(nodeData.source_url || nodeData.input_id) && (
            <div className="space-y-1.5">
              {nodeData.source_url && (
                <a
                  href={nodeData.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-blue-400/60 hover:text-blue-400 truncate"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" className="shrink-0">
                    <path d="M6 1h3v3M9 1L5 5M4 1H1v8h8V6" />
                  </svg>
                  {(() => { try { return new URL(nodeData.source_url).hostname } catch { return nodeData.source_url } })()}
                </a>
              )}
              {nodeData.input_id && (
                <button
                  onClick={() => onNavigate('input', nodeData.input_id!)}
                  className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-white/60"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" className="shrink-0">
                    <rect x="1" y="1" width="8" height="8" rx="1" />
                    <path d="M3 3.5h4M3 5.5h3" />
                  </svg>
                  {nodeData.source_url ? 'from journal entry' : 'view source'}
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-[11px] text-neutral-500 hover:text-white/70">edit</button>
            <button onClick={() => setConnecting(true)} className="text-[11px] text-neutral-500 hover:text-white/70">connect</button>
            <button onClick={() => setDeleting(true)} className="text-[11px] text-neutral-500 hover:text-red-400/70">delete</button>
          </div>

          {connections.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] text-neutral-500 uppercase tracking-widest">Connections</h3>
              {connections.map((c, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate('node', c.node.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05]"
                >
                  <p className="text-[12px] text-white/70 leading-snug">{c.node.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] ${relColors[c.relationship] || 'text-neutral-600'}`}>
                      {c.relationship.replace('_', ' ')}
                    </span>
                    {c.reason ? (
                      <>
                        <span className="text-neutral-800">·</span>
                        <span className="text-[10px] text-neutral-700 truncate">{c.reason}</span>
                      </>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}

          {connections.length === 0 && (
            <p className="text-[11px] text-neutral-700 italic">no connections yet</p>
          )}

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] text-neutral-500 uppercase tracking-widest">Attachments</h3>
              <AddAttachment nodeId={id} onAdded={fetchAttachments} />
            </div>
            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((a) => (
                  <AttachmentCard key={a.id} attachment={a} onDelete={handleDeleteAttachment} />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-neutral-700 italic">no attachments</p>
            )}
          </div>

          <EditModal isOpen={editing} onClose={() => setEditing(false)} onSave={handleSaveNode} title="Edit node" initialValue={nodeData.content} />
          <ConfirmDialog isOpen={deleting} onClose={() => setDeleting(false)} onConfirm={handleDeleteNode} title="Delete node" message="This will remove this node and all its connections." />
          <CreateEdgeModal open={connecting} onClose={() => setConnecting(false)} onCreated={() => {}} nodes={allNodes} fromNodeId={nodeData.id} />
        </div>
      ) : type === 'input' && inputData ? (
        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-widest font-medium ${SOURCE_CONFIG[inputData.source_type]?.color || 'text-white/50'}`}>
                {SOURCE_CONFIG[inputData.source_type]?.label || inputData.source_type}
              </span>
              <span className="text-neutral-800">·</span>
              <span className="text-[10px] text-neutral-700">
                {new Date(inputData.created_at).toLocaleDateString()}
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

          <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2.5">
            <MarkdownContent content={inputData.raw_content} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-[11px] text-neutral-500 hover:text-white/70">edit</button>
            <button onClick={() => setDeleting(true)} className="text-[11px] text-neutral-500 hover:text-red-400/70">delete</button>
          </div>

          {inputNodesList.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] text-neutral-500 uppercase tracking-widest">Extracted Nodes</h3>
              {inputNodesList.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onNavigate('node', node.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05]"
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
