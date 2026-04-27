'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ActionMenu from './ActionMenu'
import EditModal from './EditModal'
import ConfirmDialog from './ConfirmDialog'

const typeColors: Record<string, string> = {
  concept: 'text-pink-400/60',
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

interface FolderDetailProps {
  folder: { id: string; name: string; description: string | null; confidence: number; created_by: string }
  nodes: Array<{ id: string; content: string; type: string; created_at: string }>
}

export default function FolderDetail({ folder, nodes }: FolderDetailProps) {
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removingNode, setRemovingNode] = useState<string | null>(null)

  async function handleRename(name: string) {
    await fetch(`/api/folders/${folder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    router.refresh()
  }

  async function handleEditDesc(description: string) {
    await fetch(`/api/folders/${folder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    })
    router.refresh()
  }

  async function handleDelete() {
    await fetch(`/api/folders/${folder.id}`, { method: 'DELETE' })
    router.push('/home')
  }

  async function handleRemoveNode(nodeId: string) {
    await fetch(`/api/folders/${folder.id}/nodes?node_id=${nodeId}`, { method: 'DELETE' })
    setRemovingNode(null)
    router.refresh()
  }

  return (
    <>
      <div className="animate-fade-up space-y-3 group">
        <div className="flex items-start justify-between">
          <span className="text-[11px] uppercase tracking-widest text-purple-400/50">
            {folder.created_by === 'ai' ? 'emerging theme' : 'collection'}
          </span>
          <ActionMenu actions={[
            { label: 'Rename', onClick: () => setEditingName(true) },
            { label: 'Edit description', onClick: () => setEditingDesc(true) },
            { label: 'Delete', onClick: () => setDeleting(true), danger: true },
          ]} />
        </div>
        <h1 className="text-[22px] font-light text-white/90">{folder.name}</h1>
        {folder.description && (
          <p className="text-neutral-500 text-[14px] leading-relaxed">{folder.description}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-neutral-700">
          <span>{nodes.length} fragments</span>
          <span>·</span>
          <span>{Math.round(folder.confidence * 100)}% confidence</span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1 mb-3">
          Cluster
        </h2>
        <div className="space-y-1.5 stagger-children">
          {nodes.map((node) => (
            <div key={node.id} className="group/node relative">
              <Link
                href={`/nodes/${node.id}`}
                className="node-card block bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 pr-10"
              >
                <p className="text-white/80 text-[14px] leading-relaxed">{node.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[11px] ${typeColors[node.type] || 'text-neutral-600'}`}>
                    {node.type}
                  </span>
                  <span className="text-neutral-800">·</span>
                  <span className="text-[11px] text-neutral-700">
                    {new Date(node.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setRemovingNode(node.id)}
                className="absolute top-3 right-3 p-1 rounded text-neutral-700 hover:text-red-400 opacity-0 group-hover/node:opacity-100 transition-all"
                title="Remove from theme"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            </div>
          ))}
          {nodes.length === 0 && (
            <p className="text-neutral-700 text-sm">this theme is still forming</p>
          )}
        </div>
      </div>

      <EditModal
        isOpen={editingName}
        onClose={() => setEditingName(false)}
        onSave={handleRename}
        title="Rename theme"
        initialValue={folder.name}
      />

      <EditModal
        isOpen={editingDesc}
        onClose={() => setEditingDesc(false)}
        onSave={handleEditDesc}
        title="Edit description"
        initialValue={folder.description || ''}
        placeholder="Describe this emerging theme..."
      />

      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={handleDelete}
        title="Delete theme"
        message="This will remove this theme and unlink all its nodes. The nodes themselves will not be deleted."
      />

      <ConfirmDialog
        isOpen={!!removingNode}
        onClose={() => setRemovingNode(null)}
        onConfirm={() => removingNode && handleRemoveNode(removingNode)}
        title="Remove from theme"
        message="This node will be unlinked from this theme but not deleted."
      />
    </>
  )
}
