'use client'

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

interface Selection {
  type: 'node' | 'input'
  id: string
}

interface NodeFull {
  id: string; content: string; type: string; weight?: number; created_at: string; input_id: string | null; source_url?: string | null; perspectives?: string[]
}

interface Edge {
  from_node_id: string; to_node_id: string; relationship: string; strength: number; reason?: string; id?: string
}

interface InputFull {
  id: string; raw_content: string; source_type: string; source_metadata: Record<string, unknown>
  source_url?: string | null; status: string; created_at: string
}

interface DataStore {
  nodes: Map<string, NodeFull>
  edges: Edge[]
  inputs: Map<string, InputFull>
  // Derived: node -> edges
  nodeEdges: (nodeId: string) => Array<{ node: { id: string; content: string; type: string }; relationship: string; strength: number; reason: string; edgeId: string }>
  // Derived: input -> nodes
  inputNodes: (inputId: string) => NodeFull[]
}

interface SelectionContextType {
  selection: Selection | null
  select: (type: 'node' | 'input', id: string) => void
  goBack: () => void
  clearSelection: () => void
  store: DataStore
  updateNode: (id: string, updates: Partial<NodeFull>) => void
  removeNode: (id: string) => void
  updateInput: (id: string, updates: Partial<InputFull>) => void
  removeInput: (id: string) => void
  addEdge: (edge: Edge) => void
}

const SelectionContext = createContext<SelectionContextType>(null!)

export function useSelection() {
  return useContext(SelectionContext)
}

export function SelectionProvider({
  children,
  initialNodes,
  initialEdges,
  initialInputs,
}: {
  children: ReactNode
  initialNodes: NodeFull[]
  initialEdges: Edge[]
  initialInputs: InputFull[]
}) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const historyRef = useRef<Selection[]>([])
  const [nodes, setNodes] = useState(() => new Map(initialNodes.map(n => [n.id, n])))
  const [edges, setEdges] = useState(initialEdges)
  const [inputs, setInputs] = useState(() => new Map(initialInputs.map(i => [i.id, i])))

  // Keep refs for derived lookups to avoid re-renders
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  const select = useCallback((type: 'node' | 'input', id: string) => {
    setSelection(prev => {
      if (prev) historyRef.current.push(prev)
      return { type, id }
    })
  }, [])

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop()
    setSelection(prev || null)
  }, [])

  const clearSelection = useCallback(() => {
    historyRef.current = []
    setSelection(null)
  }, [])

  const updateNode = useCallback((id: string, updates: Partial<NodeFull>) => {
    setNodes(prev => {
      const next = new Map(prev)
      const existing = next.get(id)
      if (existing) next.set(id, { ...existing, ...updates })
      return next
    })
  }, [])

  const removeNode = useCallback((id: string) => {
    setNodes(prev => { const next = new Map(prev); next.delete(id); return next })
    setEdges(prev => prev.filter(e => e.from_node_id !== id && e.to_node_id !== id))
  }, [])

  const updateInput = useCallback((id: string, updates: Partial<InputFull>) => {
    setInputs(prev => {
      const next = new Map(prev)
      const existing = next.get(id)
      if (existing) next.set(id, { ...existing, ...updates })
      return next
    })
  }, [])

  const removeInput = useCallback((id: string) => {
    setInputs(prev => { const next = new Map(prev); next.delete(id); return next })
    // Remove nodes from this input
    setNodes(prev => {
      const next = new Map(prev)
      for (const [nid, node] of next) {
        if (node.input_id === id) next.delete(nid)
      }
      return next
    })
  }, [])

  const addEdge = useCallback((edge: Edge) => {
    setEdges(prev => [...prev, edge])
  }, [])

  const store: DataStore = {
    nodes,
    edges,
    inputs,
    nodeEdges: (nodeId: string) => {
      const result: Array<{ node: { id: string; content: string; type: string }; relationship: string; strength: number; reason: string; edgeId: string }> = []
      for (const e of edges) {
        if (e.from_node_id === nodeId) {
          const n = nodes.get(e.to_node_id)
          if (n) result.push({ node: { id: n.id, content: n.content, type: n.type }, relationship: e.relationship, strength: e.strength, reason: e.reason || '', edgeId: e.id || '' })
        } else if (e.to_node_id === nodeId) {
          const n = nodes.get(e.from_node_id)
          if (n) result.push({ node: { id: n.id, content: n.content, type: n.type }, relationship: e.relationship, strength: e.strength, reason: e.reason || '', edgeId: e.id || '' })
        }
      }
      return result
    },
    inputNodes: (inputId: string) => {
      const result: NodeFull[] = []
      for (const n of nodes.values()) {
        if (n.input_id === inputId) result.push(n)
      }
      return result
    },
  }

  return (
    <SelectionContext.Provider value={{ selection, select, goBack, clearSelection, store, updateNode, removeNode, updateInput, removeInput, addEdge }}>
      {children}
    </SelectionContext.Provider>
  )
}
