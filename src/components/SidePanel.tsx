'use client'

import { useState, useEffect, useCallback } from 'react'
import { cleanContent } from '@/lib/clean-content'
import { useSelection } from './SelectionContext'
import { getCredibility } from '@/lib/evidence-rank'
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
  self: 'text-violet-300/80',
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
  blog: { label: 'Blog', color: 'text-amber-400' },
  podcast: { label: 'Podcast', color: 'text-violet-400' },
  book: { label: 'Book', color: 'text-emerald-400' },
  twitter: { label: 'X / Twitter', color: 'text-sky-400' },
  tiktok: { label: 'TikTok', color: 'text-rose-400' },
  newsletter: { label: 'Newsletter', color: 'text-indigo-400' },
  wikipedia: { label: 'Wikipedia', color: 'text-neutral-300' },
  government: { label: 'Government', color: 'text-teal-400' },
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
  const { store, updateNode, removeNode, updateInput, removeInput, goBack } = useSelection()
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

  // Favorites — user-created folders only. AI-generated theme folders are excluded so they
  // don't mix in with the user's hand-curated favorites.
  interface FolderRow { id: string; name: string; created_by?: string }
  const [allFolders, setAllFolders] = useState<FolderRow[]>([])
  const [memberFolderIds, setMemberFolderIds] = useState<Set<string>>(new Set())
  const [savePickerOpen, setSavePickerOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const fetchFoldersAndMembership = useCallback(async () => {
    if (type !== 'node') return
    const [foldersRes, memRes] = await Promise.all([
      fetch('/api/folders?favorites=1'),
      fetch(`/api/node-folders?node_id=${id}`),
    ])
    if (foldersRes.ok) {
      const data = await foldersRes.json()
      setAllFolders(data.folders || [])
    }
    if (memRes.ok) {
      const data = await memRes.json()
      setMemberFolderIds(new Set<string>(data.folder_ids || []))
    }
  }, [type, id])

  useEffect(() => { fetchFoldersAndMembership() }, [fetchFoldersAndMembership])

  const isFavorited = memberFolderIds.size > 0

  async function toggleFolderMembership(folderId: string) {
    const isMember = memberFolderIds.has(folderId)
    // Optimistic update
    setMemberFolderIds(prev => {
      const next = new Set(prev)
      if (isMember) next.delete(folderId); else next.add(folderId)
      return next
    })
    if (isMember) {
      await fetch(`/api/folders/${folderId}/nodes?node_id=${id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/folders/${folderId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: id }),
      })
    }
  }

  async function createAndSaveToFolder() {
    const name = newFolderName.trim()
    if (!name) return
    setNewFolderName('')
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return
    const data = await res.json()
    const newFolder = data.folder || data
    if (newFolder?.id) {
      setAllFolders(prev => [{ id: newFolder.id, name: newFolder.name || name }, ...prev])
      setMemberFolderIds(prev => new Set(prev).add(newFolder.id))
      await fetch(`/api/folders/${newFolder.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: id }),
      })
    }
  }

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
    <div className={`${fullWidth ? 'flex-1' : 'w-96 shrink-0'} border-l border-white/[0.06] bg-[#080808] overflow-y-auto flex flex-col h-full overflow-x-hidden`} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="text-neutral-600 hover:text-white/70 text-[11px]">←</button>
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
            {type === 'node' ? 'Node' : 'Source'}
          </span>
        </div>
        <button onClick={onClose} className="text-neutral-600 hover:text-white/70 text-[11px]">✕</button>
      </div>

      {type === 'node' && nodeData ? (
        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] uppercase tracking-widest ${typeColors[nodeData.type] || 'text-neutral-600'}`}>
                {nodeData.type}
              </span>
              <span className="text-neutral-800">·</span>
              <span className="text-[10px] text-neutral-700">
                {new Date(nodeData.created_at).toLocaleDateString()}
              </span>
              {(() => {
                const input = nodeData.input_id ? store.inputs.get(nodeData.input_id) : null
                if (!input) return null
                const cred = getCredibility(input.source_type)
                const tierColors: Record<string, string> = {
                  'peer-reviewed': 'text-green-400/70 bg-green-400/10 border-green-400/20',
                  'institutional': 'text-teal-400/70 bg-teal-400/10 border-teal-400/20',
                  'editorial': 'text-blue-400/60 bg-blue-400/10 border-blue-400/15',
                  'personal': 'text-white/40 bg-white/[0.04] border-white/[0.06]',
                  'media': 'text-amber-400/60 bg-amber-400/10 border-amber-400/15',
                  'community': 'text-orange-400/60 bg-orange-400/10 border-orange-400/15',
                  'social': 'text-pink-400/60 bg-pink-400/10 border-pink-400/15',
                  'unknown': 'text-neutral-400/60 bg-neutral-400/10 border-neutral-400/15',
                }
                return (
                  <>
                    <span className="text-neutral-800">·</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${tierColors[cred.tier] || tierColors.personal}`}>
                      {cred.tier}
                    </span>
                  </>
                )
              })()}
              {/* Favorite star inline with the type label — primary positive action stays prominent. */}
              <div className="ml-auto relative">
                <button
                  onClick={() => setSavePickerOpen(o => !o)}
                  title="Save to a favorites folder"
                  className={`flex items-center gap-1 text-[10px] ${isFavorited ? 'text-amber-400' : 'text-neutral-500 hover:text-white/70'}`}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                    <path d="M6 1l1.5 3.2 3.5.5-2.5 2.4.6 3.4L6 9 2.9 10.5l.6-3.4L1 4.7l3.5-.5L6 1z" strokeLinejoin="round" />
                  </svg>
                  {isFavorited ? `saved · ${memberFolderIds.size}` : 'save'}
                </button>
                {savePickerOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-[#0f0f0f] border border-white/[0.08] rounded-lg shadow-xl z-30 max-h-64 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-white/[0.04] text-[10px] uppercase tracking-wider text-neutral-500">Favorites</div>
                    {allFolders.length > 0 ? (
                      <div>
                        {allFolders.map(f => {
                          const checked = memberFolderIds.has(f.id)
                          return (
                            <button
                              key={f.id}
                              onClick={() => toggleFolderMembership(f.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.04]"
                            >
                              <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${checked ? 'bg-amber-400/80 border-amber-400' : 'border-white/20'}`}>
                                {checked && <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="black" strokeWidth="1.6"><path d="M1 4l2 2 4-4" /></svg>}
                              </span>
                              <span className="text-[12px] text-white/70 truncate">{f.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="px-3 py-2 text-[11px] text-neutral-600 italic">no favorites yet</p>
                    )}
                    <div className="border-t border-white/[0.04] px-2 py-1.5 flex gap-1">
                      <input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createAndSaveToFolder() } }}
                        placeholder="+ new favorites folder"
                        className="flex-1 bg-transparent text-[11px] text-white/70 placeholder-neutral-600 px-1 py-0.5 outline-none"
                      />
                      {newFolderName.trim() && (
                        <button onClick={createAndSaveToFolder} className="text-[11px] text-amber-400 px-1">save</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <MarkdownContent content={nodeData.content} />
          </div>

          {/* Perspective tags */}
          {nodeData.perspectives && nodeData.perspectives.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {nodeData.perspectives.map((p: string) => (
                <span key={p} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-400">
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Source showcase — featured card for evidence/article/source nodes.
              Pulls every useful field off the linked input so an evidence node tells you
              what study/article it came from at a glance. */}
          {(() => {
            const input = nodeData.input_id ? store.inputs.get(nodeData.input_id) : null
            const effectiveUrl = nodeData.source_url || (input?.source_metadata?.url as string | undefined) || null
            if (!effectiveUrl && !input) return null
            const hostname = effectiveUrl
              ? (() => { try { return new URL(effectiveUrl).hostname } catch { return effectiveUrl } })()
              : null
            const sourceType = input?.source_type || 'source'
            const meta = input?.source_metadata || {}
            const sourceTitle = (meta.title as string | undefined) || null
            const sourceAuthor = (meta.author as string | undefined) || (meta.byline as string | undefined) || null
            const sourceDescription = (meta.description as string | undefined) || (meta.excerpt as string | undefined) || null
            const sourceImage = (meta.image as string | undefined) || (meta.thumbnail as string | undefined) || null
            const publishedDate = (meta.published_at as string | undefined) || (meta.date as string | undefined) || null
            const rawSnippet = !sourceDescription && input?.raw_content
              ? input.raw_content.slice(0, 240) + (input.raw_content.length > 240 ? '…' : '')
              : null
            const cred = input ? getCredibility(input.source_type) : null
            return (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                {sourceImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sourceImage} alt="" className="w-full h-32 object-cover border-b border-white/[0.04]" />
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] uppercase tracking-widest text-neutral-500">Source</span>
                    <span className="text-neutral-800">·</span>
                    <span className={`text-[10px] ${SOURCE_CONFIG[sourceType]?.color || 'text-white/50'}`}>
                      {SOURCE_CONFIG[sourceType]?.label || sourceType}
                    </span>
                    {cred && (
                      <>
                        <span className="text-neutral-800">·</span>
                        <span className="text-[9px] text-neutral-500">{cred.tier}</span>
                      </>
                    )}
                  </div>
                  {sourceTitle && (
                    <p className="text-[13px] font-medium text-white/85 leading-snug">{sourceTitle}</p>
                  )}
                  {(sourceAuthor || publishedDate) && (
                    <p className="text-[10px] text-neutral-500">
                      {sourceAuthor}
                      {sourceAuthor && publishedDate ? ' · ' : ''}
                      {publishedDate ? new Date(publishedDate).toLocaleDateString() : ''}
                    </p>
                  )}
                  {sourceDescription && (
                    <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-3">{sourceDescription}</p>
                  )}
                  {rawSnippet && (
                    <p className="text-[11px] text-neutral-500 leading-relaxed line-clamp-3 italic">{rawSnippet}</p>
                  )}
                  <div className="flex flex-col gap-1.5 pt-1">
                    {effectiveUrl && (
                      <a
                        href={effectiveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-blue-400/80 hover:text-blue-400 truncate"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" className="shrink-0">
                          <path d="M6 1h3v3M9 1L5 5M4 1H1v8h8V6" />
                        </svg>
                        {hostname}
                      </a>
                    )}
                    {nodeData.input_id && (
                      <button
                        onClick={() => onNavigate('input', nodeData.input_id!)}
                        className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-white/70"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" className="shrink-0">
                          <rect x="1" y="1" width="8" height="8" rx="1" />
                          <path d="M3 3.5h4M3 5.5h3" />
                        </svg>
                        open full source
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

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

          {/* Bottom actions — edit / connect / delete in their own row at the bottom of the panel. */}
          <div className="pt-3 mt-2 border-t border-white/[0.04] flex items-center gap-3">
            <button onClick={() => setEditing(true)} className="text-[11px] text-neutral-500 hover:text-white/70">edit</button>
            <button onClick={() => setConnecting(true)} className="text-[11px] text-neutral-500 hover:text-white/70">connect</button>
            <button onClick={() => setDeleting(true)} className="text-[11px] text-neutral-500 hover:text-red-400/70 ml-auto">delete</button>
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
            <MarkdownContent content={cleanContent(inputData.raw_content)} />
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
