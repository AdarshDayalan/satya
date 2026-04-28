'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

interface GraphNavigationContextType {
  focusStack: string[]
  focusedNodeId: string | null
  pushFocus: (nodeId: string) => void
  popFocus: () => void
  jumpTo: (index: number) => void
  resetFocus: () => void
}

const GraphNavigationContext = createContext<GraphNavigationContextType>(null!)

export function useGraphNavigation() {
  return useContext(GraphNavigationContext)
}

interface GraphNode {
  id: string
  content: string
  type: string
}

interface GraphEdge {
  from_node_id: string
  to_node_id: string
  relationship: string
  strength: number
}

export function GraphNavigationProvider({
  children,
  nodes,
  edges,
}: {
  children: ReactNode
  nodes: GraphNode[]
  edges: GraphEdge[]
}) {
  const [focusStack, setFocusStack] = useState<string[]>([])

  const focusedNodeId = focusStack.length > 0 ? focusStack[focusStack.length - 1] : null

  // Adjacency for the smart pushFocus logic — used to detect lateral moves to siblings of ancestors.
  const adjForPush = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const e of edges) {
      if (!map.has(e.from_node_id)) map.set(e.from_node_id, new Set())
      if (!map.has(e.to_node_id)) map.set(e.to_node_id, new Set())
      map.get(e.from_node_id)!.add(e.to_node_id)
      map.get(e.to_node_id)!.add(e.from_node_id)
    }
    return map
  }, [edges])

  const pushFocus = useCallback((nodeId: string) => {
    setFocusStack(prev => {
      // 1) If already in stack, jump back to that level (handles circular paths).
      const idx = prev.indexOf(nodeId)
      if (idx !== -1) return prev.slice(0, idx + 1)

      // 2) If the new node connects to an ancestor (not just the current focus), truncate
      //    to that ancestor — the user is laterally exploring a higher-level concept's
      //    neighborhood, not drilling deeper. Avoids unbounded stack growth on circular graphs.
      const neighbors = adjForPush.get(nodeId)
      if (neighbors && prev.length >= 2) {
        // Walk ancestors oldest-first; truncate at the highest ancestor the new node touches.
        for (let i = 0; i < prev.length - 1; i++) {
          if (neighbors.has(prev[i])) {
            return [...prev.slice(0, i + 1), nodeId]
          }
        }
      }

      // 3) Otherwise drill deeper.
      return [...prev, nodeId]
    })
  }, [adjForPush])

  const popFocus = useCallback(() => {
    setFocusStack(prev => prev.slice(0, -1))
  }, [])

  const jumpTo = useCallback((index: number) => {
    setFocusStack(prev => prev.slice(0, index + 1))
  }, [])

  const resetFocus = useCallback(() => {
    setFocusStack([])
  }, [])

  // Compute children of focused node for sidebar
  const adj = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const e of edges) {
      if (!map.has(e.from_node_id)) map.set(e.from_node_id, [])
      if (!map.has(e.to_node_id)) map.set(e.to_node_id, [])
      map.get(e.from_node_id)!.push(e.to_node_id)
      map.get(e.to_node_id)!.push(e.from_node_id)
    }
    return map
  }, [edges])

  // Nodes to show in sidebar — children of focused, or top-level concepts
  const sidebarNodes = useMemo(() => {
    if (!focusedNodeId) {
      // Top level: concepts, then high-connection nodes
      const concepts = nodes.filter(n => n.type === 'concept')
      if (concepts.length > 0) return concepts
      // Fallback: nodes sorted by connection count
      return [...nodes]
        .sort((a, b) => (adj.get(b.id)?.length || 0) - (adj.get(a.id)?.length || 0))
        .slice(0, 12)
    }
    // Children of focused node
    const childIds = adj.get(focusedNodeId) || []
    return childIds
      .map(id => nodes.find(n => n.id === id))
      .filter(Boolean) as GraphNode[]
  }, [focusedNodeId, nodes, adj])

  // Breadcrumb labels
  const breadcrumbs = useMemo(() => {
    return focusStack.map(id => {
      const node = nodes.find(n => n.id === id)
      return {
        id,
        label: node ? (node.content.length > 25 ? node.content.slice(0, 25) + '…' : node.content) : id.slice(0, 8),
        type: node?.type || 'idea',
      }
    })
  }, [focusStack, nodes])

  return (
    <GraphNavigationContext.Provider value={{ focusStack, focusedNodeId, pushFocus, popFocus, jumpTo, resetFocus }}>
      {children}
    </GraphNavigationContext.Provider>
  )
}

// Export derived data hook
export function useGraphSidebarData(nodes: GraphNode[], edges: GraphEdge[]) {
  const { focusStack, focusedNodeId } = useGraphNavigation()

  const adj = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const e of edges) {
      if (!map.has(e.from_node_id)) map.set(e.from_node_id, [])
      if (!map.has(e.to_node_id)) map.set(e.to_node_id, [])
      map.get(e.from_node_id)!.push(e.to_node_id)
      map.get(e.to_node_id)!.push(e.from_node_id)
    }
    return map
  }, [edges])

  const sidebarNodes = useMemo(() => {
    if (!focusedNodeId) {
      const concepts = nodes.filter(n => n.type === 'concept')
      if (concepts.length > 0) return concepts
      return [...nodes]
        .sort((a, b) => (adj.get(b.id)?.length || 0) - (adj.get(a.id)?.length || 0))
        .slice(0, 12)
    }
    const childIds = adj.get(focusedNodeId) || []
    return childIds
      .map(id => nodes.find(n => n.id === id))
      .filter(Boolean) as GraphNode[]
  }, [focusedNodeId, nodes, adj])

  const breadcrumbs = useMemo(() => {
    return focusStack.map(id => {
      const node = nodes.find(n => n.id === id)
      return {
        id,
        label: node ? (node.content.length > 25 ? node.content.slice(0, 25) + '…' : node.content) : id.slice(0, 8),
        type: node?.type || 'idea',
      }
    })
  }, [focusStack, nodes])

  return { sidebarNodes, breadcrumbs, focusedNodeId }
}
