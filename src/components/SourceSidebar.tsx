'use client'

import { useState } from 'react'
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
}: {
  inputs: Input[]
  folders: Folder[]
  folderNodes: FolderNode[]
  nodes: Node[]
}) {
  const router = useRouter()
  const { select } = useSelection()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sources: true })
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const folderNodeMap = new Map<string, string[]>()
  for (const fn of folderNodes) {
    if (!folderNodeMap.has(fn.folder_id)) folderNodeMap.set(fn.folder_id, [])
    folderNodeMap.get(fn.folder_id)!.push(fn.node_id)
  }
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

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

  function getTitle(input: Input) {
    return (input.source_metadata?.title as string) ||
      input.raw_content.slice(0, 40) + (input.raw_content.length > 40 ? '…' : '')
  }

  return (
    <aside className="overflow-y-auto text-[12px]" style={{ minHeight: 'calc(100vh - 49px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-8 border-b border-white/[0.06]">
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">Explorer</span>
        <button
          onClick={() => setShowNewFolder(true)}
          className="text-neutral-500 hover:text-white/80"
          title="New folder"
        >+</button>
      </div>

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

      {/* Folders */}
      {folders.map((folder) => {
        const open = expanded[folder.id]
        const childIds = folderNodeMap.get(folder.id) || []
        const children = childIds.map((id) => nodeMap.get(id)).filter(Boolean) as Node[]

        return (
          <div key={folder.id}>
            <Row indent={0} open={open} onClick={() => toggle(folder.id)} icon="folder" label={folder.name} count={children.length} />
            {open && children.map((n) => (
              <div key={n.id} onClick={() => select('node', n.id)} className="cursor-pointer">
                <Row indent={1} label={n.content.slice(0, 36) + (n.content.length > 36 ? '…' : '')} icon="node" nodeType={n.type} />
              </div>
            ))}
            {open && children.length === 0 && (
              <div className="h-[22px] pl-10 flex items-center text-[11px] text-neutral-700 italic">empty</div>
            )}
          </div>
        )
      })}

      {folders.length > 0 && <div className="h-px bg-white/[0.04] mx-2 my-1" />}

      {/* Sources */}
      <Row indent={0} open={expanded.sources} onClick={() => toggle('sources')} icon="section" label="Sources" count={inputs.length} />
      {expanded.sources && inputs.map((input) => (
        <div key={input.id} onClick={() => select('input', input.id)} className="cursor-pointer">
          <Row indent={1} label={getTitle(input)} icon="source" sourceType={input.source_type || 'journal'} />
        </div>
      ))}
      {expanded.sources && inputs.length === 0 && (
        <div className="h-[22px] pl-8 flex items-center text-[11px] text-neutral-700 italic">no sources yet</div>
      )}
    </aside>
  )
}

// Chevron SVG — tiny, no transitions needed at this scale
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
      {/* Chevron for expandable rows */}
      {open !== undefined ? <Chevron open={open} /> : <span className="w-2 shrink-0" />}

      {/* Icon */}
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

      {/* Label */}
      <span className="truncate flex-1 text-white/60 hover:text-white/80 text-[12px] leading-none">{label}</span>

      {/* Count badge */}
      {count !== undefined && <span className="text-[10px] text-neutral-600 leading-none">{count}</span>}
    </Tag>
  )
}
