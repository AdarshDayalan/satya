'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSelection } from './SelectionContext'
import { computeEvidenceRank } from '@/lib/evidence-rank'

interface Space {
  id: string
  name: string
  slug: string
  description: string
  is_public: boolean
  created_at: string
  space_items: Array<{ count: number }>
}

interface SpaceItem {
  id: string
  node_id: string | null
  input_id: string | null
  custom_weight?: number
}

interface SpaceDetail {
  space: Space
  items: SpaceItem[]
  nodes: Array<{ id: string; content: string; type: string; input_id?: string }>
  inputs: Array<{ id: string; raw_content: string; source_type: string; source_metadata: Record<string, unknown> }>
}

const typeColors: Record<string, string> = {
  concept: 'text-pink-400/60',
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  evidence: 'text-cyan-400/60',
  mechanism: 'text-amber-400/60',
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  journal: { label: 'journal', color: 'text-white/40' },
  youtube: { label: 'YouTube', color: 'text-red-400/60' },
  article: { label: 'article', color: 'text-blue-400/60' },
  reddit: { label: 'Reddit', color: 'text-orange-400/60' },
  pubmed: { label: 'PubMed', color: 'text-cyan-400/60' },
  research_paper: { label: 'paper', color: 'text-green-400/60' },
  blog: { label: 'blog', color: 'text-amber-400/60' },
  podcast: { label: 'podcast', color: 'text-violet-400/60' },
  book: { label: 'book', color: 'text-emerald-400/60' },
  twitter: { label: 'X', color: 'text-sky-400/60' },
  tiktok: { label: 'TikTok', color: 'text-rose-400/60' },
  newsletter: { label: 'newsletter', color: 'text-indigo-400/60' },
  wikipedia: { label: 'Wikipedia', color: 'text-neutral-300/60' },
  government: { label: 'gov', color: 'text-teal-400/60' },
}

interface PendingState {
  nodeIds: Set<string>
  inputIds: Set<string>
  weights: Map<string, number> // node_id -> custom weight
}

export default function SpacesPanel() {
  const { store } = useSelection()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [selected, setSelected] = useState<SpaceDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addMode, setAddMode] = useState<'hierarchy' | 'nodes' | 'sources' | 'folders' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'cascade' | 'flat'>('cascade')

  const [draft, setDraft] = useState<PendingState>({ nodeIds: new Set(), inputIds: new Set(), weights: new Map() })
  const [serverState, setServerState] = useState<PendingState>({ nodeIds: new Set(), inputIds: new Set(), weights: new Map() })

  const hasChanges = useMemo(() => {
    const dn = [...draft.nodeIds].sort().join(',')
    const sn = [...serverState.nodeIds].sort().join(',')
    const di = [...draft.inputIds].sort().join(',')
    const si = [...serverState.inputIds].sort().join(',')
    const dw = [...draft.weights.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}:${v}`).join(',')
    const sw = [...serverState.weights.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}:${v}`).join(',')
    return dn !== sn || di !== si || dw !== sw
  }, [draft, serverState])

  // Build folder data from store edges
  const folders = useMemo(() => {
    const folderMap = new Map<string, { id: string; name: string; nodeIds: string[] }>()
    // Group nodes by input_id as pseudo-folders
    for (const [, node] of store.nodes) {
      const inputId = (node as { input_id?: string }).input_id
      if (!inputId) continue
      const input = store.inputs.get(inputId)
      if (!input) continue
      if (!folderMap.has(inputId)) {
        const title = (input.source_metadata?.title as string) || input.raw_content.slice(0, 40)
        folderMap.set(inputId, { id: inputId, name: title, nodeIds: [] })
      }
      folderMap.get(inputId)!.nodeIds.push(node.id)
    }
    return Array.from(folderMap.values())
  }, [store.nodes, store.inputs])

  // EvidenceRank for cascade ordering
  const evidenceRanks = useMemo(() => {
    const nodeArr = Array.from(store.nodes.values())
    return computeEvidenceRank(nodeArr, store.edges, undefined, 4, 0.15)
  }, [store.nodes, store.edges])

  // Build evidence hierarchy tree — who supports whom
  // Convention: higher-level concepts sit at depth 0 (LEFT). Their supporting
  // evidence cascades down-and-right. An edge "X supports Y" means X is evidence
  // for the more-general claim Y, so Y is the parent and X is the child.
  const hierarchyTree = useMemo(() => {
    interface TreeNode { id: string; content: string; type: string; rank: number; children: TreeNode[] }
    const allNodes = Array.from(store.nodes.values())

    // Pick the strongest upward edge per child → assigns a single canonical parent
    const parentOf = new Map<string, string>()
    const parentStrength = new Map<string, number>()
    const childrenOf = new Map<string, string[]>()

    for (const e of store.edges) {
      const upward = ['evidence_for', 'supports', 'mechanism_of', 'example_of', 'causes'].includes(e.relationship)
      if (!upward) continue
      const childId = e.from_node_id
      const parentId = e.to_node_id
      if (childId === parentId) continue // self-loop guard
      const cur = parentStrength.get(childId) ?? -Infinity
      if (e.strength > cur) {
        parentStrength.set(childId, e.strength)
        parentOf.set(childId, parentId)
      }
    }

    // Break cycles: if following parent pointers from a node loops back to itself,
    // detach the weakest link in that cycle so the graph becomes a forest.
    function findCycle(start: string): string[] | null {
      const path: string[] = []
      const seen = new Set<string>()
      let cur: string | undefined = start
      while (cur && !seen.has(cur)) {
        seen.add(cur)
        path.push(cur)
        cur = parentOf.get(cur)
      }
      if (cur && path.includes(cur)) {
        return path.slice(path.indexOf(cur))
      }
      return null
    }
    for (const id of Array.from(parentOf.keys())) {
      const cycle = findCycle(id)
      if (!cycle) continue
      // remove the weakest edge in the cycle
      let weakestChild = cycle[0]
      let weakest = parentStrength.get(weakestChild) ?? Infinity
      for (const c of cycle) {
        const s = parentStrength.get(c) ?? Infinity
        if (s < weakest) { weakest = s; weakestChild = c }
      }
      parentOf.delete(weakestChild)
      parentStrength.delete(weakestChild)
    }

    // Build children map (now guaranteed acyclic)
    for (const [childId, parentId] of parentOf) {
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, [])
      childrenOf.get(parentId)!.push(childId)
    }

    // Roots = highest concepts (no parent). Sort by EvidenceRank so the heaviest
    // ideas surface first.
    const roots = allNodes.filter(n => !parentOf.has(n.id))
      .sort((a, b) => (evidenceRanks.get(b.id) || 1) - (evidenceRanks.get(a.id) || 1))

    function buildTree(nodeId: string, depth: number, ancestors: Set<string>): TreeNode | null {
      const node = store.nodes.get(nodeId)
      if (!node || depth > 6) return null
      if (ancestors.has(nodeId)) return null // belt-and-braces cycle guard
      const nextAncestors = new Set(ancestors); nextAncestors.add(nodeId)
      const kids = (childrenOf.get(nodeId) || [])
        .map(cid => buildTree(cid, depth + 1, nextAncestors))
        .filter(Boolean) as TreeNode[]
      kids.sort((a, b) => b.rank - a.rank)
      return { id: node.id, content: node.content, type: node.type, rank: evidenceRanks.get(node.id) || 1, children: kids }
    }

    return roots.slice(0, 30).map(n => buildTree(n.id, 0, new Set())).filter(Boolean) as TreeNode[]
  }, [store.nodes, store.edges, evidenceRanks])

  // Expanded tree nodes in hierarchy picker
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(new Set())
  function toggleTreeExpand(id: string) {
    setTreeExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  // Add node + all its descendants
  function addWithDescendants(nodeId: string) {
    interface TN { id: string; children: TN[] }
    function collectIds(tree: TN[]): string[] {
      const ids: string[] = []
      for (const n of tree) { ids.push(n.id); ids.push(...collectIds(n.children)) }
      return ids
    }
    function findNode(tree: TN[], id: string): TN | null {
      for (const n of tree) { if (n.id === id) return n; const found = findNode(n.children, id); if (found) return found }
      return null
    }
    const target = findNode(hierarchyTree, nodeId)
    if (!target) { toggleNode(nodeId); return }
    const ids = collectIds([target])
    setDraft(prev => {
      const next = new Set(prev.nodeIds)
      for (const id of ids) next.add(id)
      return { ...prev, nodeIds: next }
    })
  }
  // Remove node + all its descendants
  function removeWithDescendants(nodeId: string) {
    interface TN { id: string; children: TN[] }
    function collectIds(tree: TN[]): string[] {
      const ids: string[] = []
      for (const n of tree) { ids.push(n.id); ids.push(...collectIds(n.children)) }
      return ids
    }
    function findNode(tree: TN[], id: string): TN | null {
      for (const n of tree) { if (n.id === id) return n; const found = findNode(n.children, id); if (found) return found }
      return null
    }
    const target = findNode(hierarchyTree, nodeId)
    if (!target) { toggleNode(nodeId); return }
    const ids = collectIds([target])
    setDraft(prev => {
      const next = new Set(prev.nodeIds)
      for (const id of ids) next.delete(id)
      return { ...prev, nodeIds: next }
    })
  }

  // Cascade view: sort draft nodes by combined weight (EvidenceRank × custom weight)
  const cascadeNodes = useMemo(() => {
    const allNodes = Array.from(store.nodes.values())
    const draftArr = allNodes.filter(n => draft.nodeIds.has(n.id))

    // Build adjacency for grouping
    const adj = new Map<string, Array<{ id: string; rel: string; strength: number }>>()
    for (const e of store.edges) {
      if (!draft.nodeIds.has(e.from_node_id) || !draft.nodeIds.has(e.to_node_id)) continue
      if (!adj.has(e.from_node_id)) adj.set(e.from_node_id, [])
      if (!adj.has(e.to_node_id)) adj.set(e.to_node_id, [])
      adj.get(e.from_node_id)!.push({ id: e.to_node_id, rel: e.relationship, strength: e.strength })
      adj.get(e.to_node_id)!.push({ id: e.from_node_id, rel: e.relationship, strength: e.strength })
    }

    return draftArr
      .map(n => {
        const er = evidenceRanks.get(n.id) || 1
        const cw = draft.weights.get(n.id) || 1
        const combined = er * cw
        const children = (adj.get(n.id) || [])
          .filter(c => draft.nodeIds.has(c.id))
          .sort((a, b) => b.strength - a.strength)
        return { ...n, combinedWeight: combined, children }
      })
      .sort((a, b) => b.combinedWeight - a.combinedWeight)
  }, [store.nodes, store.edges, draft.nodeIds, draft.weights, evidenceRanks])

  const fetchSpaces = useCallback(async () => {
    const res = await fetch('/api/spaces')
    if (res.ok) setSpaces((await res.json()).spaces)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSpaces() }, [fetchSpaces])

  async function fetchSpace(id: string) {
    const res = await fetch(`/api/spaces/${id}`)
    if (!res.ok) return
    const data: SpaceDetail = await res.json()
    setSelected(data)
    const nIds = new Set(data.items.filter(i => i.node_id).map(i => i.node_id!))
    const iIds = new Set(data.items.filter(i => i.input_id).map(i => i.input_id!))
    const weights = new Map<string, number>()
    for (const item of data.items) {
      if (item.node_id && item.custom_weight && item.custom_weight !== 1) {
        weights.set(item.node_id, item.custom_weight)
      }
    }
    setDraft({ nodeIds: new Set(nIds), inputIds: new Set(iIds), weights: new Map(weights) })
    setServerState({ nodeIds: nIds, inputIds: iIds, weights })
  }

  async function createSpace() {
    if (!newName.trim()) return
    const res = await fetch('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, description: newDesc }),
    })
    if (res.ok) { setNewName(''); setNewDesc(''); setCreating(false); fetchSpaces() }
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
  }

  // Local toggles — instant
  function toggleNode(nodeId: string) {
    setDraft(prev => {
      const next = new Set(prev.nodeIds)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return { ...prev, nodeIds: next }
    })
  }

  function toggleInput(inputId: string) {
    setDraft(prev => {
      const next = new Set(prev.inputIds)
      if (next.has(inputId)) next.delete(inputId)
      else next.add(inputId)
      return { ...prev, inputIds: next }
    })
  }

  function addFolder(folderId: string) {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return
    setDraft(prev => {
      const nextNodes = new Set(prev.nodeIds)
      const nextInputs = new Set(prev.inputIds)
      for (const nid of folder.nodeIds) nextNodes.add(nid)
      nextInputs.add(folderId) // add the source too
      return { ...prev, nodeIds: nextNodes, inputIds: nextInputs }
    })
  }

  function removeFolder(folderId: string) {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return
    setDraft(prev => {
      const nextNodes = new Set(prev.nodeIds)
      const nextInputs = new Set(prev.inputIds)
      for (const nid of folder.nodeIds) nextNodes.delete(nid)
      nextInputs.delete(folderId)
      return { ...prev, nodeIds: nextNodes, inputIds: nextInputs }
    })
  }

  function addAllNodes() {
    setDraft(prev => {
      const next = new Set(prev.nodeIds)
      for (const [id] of store.nodes) next.add(id)
      return { ...prev, nodeIds: next }
    })
  }

  function setNodeWeight(nodeId: string, weight: number) {
    setDraft(prev => {
      const next = new Map(prev.weights)
      if (weight === 1) next.delete(nodeId)
      else next.set(nodeId, weight)
      return { ...prev, weights: next }
    })
  }

  function discardChanges() {
    setDraft({ nodeIds: new Set(serverState.nodeIds), inputIds: new Set(serverState.inputIds), weights: new Map(serverState.weights) })
  }

  async function saveChanges() {
    if (!selected) return
    setSaving(true)
    const toAddNodes = [...draft.nodeIds].filter(id => !serverState.nodeIds.has(id))
    const toRemoveNodes = [...serverState.nodeIds].filter(id => !draft.nodeIds.has(id))
    const toAddInputs = [...draft.inputIds].filter(id => !serverState.inputIds.has(id))
    const toRemoveInputs = [...serverState.inputIds].filter(id => !draft.inputIds.has(id))

    await fetch(`/api/spaces/${selected.space.id}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        add_nodes: toAddNodes,
        remove_nodes: toRemoveNodes,
        add_inputs: toAddInputs,
        remove_inputs: toRemoveInputs,
        weights: Object.fromEntries(draft.weights),
      }),
    })

    await fetchSpace(selected.space.id)
    await fetchSpaces()
    setSaving(false)
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Filter nodes/sources by search
  function matchesSearch(text: string) {
    if (!searchQuery) return true
    return text.toLowerCase().includes(searchQuery.toLowerCase())
  }

  // === LIST VIEW ===
  if (!selected) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-10 space-y-6">
        <div>
          <h1 className="text-[18px] text-white/90 font-light">Spaces</h1>
          <p className="text-[13px] text-neutral-500 mt-1">
            Curate and share your knowledge. Each space is a narrative you control — pick ideas, set weights, share via link.
          </p>
        </div>

        <button onClick={() => setCreating(true)}
          className="px-4 py-2 text-[12px] text-purple-400/70 bg-purple-400/[0.06] rounded-lg border border-purple-400/10 hover:bg-purple-400/[0.1]">
          + new space
        </button>

        {creating && (
          <div className="space-y-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createSpace(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Space name..." className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/80 text-[13px] focus:outline-none focus:border-white/[0.15] placeholder-neutral-600" />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What's this space about? (optional)"
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/80 text-[12px] focus:outline-none focus:border-white/[0.15] placeholder-neutral-600" />
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
              <button key={space.id} onClick={() => fetchSpace(space.id)}
                className="w-full text-left px-5 py-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-white/80">{space.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${space.is_public ? 'text-green-400/70 bg-green-400/10' : 'text-neutral-600 bg-white/[0.03]'}`}>
                    {space.is_public ? 'public' : 'draft'}
                  </span>
                </div>
                {space.description && <p className="text-[12px] text-neutral-500 mt-1">{space.description}</p>}
                <span className="text-[10px] text-neutral-700 mt-2 inline-block">{space.space_items?.[0]?.count || 0} items</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // === DETAIL VIEW ===
  const allNodes = Array.from(store.nodes.values())
  const availableNodes = allNodes.filter(n => !draft.nodeIds.has(n.id) && matchesSearch(n.content))
  const availableInputs = Array.from(store.inputs.values()).filter(i => !draft.inputIds.has(i.id) && matchesSearch((i.source_metadata?.title as string) || i.raw_content))
  const availableFolders = folders.filter(f => matchesSearch(f.name))

  // How many of a folder's nodes are in the draft
  function folderCoverage(folder: { nodeIds: string[] }) {
    const inDraft = folder.nodeIds.filter(id => draft.nodeIds.has(id)).length
    return { inDraft, total: folder.nodeIds.length }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
      <button onClick={() => { setSelected(null); setAddMode(null); setSearchQuery('') }} className="text-[11px] text-neutral-600 hover:text-neutral-400">
        &larr; all spaces
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] text-white/90 font-light">{selected.space.name}</h1>
          {selected.space.description && <p className="text-[13px] text-neutral-500 mt-1">{selected.space.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => togglePublic(selected)}
            className={`px-3 py-1.5 text-[11px] rounded-lg border ${selected.space.is_public ? 'text-green-400/70 border-green-400/20 bg-green-400/5' : 'text-neutral-500 border-white/[0.08] bg-white/[0.04]'}`}>
            {selected.space.is_public ? '● public' : 'publish'}
          </button>
          {selected.space.is_public && (
            <button onClick={() => copyLink(selected.space.slug)}
              className="px-3 py-1.5 text-[11px] text-purple-400/60 hover:text-purple-400 border border-purple-400/10 rounded-lg">
              {copied ? 'copied!' : 'copy link'}
            </button>
          )}
        </div>
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-400/[0.06] border border-purple-400/15 rounded-xl">
          <span className="text-[12px] text-purple-300/70 flex-1">unsaved changes</span>
          <button onClick={discardChanges} className="px-3 py-1 text-[11px] text-neutral-400 hover:text-white/70">discard</button>
          <button onClick={saveChanges} disabled={saving}
            className="px-4 py-1 text-[11px] text-white bg-purple-500/30 hover:bg-purple-500/40 rounded-lg border border-purple-400/20 disabled:opacity-50">
            {saving ? 'saving...' : 'save'}
          </button>
        </div>
      )}

      {/* Add toolbar */}
      <div className="flex gap-1.5 flex-wrap items-center">
        {(['hierarchy', 'folders', 'nodes', 'sources'] as const).map(mode => (
          <button key={mode} onClick={() => { setAddMode(addMode === mode ? null : mode); setSearchQuery('') }}
            className={`px-3 py-1.5 text-[11px] rounded-lg border ${addMode === mode ? 'text-white/70 border-white/[0.12] bg-white/[0.06]' : 'text-neutral-500 border-white/[0.06] hover:text-white/60'}`}>
            {mode === 'hierarchy' ? '◇ tree' : `+ ${mode}`}
          </button>
        ))}
        <button onClick={addAllNodes} className="px-3 py-1.5 text-[11px] text-neutral-600 hover:text-white/60 border border-white/[0.04] rounded-lg">all</button>
        <button onClick={() => deleteSpace(selected.space.id)} className="text-[11px] text-neutral-700 hover:text-red-400/70 ml-auto">delete</button>
      </div>

      {/* Add picker */}
      {addMode && (
        <div className="space-y-2 bg-white/[0.01] border border-white/[0.04] rounded-xl p-3">
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="search..."
            className="w-full px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/80 text-[12px] focus:outline-none focus:border-white/[0.12] placeholder-neutral-600" />

          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {/* Folders */}
            {addMode === 'folders' && availableFolders.map(folder => {
              const cov = folderCoverage(folder)
              return (
                <div key={folder.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04]">
                  <button onClick={() => addFolder(folder.id)} className="flex-1 text-left min-w-0">
                    <p className="text-[12px] text-white/60 truncate">{folder.name}</p>
                    <span className="text-[10px] text-neutral-600">{folder.nodeIds.length} nodes</span>
                  </button>
                  {cov.inDraft > 0 && (
                    <span className="text-[10px] text-green-400/50">{cov.inDraft}/{cov.total}</span>
                  )}
                </div>
              )
            })}

            {/* Nodes */}
            {addMode === 'nodes' && availableNodes.map(n => {
              const er = evidenceRanks.get(n.id) || 1
              return (
                <button key={n.id} onClick={() => toggleNode(n.id)}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/[0.04] flex items-center gap-2">
                  <span className={`text-[9px] ${typeColors[n.type] || 'text-neutral-600'}`}>●</span>
                  <span className="text-[12px] text-white/60 truncate flex-1">{n.content}</span>
                  <span className="text-[9px] text-neutral-700">{er.toFixed(1)}</span>
                </button>
              )
            })}

            {/* Sources */}
            {addMode === 'sources' && availableInputs.map(i => {
              const label = SOURCE_LABELS[i.source_type] || SOURCE_LABELS.journal
              const title = (i.source_metadata?.title as string) || i.raw_content.slice(0, 50)
              const nodeCount = Array.from(store.nodes.values()).filter(n => (n as { input_id?: string }).input_id === i.id).length
              return (
                <div key={i.id} className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/[0.04]">
                  <button onClick={() => toggleInput(i.id)} className="flex-1 text-left flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] shrink-0 ${label.color}`}>{label.label}</span>
                    <span className="text-[12px] text-white/60 truncate">{title}</span>
                  </button>
                  <button onClick={() => addFolder(i.id)} className="shrink-0 px-2 py-0.5 text-[10px] text-neutral-600 hover:text-white/60 rounded" title="Add source + all its nodes">
                    +{nodeCount} nodes
                  </button>
                </div>
              )
            })}

            {/* Hierarchy tree — browse evidence chains, add/remove branches */}
            {addMode === 'hierarchy' && (
              <HierarchyTree
                tree={hierarchyTree}
                draftNodeIds={draft.nodeIds}
                treeExpanded={treeExpanded}
                onToggleExpand={toggleTreeExpand}
                onAdd={addWithDescendants}
                onRemove={removeWithDescendants}
                onToggleSingle={toggleNode}
                typeColors={typeColors}
                searchQuery={searchQuery}
              />
            )}
          </div>
        </div>
      )}

      {/* View mode toggle */}
      {draft.nodeIds.size > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-600">{draft.nodeIds.size} ideas · {draft.inputIds.size} sources</span>
          <div className="ml-auto flex gap-1">
            {(['cascade', 'flat'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-2 py-1 text-[10px] rounded ${viewMode === m ? 'text-white/70 bg-white/[0.06]' : 'text-neutral-600 hover:text-neutral-400'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cascade view — biggest ideas first with evidence underneath */}
      {draft.nodeIds.size === 0 && draft.inputIds.size === 0 ? (
        <p className="text-[12px] text-neutral-700 italic py-8 text-center">add ideas, sources, or folders to curate this space</p>
      ) : viewMode === 'cascade' ? (
        <div className="space-y-1">
          {cascadeNodes.map((node) => {
            const cw = draft.weights.get(node.id) || 1
            const er = evidenceRanks.get(node.id) || 1
            const barWidth = Math.min(100, (node.combinedWeight / (cascadeNodes[0]?.combinedWeight || 1)) * 100)

            return (
              <div key={node.id} className="group relative">
                {/* Weight bar background */}
                <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                  <div className="h-full bg-white/[0.015] rounded-lg" style={{ width: `${barWidth}%` }} />
                </div>

                <div className="relative flex items-center gap-2 px-3 py-2 rounded-lg">
                  <span className={`text-[9px] shrink-0 ${typeColors[node.type] || 'text-neutral-600'}`}>●</span>
                  <p className="text-[12px] text-white/70 flex-1 min-w-0 truncate">{node.content}</p>

                  {/* Custom weight control */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setNodeWeight(node.id, Math.max(0.5, cw - 0.5))}
                      className="w-5 h-5 flex items-center justify-center text-[10px] text-neutral-600 hover:text-white/60 rounded bg-white/[0.04]">−</button>
                    <span className="text-[10px] text-neutral-500 w-6 text-center">{cw.toFixed(1)}</span>
                    <button onClick={() => setNodeWeight(node.id, Math.min(5, cw + 0.5))}
                      className="w-5 h-5 flex items-center justify-center text-[10px] text-neutral-600 hover:text-white/60 rounded bg-white/[0.04]">+</button>
                  </div>

                  <span className="text-[9px] text-neutral-700 shrink-0 w-8 text-right">{(er * cw).toFixed(1)}</span>

                  <button onClick={() => toggleNode(node.id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-700 hover:text-red-400 p-0.5">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l6 6M7 1l-6 6" /></svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Flat view */
        <div className="space-y-1">
          {Array.from(store.nodes.values()).filter(n => draft.nodeIds.has(n.id)).map(node => (
            <div key={node.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <span className={`text-[9px] ${typeColors[node.type] || 'text-neutral-600'}`}>●</span>
              <p className="text-[12px] text-white/70 truncate flex-1">{node.content}</p>
              <span className={`text-[10px] ${typeColors[node.type] || 'text-neutral-600'}`}>{node.type}</span>
              <button onClick={() => toggleNode(node.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 p-1">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l6 6M7 1l-6 6" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// === Hierarchy Tree Component ===
interface TreeNode {
  id: string; content: string; type: string; rank: number; children: TreeNode[]
}

function HierarchyTree({
  tree, draftNodeIds, treeExpanded, onToggleExpand, onAdd, onRemove, onToggleSingle, typeColors, searchQuery, depth = 0,
}: {
  tree: TreeNode[]
  draftNodeIds: Set<string>
  treeExpanded: Set<string>
  onToggleExpand: (id: string) => void
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onToggleSingle: (id: string) => void
  typeColors: Record<string, string>
  searchQuery: string
  depth?: number
}) {
  function matches(node: TreeNode): boolean {
    if (!searchQuery) return true
    if (node.content.toLowerCase().includes(searchQuery.toLowerCase())) return true
    return node.children.some(c => matches(c))
  }

  // Header shown once at depth 0 to anchor direction in the user's mind
  const headerLabel = depth === 0 ? (
    <div className="flex items-center gap-2 px-3 py-1.5 mb-1 text-[9px] uppercase tracking-wider text-neutral-600 border-b border-white/[0.04]">
      <span className="text-purple-400/70">◆ higher concept</span>
      <span className="text-neutral-700">→</span>
      <span>supporting evidence</span>
      <span className="ml-auto text-neutral-700 normal-case tracking-normal">indent = depth</span>
    </div>
  ) : null

  return (
    <>
      {headerLabel}
      {tree.filter(matches).map(node => {
        const inDraft = draftNodeIds.has(node.id)
        const isExpanded = treeExpanded.has(node.id)
        const hasChildren = node.children.length > 0
        const childCount = node.children.length
        const indentStep = 22 // wider per-level so direction is unmistakable
        const pl = 12 + depth * indentStep
        const isRoot = depth === 0

        return (
          <div key={node.id} className="relative">
            {/* Vertical guide lines for each ancestor level — makes parent→child obvious */}
            {Array.from({ length: depth }).map((_, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute top-0 bottom-0 w-px bg-white/[0.05]"
                style={{ left: `${12 + i * indentStep + 8}px` }}
              />
            ))}

            <div
              className={`group relative flex items-center gap-1 py-[3px] rounded ${isRoot ? 'bg-white/[0.02] hover:bg-white/[0.05]' : 'hover:bg-white/[0.04]'}`}
              style={{ paddingLeft: `${pl}px`, paddingRight: '8px' }}
            >
              {/* Horizontal connector from vertical line to this row (only for children) */}
              {!isRoot && (
                <span
                  aria-hidden
                  className="absolute top-1/2 h-px bg-white/[0.08]"
                  style={{ left: `${12 + (depth - 1) * indentStep + 8}px`, width: `${indentStep - 8}px` }}
                />
              )}

              {/* Direction arrow on children: "↑ supports the concept on the left" */}
              {!isRoot && (
                <span
                  className="absolute text-[9px] text-purple-400/40 select-none"
                  style={{ left: `${pl - 14}px` }}
                  title="supports the concept on the left"
                >↖</span>
              )}

              {/* Expand chevron */}
              {hasChildren ? (
                <button onClick={() => onToggleExpand(node.id)} className="w-4 h-4 flex items-center justify-center shrink-0">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`text-neutral-600 ${isExpanded ? 'rotate-90' : ''}`}>
                    <path d="M2 1l4 3-4 3z" />
                  </svg>
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              {/* Type dot */}
              <span className={`text-[8px] shrink-0 ${typeColors[node.type] || 'text-neutral-600'}`}>●</span>

              {/* Content — root concepts get a slightly brighter weight to read as "higher" */}
              <span className={`text-[11px] truncate flex-1 min-w-0 ${isRoot ? 'text-white/85 font-medium' : 'text-white/55'}`}>{node.content}</span>

              {/* Rank */}
              <span className="text-[9px] text-neutral-700 shrink-0 w-6 text-right">{node.rank.toFixed(1)}</span>

              {/* Add/remove buttons */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100">
                {inDraft ? (
                  <>
                    <button onClick={() => onToggleSingle(node.id)} className="px-1.5 py-0.5 text-[9px] text-red-400/60 hover:text-red-400 rounded" title="Remove this node">−</button>
                    {hasChildren && (
                      <button onClick={() => onRemove(node.id)} className="px-1.5 py-0.5 text-[9px] text-red-400/60 hover:text-red-400 rounded" title="Remove with all children">−all</button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => onToggleSingle(node.id)} className="px-1.5 py-0.5 text-[9px] text-green-400/60 hover:text-green-400 rounded" title="Add this node">+</button>
                    {hasChildren && (
                      <button onClick={() => onAdd(node.id)} className="px-1.5 py-0.5 text-[9px] text-green-400/60 hover:text-green-400 rounded" title="Add with all children">+all</button>
                    )}
                  </>
                )}
              </div>

              {/* In-draft indicator */}
              {inDraft && <span className="w-1.5 h-1.5 rounded-full bg-purple-400/50 shrink-0" />}

              {/* Child count */}
              {hasChildren && <span className="text-[9px] text-neutral-700 shrink-0">{childCount}</span>}
            </div>

            {/* Render children */}
            {isExpanded && hasChildren && (
              <HierarchyTree
                tree={node.children}
                draftNodeIds={draftNodeIds}
                treeExpanded={treeExpanded}
                onToggleExpand={onToggleExpand}
                onAdd={onAdd}
                onRemove={onRemove}
                onToggleSingle={onToggleSingle}
                typeColors={typeColors}
                searchQuery={searchQuery}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
