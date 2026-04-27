'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSelection } from './SelectionContext'

interface Space {
  id: string
  name: string
  slug: string
  description: string
  is_public: boolean
  created_at: string
  space_items: Array<{ count: number }>
}

interface SpaceDetail {
  space: Space
  items: Array<{ id: string; node_id: string | null; input_id: string | null }>
  nodes: Array<{ id: string; content: string; type: string }>
  inputs: Array<{ id: string; raw_content: string; source_type: string; source_metadata: Record<string, unknown> }>
}

const typeColors: Record<string, string> = {
  concept: 'text-pink-400/60',
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  journal: { label: 'journal', color: 'text-white/40' },
  youtube: { label: 'YouTube', color: 'text-red-400/60' },
  article: { label: 'article', color: 'text-blue-400/60' },
  reddit: { label: 'Reddit', color: 'text-orange-400/60' },
  pubmed: { label: 'PubMed', color: 'text-cyan-400/60' },
}

export default function SpacesPanel() {
  const router = useRouter()
  const { store } = useSelection()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [selected, setSelected] = useState<SpaceDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [addMode, setAddMode] = useState<'nodes' | 'sources' | null>(null)

  const fetchSpaces = useCallback(async () => {
    const res = await fetch('/api/spaces')
    if (res.ok) {
      const data = await res.json()
      setSpaces(data.spaces)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchSpaces() }, [fetchSpaces])

  async function fetchSpace(id: string) {
    const res = await fetch(`/api/spaces/${id}`)
    if (res.ok) {
      const data = await res.json()
      setSelected(data)
    }
  }

  async function createSpace() {
    if (!newName.trim()) return
    const res = await fetch('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, description: newDesc }),
    })
    if (res.ok) {
      setNewName('')
      setNewDesc('')
      setCreating(false)
      fetchSpaces()
    }
  }

  async function togglePublic(space: SpaceDetail) {
    await fetch(`/api/spaces/${space.space.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: !space.space.is_public }),
    })
    fetchSpace(space.space.id)
    fetchSpaces()
  }

  async function deleteSpace(id: string) {
    await fetch(`/api/spaces/${id}`, { method: 'DELETE' })
    setSelected(null)
    fetchSpaces()
    router.refresh()
  }

  async function removeItem(spaceId: string, itemId: string) {
    await fetch(`/api/spaces/${spaceId}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId }),
    })
    fetchSpace(spaceId)
  }

  async function addItem(spaceId: string, nodeId?: string, inputId?: string) {
    await fetch(`/api/spaces/${spaceId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: nodeId, input_id: inputId }),
    })
    fetchSpace(spaceId)
  }

  async function addAllNodes(spaceId: string) {
    for (const [nodeId] of store.nodes) {
      await addItem(spaceId, nodeId)
    }
    fetchSpace(spaceId)
  }

  async function addAllSources(spaceId: string) {
    for (const [inputId] of store.inputs) {
      await addItem(spaceId, undefined, inputId)
    }
    fetchSpace(spaceId)
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // List view
  if (!selected) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-10 space-y-6">
        <div>
          <h1 className="text-[18px] text-white/90 font-light">Spaces</h1>
          <p className="text-[13px] text-neutral-500 mt-1">
            Curate and share your knowledge graph. Each space is a collection of ideas and sources you can publish as a link.
          </p>
        </div>

        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 text-[12px] text-purple-400/70 bg-purple-400/[0.06] rounded-lg border border-purple-400/10 hover:bg-purple-400/[0.1] transition-colors"
        >
          + new space
        </button>

        {creating && (
          <div className="space-y-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createSpace(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Space name..."
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/80 text-[13px] focus:outline-none focus:border-white/[0.15] placeholder-neutral-600"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What's this space about? (optional)"
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/80 text-[12px] focus:outline-none focus:border-white/[0.15] placeholder-neutral-600"
            />
            <div className="flex gap-2">
              <button onClick={createSpace} disabled={!newName.trim()} className="px-3 py-1.5 text-[11px] text-white/70 bg-white/[0.08] rounded-lg border border-white/[0.08] disabled:opacity-30">create</button>
              <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-[11px] text-neutral-500">cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-[12px] text-neutral-600 animate-pulse">loading...</p>
        ) : spaces.length === 0 && !creating ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-neutral-600 text-sm">no spaces yet</p>
            <p className="text-neutral-700 text-xs">create a space to curate ideas and share them via link</p>
          </div>
        ) : (
          <div className="space-y-2">
            {spaces.map((space) => (
              <button
                key={space.id}
                onClick={() => fetchSpace(space.id)}
                className="w-full text-left px-5 py-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-white/80">{space.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${space.is_public ? 'text-green-400/70 bg-green-400/10' : 'text-neutral-600 bg-white/[0.03]'}`}>
                      {space.is_public ? 'public' : 'draft'}
                    </span>
                  </div>
                </div>
                {space.description && (
                  <p className="text-[12px] text-neutral-500 mt-1">{space.description}</p>
                )}
                <span className="text-[10px] text-neutral-700 mt-2 inline-block">
                  {space.space_items?.[0]?.count || 0} items
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Detail view
  const nodeMap = new Map(selected.nodes.map(n => [n.id, n]))
  const inputMap = new Map(selected.inputs.map(i => [i.id, i]))
  const existingNodeIds = new Set(selected.items.filter(i => i.node_id).map(i => i.node_id))
  const existingInputIds = new Set(selected.items.filter(i => i.input_id).map(i => i.input_id))

  return (
    <div className="max-w-2xl mx-auto px-8 py-10 space-y-6">
      <button onClick={() => { setSelected(null); setAddMode(null) }} className="text-[11px] text-neutral-600 hover:text-neutral-400">
        &larr; all spaces
      </button>

      <div className="space-y-2">
        <h1 className="text-[18px] text-white/90 font-light">{selected.space.name}</h1>
        {selected.space.description && (
          <p className="text-[13px] text-neutral-500">{selected.space.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => togglePublic(selected)}
          className={`px-3 py-1.5 text-[11px] rounded-lg border transition-all ${
            selected.space.is_public
              ? 'text-green-400/70 border-green-400/20 bg-green-400/5'
              : 'text-neutral-500 border-white/[0.08] bg-white/[0.04] hover:text-white/70'
          }`}
        >
          {selected.space.is_public ? '● public' : 'make public'}
        </button>

        {selected.space.is_public && (
          <button
            onClick={() => copyLink(selected.space.slug)}
            className="px-3 py-1.5 text-[11px] text-purple-400/60 hover:text-purple-400 border border-purple-400/10 rounded-lg"
          >
            {copied ? 'copied!' : 'copy share link'}
          </button>
        )}

        {selected.space.is_public && (
          <a
            href={`/s/${selected.space.slug}`}
            target="_blank"
            className="text-[11px] text-blue-400/50 hover:text-blue-400"
          >
            preview &rarr;
          </a>
        )}

        <button
          onClick={() => deleteSpace(selected.space.id)}
          className="text-[11px] text-neutral-600 hover:text-red-400/70 ml-auto"
        >
          delete
        </button>
      </div>

      {/* Add items */}
      <div className="flex gap-2">
        <button
          onClick={() => setAddMode(addMode === 'nodes' ? null : 'nodes')}
          className={`px-3 py-1.5 text-[11px] rounded-lg border transition-all ${
            addMode === 'nodes' ? 'text-white/70 border-white/[0.12] bg-white/[0.06]' : 'text-neutral-500 border-white/[0.06] hover:text-white/60'
          }`}
        >
          + add nodes
        </button>
        <button
          onClick={() => setAddMode(addMode === 'sources' ? null : 'sources')}
          className={`px-3 py-1.5 text-[11px] rounded-lg border transition-all ${
            addMode === 'sources' ? 'text-white/70 border-white/[0.12] bg-white/[0.06]' : 'text-neutral-500 border-white/[0.06] hover:text-white/60'
          }`}
        >
          + add sources
        </button>
        <button
          onClick={() => addAllNodes(selected.space.id)}
          className="px-3 py-1.5 text-[11px] text-neutral-600 hover:text-white/60 border border-white/[0.04] rounded-lg"
        >
          add all nodes
        </button>
      </div>

      {/* Add mode: pick nodes/sources */}
      {addMode === 'nodes' && (
        <div className="space-y-1 max-h-60 overflow-y-auto bg-white/[0.01] border border-white/[0.04] rounded-xl p-2">
          {Array.from(store.nodes.values())
            .filter(n => !existingNodeIds.has(n.id))
            .map(n => (
              <button
                key={n.id}
                onClick={() => addItem(selected.space.id, n.id)}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/[0.04] flex items-center gap-2"
              >
                <span className={`text-[9px] ${typeColors[n.type] || 'text-neutral-600'}`}>●</span>
                <span className="text-[12px] text-white/60 truncate">{n.content}</span>
              </button>
            ))}
        </div>
      )}

      {addMode === 'sources' && (
        <div className="space-y-1 max-h-60 overflow-y-auto bg-white/[0.01] border border-white/[0.04] rounded-xl p-2">
          {Array.from(store.inputs.values())
            .filter(i => !existingInputIds.has(i.id))
            .map(i => {
              const label = SOURCE_LABELS[i.source_type] || SOURCE_LABELS.journal
              const title = (i.source_metadata?.title as string) || i.raw_content.slice(0, 50)
              return (
                <button
                  key={i.id}
                  onClick={() => addItem(selected.space.id, undefined, i.id)}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/[0.04] flex items-center gap-2"
                >
                  <span className={`text-[10px] ${label.color}`}>{label.label}</span>
                  <span className="text-[12px] text-white/60 truncate">{title}</span>
                </button>
              )
            })}
        </div>
      )}

      {/* Current items */}
      <div className="space-y-2">
        <h3 className="text-[10px] text-neutral-500 uppercase tracking-widest">
          {selected.items.length} items in this space
        </h3>
        {selected.items.length === 0 ? (
          <p className="text-[12px] text-neutral-700 italic py-6">
            add nodes or sources to start curating this space
          </p>
        ) : (
          <div className="space-y-1">
            {selected.items.map((item) => {
              const node = item.node_id ? nodeMap.get(item.node_id) : null
              const input = item.input_id ? inputMap.get(item.input_id) : null

              return (
                <div key={item.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex-1 min-w-0">
                    {node && (
                      <>
                        <p className="text-[12px] text-white/70 truncate">{node.content}</p>
                        <span className={`text-[10px] ${typeColors[node.type] || 'text-neutral-600'}`}>{node.type}</span>
                      </>
                    )}
                    {input && (
                      <>
                        <p className="text-[12px] text-white/70 truncate">
                          {(input.source_metadata?.title as string) || input.raw_content.slice(0, 50)}
                        </p>
                        <span className={`text-[10px] ${SOURCE_LABELS[input.source_type]?.color || 'text-neutral-600'}`}>
                          {SOURCE_LABELS[input.source_type]?.label || input.source_type}
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(selected.space.id, item.id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 p-1"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 1l8 8M9 1l-8 8" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
