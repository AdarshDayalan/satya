'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSelection } from './SelectionContext'

interface Input {
  id: string
  raw_content: string
  source_type: string
  source_metadata: Record<string, unknown>
  status: string
  created_at: string
}

interface Folder {
  id: string
  name: string
  description: string | null
  created_by?: string
}

interface FolderNode {
  folder_id: string
  node_id: string
}

interface Node {
  id: string
  content: string
  type: string
  input_id: string | null
}

export default function SourceSidebar({
  inputs,
  folders,
  folderNodes,
  nodes,
  edges = [],
}: {
  inputs: Input[]
  folders: Folder[]
  folderNodes: FolderNode[]
  nodes: Node[]
  edges?: Array<{ from_node_id: string; to_node_id: string }>
}) {
  const router = useRouter()
  const { select } = useSelection()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sources: true })
  const [pruning, setPruning] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Edit/delete state
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null)

  // Multi-select
  const [multiSelect, setMultiSelect] = useState(false)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [selectedInputs, setSelectedInputs] = useState<Set<string>>(new Set())
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const folderNodeMap = new Map<string, string[]>()
  for (const fn of folderNodes) {
    if (!folderNodeMap.has(fn.folder_id)) folderNodeMap.set(fn.folder_id, [])
    folderNodeMap.get(fn.folder_id)!.push(fn.node_id)
  }
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Orphans — nodes with zero edges in either direction. Surfaced for cleanup.
  const orphans = (() => {
    const connected = new Set<string>()
    for (const e of edges) { connected.add(e.from_node_id); connected.add(e.to_node_id) }
    return nodes.filter(n => !connected.has(n.id))
  })()

  async function pruneOrphans() {
    if (orphans.length === 0) return
    const ok = window.confirm(`Delete ${orphans.length} disconnected node${orphans.length === 1 ? '' : 's'}?`)
    if (!ok) return
    setPruning(true)
    await Promise.all(orphans.map(o => fetch(`/api/nodes/${o.id}`, { method: 'DELETE' })))
    setPruning(false)
    router.refresh()
  }

  async function deleteOrphan(id: string) {
    await fetch(`/api/nodes/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  function toggle(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }))
  }

  async function createFolder() {
    if (!newFolderName.trim()) return
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim() }),
    })
    setNewFolderName('')
    setShowNewFolder(false)
    router.refresh()
  }

  async function renameFolder(folderId: string) {
    if (!editName.trim()) { setEditingFolder(null); return }
    await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    })
    setEditingFolder(null)
    router.refresh()
  }

  async function deleteFolder(folderId: string) {
    await fetch(`/api/folders/${folderId}`, { method: 'DELETE' })
    router.refresh()
  }

  function startEdit(folder: Folder) {
    setEditingFolder(folder.id)
    setEditName(folder.name)
    setContextMenu(null)
  }

  function handleContextMenu(e: React.MouseEvent, folderId: string) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, folderId })
  }

  // Multi-select helpers
  function toggleSelectNode(nodeId: string) {
    setSelectedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  function toggleSelectInput(inputId: string) {
    setSelectedInputs(prev => {
      const next = new Set(prev)
      if (next.has(inputId)) next.delete(inputId)
      else next.add(inputId)
      return next
    })
  }

  function clearSelection() {
    setSelectedNodes(new Set())
    setSelectedInputs(new Set())
    setMultiSelect(false)
    setShowMoveMenu(false)
  }

  async function moveSelectedToFolder(folderId: string) {
    if (selectedNodes.size === 0) return
    await fetch(`/api/folders/${folderId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_ids: [...selectedNodes] }),
    })
    clearSelection()
    router.refresh()
  }

  async function deleteSelectedNodes() {
    const promises = [...selectedNodes].map(id =>
      fetch(`/api/nodes/${id}`, { method: 'DELETE' })
    )
    const inputPromises = [...selectedInputs].map(id =>
      fetch(`/api/inputs/${id}`, { method: 'DELETE' })
    )
    await Promise.all([...promises, ...inputPromises])
    clearSelection()
    router.refresh()
  }

  const totalSelected = selectedNodes.size + selectedInputs.size

  function getTitle(input: Input) {
    return (input.source_metadata?.title as string) ||
      input.raw_content.slice(0, 40) + (input.raw_content.length > 40 ? '…' : '')
  }

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    function close() { setContextMenu(null) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  return (
    <aside className="overflow-y-auto text-[12px] relative" style={{ minHeight: 'calc(100vh - 49px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-8 border-b border-white/[0.06]">
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">Explorer</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setMultiSelect(!multiSelect); if (multiSelect) clearSelection() }}
            className={`text-[10px] px-1.5 py-0.5 rounded ${multiSelect ? 'text-purple-400 bg-purple-400/10' : 'text-neutral-600 hover:text-white/60'}`}
            title="Multi-select"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1" y="1" width="4" height="4" rx="0.5" />
              <rect x="7" y="1" width="4" height="4" rx="0.5" />
              <rect x="1" y="7" width="4" height="4" rx="0.5" />
              <rect x="7" y="7" width="4" height="4" rx="0.5" />
            </svg>
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className="text-neutral-500 hover:text-white/80"
            title="New folder"
          >+</button>
        </div>
      </div>

      {/* Multi-select action bar */}
      {multiSelect && totalSelected > 0 && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-purple-400/[0.06] border-b border-purple-400/10">
          <span className="text-[10px] text-purple-300/70 flex-1">{totalSelected} selected</span>
          <div className="relative">
            <button
              onClick={() => setShowMoveMenu(!showMoveMenu)}
              className="px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-white/70 rounded bg-white/[0.04]"
              title="Move to folder"
            >
              move
            </button>
            {showMoveMenu && (
              <div className="absolute top-full right-0 mt-1 w-36 bg-[#111] border border-white/[0.08] rounded-lg py-1 z-30 shadow-xl">
                {folders.map(f => (
                  <button key={f.id} onClick={() => moveSelectedToFolder(f.id)}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/[0.06] truncate">
                    {f.name}
                  </button>
                ))}
                {folders.length === 0 && (
                  <p className="px-3 py-1.5 text-[10px] text-neutral-600 italic">no folders</p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={deleteSelectedNodes}
            className="px-1.5 py-0.5 text-[10px] text-red-400/60 hover:text-red-400 rounded bg-white/[0.04]"
          >
            delete
          </button>
          <button
            onClick={clearSelection}
            className="px-1.5 py-0.5 text-[10px] text-neutral-600 hover:text-neutral-400"
          >
            ✕
          </button>
        </div>
      )}

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex items-center h-[22px] pl-5 pr-2">
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createFolder()
              if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') }
            }}
            onBlur={() => { if (!newFolderName.trim()) setShowNewFolder(false) }}
            placeholder="folder name"
            className="w-full bg-white/[0.06] border border-blue-400/40 rounded-sm px-1 py-0 text-[11px] text-white/90 placeholder-neutral-600 focus:outline-none"
          />
        </div>
      )}

      {/* Folders — split into user-curated 'Favorites' (created_by='user' or unspecified)
          and AI-generated 'Themes'. Same render block runs twice with a different filter. */}
      {(['user', 'ai'] as const).flatMap((kind) => {
        const groupFolders = folders.filter(f => kind === 'user'
          ? (f.created_by === 'user' || !f.created_by)
          : f.created_by === 'ai')
        if (groupFolders.length === 0) return []
        const sectionLabel = kind === 'user' ? 'Favorites' : 'Themes'
        return [
          <Row key={`section-${kind}`} indent={0} icon="section" label={sectionLabel} count={groupFolders.length} />,
          ...groupFolders.map((folder) => {
        const open = expanded[folder.id]
        const childIds = folderNodeMap.get(folder.id) || []
        const children = childIds.map((id) => nodeMap.get(id)).filter(Boolean) as Node[]
        const isEditing = editingFolder === folder.id

        return (
          <div key={folder.id}>
            {isEditing ? (
              <div className="flex items-center h-[22px] pl-2 pr-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameFolder(folder.id)
                    if (e.key === 'Escape') setEditingFolder(null)
                  }}
                  onBlur={() => renameFolder(folder.id)}
                  className="w-full bg-white/[0.06] border border-purple-400/40 rounded-sm px-1 py-0 text-[11px] text-white/90 focus:outline-none"
                />
              </div>
            ) : (
              <div onContextMenu={(e) => handleContextMenu(e, folder.id)} className="group relative">
                <Row indent={0} open={open} onClick={() => toggle(folder.id)} icon="folder" label={folder.name} count={children.length} />
                <div className="absolute right-1 top-0 h-[22px] flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(folder) }}
                    className="w-4 h-4 flex items-center justify-center text-neutral-600 hover:text-white/70 rounded hover:bg-white/[0.08]"
                    title="Rename">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <path d="M1 7h6M1 7l1.5-5L6 5.5 4.5 7H1z" />
                    </svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id) }}
                    className="w-4 h-4 flex items-center justify-center text-neutral-600 hover:text-red-400/70 rounded hover:bg-white/[0.08]"
                    title="Delete folder">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <path d="M1 1l6 6M7 1l-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            {open && children.map((n) => (
              <div key={n.id} className="flex items-center">
                {multiSelect && (
                  <button onClick={() => toggleSelectNode(n.id)} className="pl-5 pr-0.5 shrink-0">
                    <span className={`inline-block w-3 h-3 rounded-sm border ${selectedNodes.has(n.id) ? 'bg-purple-400/80 border-purple-400' : 'border-neutral-700 bg-transparent'}`} />
                  </button>
                )}
                <div onClick={() => multiSelect ? toggleSelectNode(n.id) : select('node', n.id)} className="cursor-pointer flex-1 min-w-0">
                  <Row indent={multiSelect ? 0 : 1} label={n.content.slice(0, 36) + (n.content.length > 36 ? '…' : '')} icon="node" nodeType={n.type} />
                </div>
              </div>
            ))}
            {open && children.length === 0 && (
              <div className="h-[22px] pl-10 flex items-center text-[11px] text-neutral-700 italic">empty</div>
            )}
          </div>
        )
          }),
        ]
      })}

      {folders.length > 0 && <div className="h-px bg-white/[0.04] mx-2 my-1" />}

      {/* Sources */}
      <Row indent={0} open={expanded.sources} onClick={() => toggle('sources')} icon="section" label="Sources" count={inputs.length} />
      {expanded.sources && inputs.map((input) => (
        <div key={input.id} className="flex items-center">
          {multiSelect && (
            <button onClick={() => toggleSelectInput(input.id)} className="pl-5 pr-0.5 shrink-0">
              <span className={`inline-block w-3 h-3 rounded-sm border ${selectedInputs.has(input.id) ? 'bg-purple-400/80 border-purple-400' : 'border-neutral-700 bg-transparent'}`} />
            </button>
          )}
          <div onClick={() => multiSelect ? toggleSelectInput(input.id) : select('input', input.id)} className="cursor-pointer flex-1 min-w-0">
            <Row indent={multiSelect ? 0 : 1} label={getTitle(input)} icon="source" sourceType={input.source_type || 'journal'} />
          </div>
        </div>
      ))}
      {expanded.sources && inputs.length === 0 && (
        <div className="h-[22px] pl-8 flex items-center text-[11px] text-neutral-700 italic">no sources yet</div>
      )}

      {/* Cleanup — disconnected nodes (orphans) */}
      {orphans.length > 0 && (
        <div className="mt-4 border-t border-white/[0.04] pt-2">
          <button
            onClick={() => toggle('cleanup')}
            className="w-full flex items-center justify-between px-3 h-[22px] text-[10px] text-neutral-600 hover:text-neutral-400 uppercase tracking-wider"
          >
            <span className="flex items-center gap-1.5">
              <Chevron open={!!expanded.cleanup} />
              cleanup
              <span className="text-neutral-700 normal-case lowercase tracking-normal">· {orphans.length} disconnected</span>
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); pruneOrphans() }}
              disabled={pruning}
              className="text-[10px] text-red-400/50 hover:text-red-400 normal-case lowercase tracking-normal disabled:opacity-50"
              title="Delete all disconnected nodes"
            >
              {pruning ? 'pruning…' : 'prune all'}
            </button>
          </button>
          {expanded.cleanup && (
            <div className="space-y-px">
              {orphans.slice(0, 50).map(n => (
                <div key={n.id} className="group flex items-center h-[22px] pl-5 pr-2 hover:bg-white/[0.03]">
                  <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0 mr-1.5">
                    <circle cx="4" cy="4" r="2.5" fill={NODE_DOT[n.type] || '#525252'} />
                  </svg>
                  <span className="truncate flex-1 text-[11px] text-white/40">{n.content.slice(0, 80)}</span>
                  <button
                    onClick={() => deleteOrphan(n.id)}
                    className="ml-1 text-[10px] text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {orphans.length > 50 && (
                <p className="px-5 py-1 text-[10px] text-neutral-700 italic">…and {orphans.length - 50} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#111] border border-white/[0.08] rounded-lg py-1 z-50 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={() => { const f = folders.find(f => f.id === contextMenu.folderId); if (f) startEdit(f) }}
            className="w-full text-left px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/[0.06]">
            Rename
          </button>
          <button onClick={() => { deleteFolder(contextMenu.folderId); setContextMenu(null) }}
            className="w-full text-left px-3 py-1.5 text-[11px] text-red-400/60 hover:bg-white/[0.06]">
            Delete
          </button>
        </div>
      )}
    </aside>
  )
}

// Chevron SVG
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`shrink-0 text-neutral-500 ${open ? 'rotate-90' : ''}`}>
      <path d="M2 1l4 3-4 3z" />
    </svg>
  )
}

const SRC_DOT: Record<string, string> = {
  journal: '#888',
  youtube: '#f87171',
  instagram: '#ec4899',
  article: '#60a5fa',
  research_paper: '#34d399',
  reddit: '#fb923c',
  pubmed: '#22d3ee',
  blog: '#fbbf24',
  podcast: '#8b5cf6',
  book: '#10b981',
  twitter: '#38bdf8',
  tiktok: '#fb7185',
  newsletter: '#818cf8',
  wikipedia: '#d4d4d4',
  government: '#2dd4bf',
}

const NODE_DOT: Record<string, string> = {
  concept: '#f472b6',
  idea: '#60a5fa',
  question: '#fbbf24',
  source: '#34d399',
  synthesis: '#a78bfa',
  raw: '#525252',
}

function Row({
  indent,
  open,
  onClick,
  icon,
  label,
  count,
  sourceType,
  nodeType,
}: {
  indent: number
  open?: boolean
  onClick?: () => void
  icon: 'folder' | 'section' | 'source' | 'node'
  label: string
  count?: number
  sourceType?: string
  nodeType?: string
}) {
  const pl = indent === 0 ? 'pl-2' : 'pl-6'
  const isClickable = !!onClick
  const Tag = isClickable ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={`w-full flex items-center gap-[5px] ${pl} pr-2 h-[22px] hover:bg-white/[0.05] cursor-pointer text-left`}
    >
      {open !== undefined ? <Chevron open={open} /> : <span className="w-2 shrink-0" />}

      {icon === 'folder' && (
        <svg width="12" height="12" viewBox="0 0 14 14" fill={open ? '#a78bfa40' : '#52525240'} stroke={open ? '#a78bfa' : '#666'} strokeWidth="1.2" className="shrink-0">
          <path d="M1 4V12H13V4H1Z" /><path d="M1 4L3 2H6L7 4" fill="none" />
        </svg>
      )}
      {icon === 'section' && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#666" strokeWidth="1.2" className="shrink-0">
          <rect x="1" y="1" width="10" height="10" rx="1" />
        </svg>
      )}
      {icon === 'source' && (
        <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0">
          <circle cx="4" cy="4" r="3" fill={SRC_DOT[sourceType || 'journal'] || '#888'} />
        </svg>
      )}
      {icon === 'node' && (
        <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0">
          <circle cx="4" cy="4" r="2.5" fill={NODE_DOT[nodeType || 'raw'] || '#525252'} />
        </svg>
      )}

      <span className="truncate flex-1 text-white/60 hover:text-white/80 text-[12px] leading-none">{label}</span>

      {count !== undefined && <span className="text-[10px] text-neutral-600 leading-none">{count}</span>}
    </Tag>
  )
}
