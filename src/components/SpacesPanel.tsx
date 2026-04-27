'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Portal from './Portal'

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
}

export default function SpacesPanel() {
  const router = useRouter()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [selected, setSelected] = useState<SpaceDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

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
      body: JSON.stringify({ name: newName }),
    })
    if (res.ok) {
      setNewName('')
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

  // List view
  if (!selected) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] text-white/80 font-medium">Spaces</h2>
          <button
            onClick={() => setCreating(true)}
            className="text-[11px] text-purple-400/60 hover:text-purple-400"
          >+ new space</button>
        </div>

        {creating && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createSpace(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Space name..."
              className="flex-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/80 text-[12px] focus:outline-none focus:border-white/[0.15] placeholder-neutral-600"
            />
            <button onClick={createSpace} className="px-3 py-1.5 text-[11px] text-white/70 bg-white/[0.08] rounded-lg border border-white/[0.08]">create</button>
          </div>
        )}

        {loading ? (
          <p className="text-[12px] text-neutral-600 animate-pulse">loading...</p>
        ) : spaces.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-[13px] text-neutral-600">no spaces yet</p>
            <p className="text-[11px] text-neutral-700">create a space to curate and share your ideas</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {spaces.map((space) => (
              <button
                key={space.id}
                onClick={() => fetchSpace(space.id)}
                className="w-full text-left px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-white/80">{space.name}</span>
                  <span className={`text-[10px] ${space.is_public ? 'text-green-400/60' : 'text-neutral-600'}`}>
                    {space.is_public ? 'public' : 'draft'}
                  </span>
                </div>
                {space.description && (
                  <p className="text-[11px] text-neutral-600 mt-0.5">{space.description}</p>
                )}
                <span className="text-[10px] text-neutral-700 mt-1 inline-block">
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setSelected(null)} className="text-[11px] text-neutral-600 hover:text-neutral-400">
          &larr; spaces
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="text-[16px] text-white/90 font-medium">{selected.space.name}</h2>
        {selected.space.description && (
          <p className="text-[12px] text-neutral-500">{selected.space.description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => togglePublic(selected)}
          className={`px-3 py-1 text-[11px] rounded-lg border transition-all ${
            selected.space.is_public
              ? 'text-green-400/70 border-green-400/20 bg-green-400/5'
              : 'text-neutral-500 border-white/[0.08] bg-white/[0.04]'
          }`}
        >
          {selected.space.is_public ? 'public' : 'make public'}
        </button>
        {selected.space.is_public && (
          <span className="text-[10px] text-blue-400/50">
            /s/{selected.space.slug}
          </span>
        )}
        <button
          onClick={() => deleteSpace(selected.space.id)}
          className="text-[11px] text-neutral-600 hover:text-red-400/70 ml-auto"
        >delete space</button>
      </div>

      {/* Items */}
      <div className="space-y-2">
        <h3 className="text-[10px] text-neutral-500 uppercase tracking-widest">Items</h3>
        {selected.items.length === 0 ? (
          <p className="text-[11px] text-neutral-700 italic py-4">
            drag nodes or sources here, or add from their detail view
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
                        <span className="text-[10px] text-neutral-600">{input.source_type}</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(selected.space.id, item.id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all p-1"
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
