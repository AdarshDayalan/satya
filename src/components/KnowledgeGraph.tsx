'use client'

import { useRef, useEffect, useCallback, useState, useMemo, Fragment } from 'react'
import { computeEvidenceRank, weightToRadius } from '@/lib/evidence-rank'
import { useRouter } from 'next/navigation'
import { useGraphNavigation } from './GraphNavigationContext'
import { useTheme } from './ThemeContext'

interface GraphNode {
  id: string
  content: string
  type: string
  weight?: number
  created_at: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  connections?: number
  radius?: number
  targetRadius?: number
  displayRadius?: number
  targetAlpha?: number
  displayAlpha?: number
}

interface GraphEdge {
  from_node_id: string
  to_node_id: string
  relationship: string
  strength: number
}

interface Folder {
  id: string
  name: string
}

interface FolderNode {
  folder_id: string
  node_id: string
}

const TYPE_COLORS: Record<string, string> = {
  concept: '#f472b6',
  idea: '#60a5fa',
  question: '#fbbf24',
  source: '#34d399',
  synthesis: '#a78bfa',
  self: '#c4b5fd',
  raw: '#737373',
}

const REL_COLORS: Record<string, string> = {
  supports: '#34d399',
  contradicts: '#f87171',
  refines: '#60a5fa',
  similar: '#a78bfa',
  causes: '#fbbf24',
  example_of: '#38bdf8',
  related: '#525252',
}

const REL_TYPES = ['supports', 'contradicts', 'refines', 'example_of', 'causes', 'similar']

interface PendingConnection {
  fromNode: GraphNode
  toNode: GraphNode
}

export default function KnowledgeGraph({
  nodes,
  edges,
  folders,
  folderNodes,
  fullscreen = false,
  onNodeClick,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  folders: Folder[]
  folderNodes: FolderNode[]
  fullscreen?: boolean
  onNodeClick?: (nodeId: string) => void
}) {
  const { theme } = useTheme()
  // Use theme node colors, falling back to hardcoded
  const TYPE_COLORS_THEMED: Record<string, string> = {
    ...TYPE_COLORS,
    concept: theme.nodeColors.concept,
    idea: theme.nodeColors.idea,
    question: theme.nodeColors.question,
    evidence: theme.nodeColors.evidence,
    mechanism: theme.nodeColors.mechanism,
    self: theme.nodeColors.self,
    raw: theme.nodeColors.raw,
  }
  const themeRef = useRef(theme)
  themeRef.current = theme
  const typedColorsRef = useRef(TYPE_COLORS_THEMED)
  typedColorsRef.current = TYPE_COLORS_THEMED
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const graphNodes = useRef<GraphNode[]>([])
  const time = useRef(0)
  const router = useRouter()

  // Keep callbacks in refs so event listener closures always have the latest
  const onNodeClickRef = useRef(onNodeClick)
  onNodeClickRef.current = onNodeClick




  // Interaction state
  const hoveredNode = useRef<GraphNode | null>(null)
  const dragNode = useRef<GraphNode | null>(null)
  const isDragging = useRef(false)
  const didDrag = useRef(false)
  const mouseDownPos = useRef({ x: 0, y: 0 })
  const mouse = useRef({ x: 0, y: 0 })
  const pan = useRef({ x: 0, y: 0 })
  const zoom = useRef(1)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string; type: string } | null>(null)

  // Layout mode — kept internally as 'organic' (no UI toggle anymore — user opts into filters instead).
  const [layoutMode] = useState<'organic' | 'hierarchy'>('organic')
  const layoutModeRef = useRef(layoutMode)
  layoutModeRef.current = layoutMode

  // Filter bar — narrows what the graph shows. 'all' = everything; node-type filters restrict to that
  // type; 'evidence' is special: when something is focused, traces every node that transitively
  // supports it via supports/refines edges (not just immediate neighbors).
  type FilterMode = 'all' | 'concepts' | 'sources' | 'evidence'
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  // Connecting state — shift+drag from node to node
  const isConnecting = useRef(false)
  const connectFrom = useRef<GraphNode | null>(null)
  const connectMouseWorld = useRef({ x: 0, y: 0 })
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null)
  const [connRelationship, setConnRelationship] = useState('supports')
  const [connStrength, setConnStrength] = useState(0.8)
  const [connSaving, setConnSaving] = useState(false)
  const [connDetecting, setConnDetecting] = useState(false)

  // Compute EvidenceRank early — needed by visibility filter
  const nodeRadii = useMemo(() => {
    const ranks = computeEvidenceRank(nodes, edges, undefined, 4, 0.15)
    return weightToRadius(ranks, 3, 22)
  }, [nodes, edges])

  // Focus stack navigation — from context
  const graphNav = (() => { try { return useGraphNavigation() } catch { return null } })()
  const focusStack = graphNav?.focusStack ?? []
  const focusedNodeId = graphNav?.focusedNodeId ?? null
  const pushFocusRef = useRef(graphNav?.pushFocus)
  pushFocusRef.current = graphNav?.pushFocus

  // Default behavior is always 'organic' — the user explicitly opts into 'hierarchy' via the toggle.

  // 'evidence' filter only makes sense when focused — drop back to 'all' on defocus.
  useEffect(() => {
    if (!focusedNodeId && filterMode === 'evidence') setFilterMode('all')
  }, [focusedNodeId, filterMode])

  // Adjacency map (shared)
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

  // Node roles: focus, child, ancestor, sibling, top-level, or faint background web
  type NodeRole = 'focus' | 'child' | 'ancestor' | 'sibling' | 'top' | 'web'
  const { visibleNodeIds, nodeRoles, ancestorDepth } = useMemo(() => {
    const visible = new Set<string>()
    const roles = new Map<string, NodeRole>()
    // Distance from focus along ancestor chain (1 = parent, 2 = grandparent…). Used for left-flowing layout.
    const depth = new Map<string, number>()

    if (!focusedNodeId) {
      // Top-level: highlight concepts + orphans + top-ranked, plus a faint 1-hop web around them for character.
      const highlighted = new Set<string>()
      for (const n of nodes) {
        if (n.type === 'concept') { highlighted.add(n.id); roles.set(n.id, 'top') }
      }
      for (const n of nodes) {
        if (!adj.has(n.id) || adj.get(n.id)!.length === 0) { highlighted.add(n.id); roles.set(n.id, 'top') }
      }
      if (highlighted.size < 5) {
        const ranked = [...nodes]
          .sort((a, b) => (nodeRadii.get(b.id) || 0) - (nodeRadii.get(a.id) || 0))
          .slice(0, Math.max(8, nodes.length > 20 ? 12 : nodes.length))
        for (const n of ranked) { highlighted.add(n.id); if (!roles.has(n.id)) roles.set(n.id, 'top') }
      }
      for (const id of highlighted) visible.add(id)

      // Faint web — every other node, so the unfocused canvas feels like a complex network.
      for (const n of nodes) {
        if (!visible.has(n.id)) { visible.add(n.id); roles.set(n.id, 'web') }
      }
    } else {
      // Focused view
      visible.add(focusedNodeId); roles.set(focusedNodeId, 'focus')

      // Children of focused
      for (const childId of (adj.get(focusedNodeId) || [])) {
        visible.add(childId); roles.set(childId, 'child')
      }

      // Ancestors (rest of stack) — index 0 is oldest, last entry is current focus.
      // Closer to focus → smaller depth (parent = 1).
      const stackLen = focusStack.length
      for (let i = 0; i < stackLen - 1; i++) {
        const id = focusStack[i]
        visible.add(id); roles.set(id, 'ancestor')
        depth.set(id, stackLen - 1 - i)
      }

      // Siblings (other children of parent)
      if (focusStack.length >= 2) {
        const parentId = focusStack[focusStack.length - 2]
        for (const sibId of (adj.get(parentId) || [])) {
          if (!visible.has(sibId)) { visible.add(sibId); roles.set(sibId, 'sibling') }
        }
      }
    }
    return { visibleNodeIds: visible, nodeRoles: roles, ancestorDepth: depth }
  }, [nodes, edges, focusedNodeId, focusStack, nodeRadii, adj])

  // BFS depth from concept roots + per-depth Y slot — used by unfocused hierarchy mode.
  // Each node gets a (depth, slot) so the layout is a clean grid: depth → X, slot → Y.
  const rootLayout = useMemo(() => {
    const depthMap = new Map<string, number>()
    const slotMap = new Map<string, number>()
    const groupSize = new Map<number, number>()
    const queue: string[] = []
    for (const n of nodes) {
      if (n.type === 'concept') { depthMap.set(n.id, 0); queue.push(n.id) }
    }
    let head = 0
    while (head < queue.length) {
      const id = queue[head++]
      const d = depthMap.get(id)!
      for (const nbr of (adj.get(id) || [])) {
        if (!depthMap.has(nbr)) { depthMap.set(nbr, d + 1); queue.push(nbr) }
      }
    }
    // Unreachable nodes get a synthetic depth so they appear far right.
    let maxDepth = 0
    for (const d of depthMap.values()) if (d > maxDepth) maxDepth = d
    for (const n of nodes) if (!depthMap.has(n.id)) depthMap.set(n.id, maxDepth + 1)
    // Assign a Y slot per depth-group (deterministic by id so it's stable across renders).
    const byDepth = new Map<number, string[]>()
    for (const [id, d] of depthMap) {
      if (!byDepth.has(d)) byDepth.set(d, [])
      byDepth.get(d)!.push(id)
    }
    for (const [d, ids] of byDepth) {
      ids.sort()
      groupSize.set(d, ids.length)
      ids.forEach((id, i) => slotMap.set(id, i))
    }
    return { depthMap, slotMap, groupSize }
  }, [nodes, adj])
  const rootLayoutRef = useRef(rootLayout)
  rootLayoutRef.current = rootLayout

  // Filter mask — overlays on top of role-based visibility. 'all' = no extra filtering.
  // 'evidence' is the special transitive mode: when focused, BFS via supports/refines edges to
  // find every node that transitively backs the focused claim (including ones not directly connected).
  const filterMask = useMemo(() => {
    if (filterMode === 'all') return null

    if (filterMode === 'evidence') {
      if (!focusedNodeId) return null
      // BFS upstream via supporting edges. An edge "X supports Y" means X is evidence for Y;
      // we want every X that reaches the focus, so traverse incoming supports.
      const incoming = new Map<string, string[]>()
      for (const e of edges) {
        if (e.relationship === 'supports' || e.relationship === 'refines' || e.relationship === 'example_of') {
          if (!incoming.has(e.to_node_id)) incoming.set(e.to_node_id, [])
          incoming.get(e.to_node_id)!.push(e.from_node_id)
        }
      }
      const reachable = new Set<string>([focusedNodeId])
      const stack = [focusedNodeId]
      while (stack.length) {
        const id = stack.pop()!
        for (const src of (incoming.get(id) || [])) {
          if (!reachable.has(src)) { reachable.add(src); stack.push(src) }
        }
      }
      return reachable
    }

    // Type-based filters keep the focus visible regardless of type.
    const typeMatch: Record<string, (t: string) => boolean> = {
      concepts: t => t === 'concept',
      sources: t => t === 'source',
    }
    const match = typeMatch[filterMode]
    if (!match) return null
    const set = new Set<string>()
    for (const n of nodes) if (match(n.type)) set.add(n.id)
    if (focusedNodeId) set.add(focusedNodeId)
    return set
  }, [filterMode, focusedNodeId, edges, nodes])

  // Filter to visible — combine role-based visibility with the filter mask.
  const visibleNodes = useMemo(() => {
    return nodes.filter(n => visibleNodeIds.has(n.id) && (!filterMask || filterMask.has(n.id)))
  }, [nodes, visibleNodeIds, filterMask])
  const finalVisibleIds = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes])
  // In focused mode, only render edges that touch the focus or run along the ancestor chain.
  // Child-to-child and sibling-to-sibling edges create unreadable spaghetti, so we hide them.
  // Exception: in 'evidence' filter mode, show every supporting edge so the chain is visible.
  const visibleEdges = useMemo(() => {
    if (filterMode === 'evidence' && focusedNodeId) {
      return edges.filter(e =>
        finalVisibleIds.has(e.from_node_id) && finalVisibleIds.has(e.to_node_id) &&
        (e.relationship === 'supports' || e.relationship === 'refines' || e.relationship === 'example_of')
      )
    }
    if (!focusedNodeId) {
      return edges.filter(e => finalVisibleIds.has(e.from_node_id) && finalVisibleIds.has(e.to_node_id))
    }
    const stackSet = new Set(focusStack)
    return edges.filter(e => {
      if (!finalVisibleIds.has(e.from_node_id) || !finalVisibleIds.has(e.to_node_id)) return false
      // Always show edges touching the focused node.
      if (e.from_node_id === focusedNodeId || e.to_node_id === focusedNodeId) return true
      // Show edges along the ancestor chain (ancestor ↔ ancestor or ancestor ↔ focus).
      if (stackSet.has(e.from_node_id) && stackSet.has(e.to_node_id)) return true
      return false
    })
  }, [edges, finalVisibleIds, focusedNodeId, focusStack, filterMode])

  // Count hidden children per visible node
  const hiddenChildCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of visibleNodes) {
      const neighbors = adj.get(n.id) || []
      const hidden = neighbors.filter(id => !visibleNodeIds.has(id)).length
      if (hidden > 0) counts.set(n.id, hidden)
    }
    return counts
  }, [visibleNodes, adj, visibleNodeIds])

  // Refs for closures
  const hiddenChildCountRef = useRef(hiddenChildCount)
  hiddenChildCountRef.current = hiddenChildCount
  const nodeRolesRef = useRef(nodeRoles)
  nodeRolesRef.current = nodeRoles
  const ancestorDepthRef = useRef(ancestorDepth)
  ancestorDepthRef.current = ancestorDepth
  const focusedNodeIdRef = useRef(focusedNodeId)
  focusedNodeIdRef.current = focusedNodeId

  // Camera animation targets
  const targetPan = useRef({ x: 0, y: 0 })
  const targetZoom = useRef(1)

  // Build folder membership map
  const folderMap = useRef<Map<string, string[]>>(new Map())

  useEffect(() => {
    const fm = new Map<string, string[]>()
    for (const fn of folderNodes) {
      if (!fm.has(fn.folder_id)) fm.set(fn.folder_id, [])
      fm.get(fn.folder_id)!.push(fn.node_id)
    }
    folderMap.current = fm
  }, [folderNodes])



  // Sync graphNodes with visibleNodes — add new, remove gone, preserve existing positions
  const syncNodes = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.offsetWidth || 800
    const h = canvas.offsetHeight || 600

    const existing = new Map(graphNodes.current.map(n => [n.id, n]))

    graphNodes.current = visibleNodes.map((n, i) => {
      const baseRadius = nodeRadii.get(n.id) || 4

      const prev = existing.get(n.id)
      if (prev) {
        return {
          ...prev, ...n,
          radius: baseRadius,
          displayRadius: prev.displayRadius ?? baseRadius,
          displayAlpha: prev.displayAlpha ?? 0.85,
        }
      }

      const angle = (i / visibleNodes.length) * Math.PI * 2
      const r = Math.min(w, h) * 0.3
      return {
        ...n,
        x: w / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 60,
        y: h / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 60,
        vx: 0,
        vy: 0,
        connections: 0,
        radius: baseRadius,
        displayRadius: 0,
        displayAlpha: 0,
      }
    })
  }, [visibleNodes, nodeRadii])

  // Keep refs for animation loop (avoids recreating the effect)
  const visibleEdgesRef = useRef(visibleEdges)
  visibleEdgesRef.current = visibleEdges

  // Update targets whenever roles change — runs on every focus change
  useEffect(() => {
    syncNodes() // Add/remove nodes
    // In 'evidence' filter, the foreground is the *evidence* (raw observations + sources).
    // Concepts and intermediate ideas/mechanisms are still drawn so the chain reads, but dimmed.
    const isSupporting = filterMode === 'evidence' && !!focusedNodeId
    const isEvidenceType = (t: string) => t === 'evidence' || t === 'source' || t === 'raw'

    for (const n of graphNodes.current) {
      const baseRadius = nodeRadii.get(n.id) || n.radius || 4
      const role = nodeRoles.get(n.id) || 'top'

      if (isSupporting && n.id !== focusedNodeId) {
        // Evidence: prominent. Intermediates: faded chain markers.
        if (isEvidenceType(n.type)) {
          n.targetRadius = baseRadius * 1.3
          n.targetAlpha = 0.95
        } else {
          n.targetRadius = baseRadius * 0.55
          n.targetAlpha = 0.25
        }
        continue
      }

      n.targetRadius = role === 'focus' ? baseRadius * 2.0
        : role === 'child' ? baseRadius * 1.2
        : role === 'ancestor' ? baseRadius * 0.55
        : role === 'sibling' ? baseRadius * 0.35
        : role === 'web' ? Math.max(1.5, baseRadius * 0.45)
        : baseRadius

      n.targetAlpha = role === 'focus' ? 1.0
        : role === 'child' ? 0.9
        : role === 'ancestor' ? 0.35
        : role === 'sibling' ? 0.12
        : role === 'web' ? 0.12
        : 0.85
    }

    // Seed hierarchy column positions on focus change so ancestors snap to the left,
    // children to the right — physics smooths the rest. Only in hierarchy mode.
    if (focusedNodeId && layoutModeRef.current === 'hierarchy') {
      const focusNode = graphNodes.current.find(n => n.id === focusedNodeId)
      if (focusNode && focusNode.x !== undefined && focusNode.y !== undefined) {
        const fx = focusNode.x
        const fy = focusNode.y
        const COL_W = 260
        const children = graphNodes.current.filter(n => nodeRoles.get(n.id) === 'child')
        const siblings = graphNodes.current.filter(n => nodeRoles.get(n.id) === 'sibling')
        const ancestors = graphNodes.current.filter(n => nodeRoles.get(n.id) === 'ancestor')

        children.forEach((n, i) => {
          const k = children.length
          const yOffset = (i - (k - 1) / 2) * 90
          n.x = fx + COL_W + (Math.random() - 0.5) * 30
          n.y = fy + yOffset + (Math.random() - 0.5) * 20
          n.vx = 0; n.vy = 0
        })
        siblings.forEach((n, i) => {
          const k = siblings.length
          const yOffset = (i - (k - 1) / 2) * 70
          n.x = fx - COL_W * 0.4 + (Math.random() - 0.5) * 30
          n.y = fy + yOffset + (Math.random() - 0.5) * 20
          n.vx = 0; n.vy = 0
        })
        ancestors.forEach(n => {
          const d = ancestorDepth.get(n.id) ?? 1
          n.x = fx - d * COL_W + (Math.random() - 0.5) * 20
          // Keep ancestor Y near focus Y so they form a rough left-flowing chain.
          n.y = fy + (Math.random() - 0.5) * 30
          n.vx = 0; n.vy = 0
        })
      }
    }

    // Unfocused hierarchy snap — instantly grid-place every node so the toggle feels immediate.
    if (!focusedNodeId && layoutModeRef.current === 'hierarchy') {
      const canvas = canvasRef.current
      const cxWorld = canvas ? (canvas.offsetWidth / 2 / zoom.current - pan.current.x / zoom.current) : 0
      const cyWorld = canvas ? (canvas.offsetHeight / 2 / zoom.current - pan.current.y / zoom.current) : 0
      const COL_W = 260
      const ROWS_PER_SUBCOL = 8
      const subColWidth = COL_W * 0.5
      const ySpacing = 60
      const { depthMap, slotMap } = rootLayout
      for (const n of graphNodes.current) {
        const d = depthMap.get(n.id) ?? 0
        const slot = slotMap.get(n.id) ?? 0
        const subCol = Math.floor(slot / ROWS_PER_SUBCOL)
        const row = slot % ROWS_PER_SUBCOL
        n.x = cxWorld + (d - 1) * COL_W * 1.4 + subCol * subColWidth
        n.y = cyWorld + (row - (ROWS_PER_SUBCOL - 1) / 2) * ySpacing
        n.vx = 0; n.vy = 0
      }
    }

    // Camera: center on focused node, using the *target* zoom so pan & zoom stay aligned during the lerp.
    if (focusedNodeId) {
      const focusNode = graphNodes.current.find(n => n.id === focusedNodeId)
      const canvas = canvasRef.current
      if (focusNode && canvas && focusNode.x) {
        const w = canvas.offsetWidth / 2
        const h = canvas.offsetHeight / 2
        targetZoom.current = 1.2
        targetPan.current = {
          x: w - focusNode.x! * targetZoom.current,
          y: h - focusNode.y! * targetZoom.current,
        }
        cameraTransitioning.current = true
      }
    } else {
      targetPan.current = { x: 0, y: 0 }
      targetZoom.current = 1
      cameraTransitioning.current = true
    }
  }, [nodeRoles, nodeRadii, focusedNodeId, syncNodes, ancestorDepth, layoutMode, rootLayout, filterMode])

  // Camera transition flag — only lerp when actively transitioning
  const cameraTransitioning = useRef(false)

  // Find cluster centers for folder labels
  const getClusterCenters = useCallback(() => {
    const centers: Array<{ x: number; y: number; name: string }> = []
    const gn = graphNodes.current
    const nodeMap = new Map(gn.map(n => [n.id, n]))

    for (const [folderId, nodeIds] of folderMap.current.entries()) {
      const folder = folders.find(f => f.id === folderId)
      if (!folder) continue
      let cx = 0, cy = 0, count = 0
      for (const nid of nodeIds) {
        const node = nodeMap.get(nid)
        if (node) { cx += node.x!; cy += node.y!; count++ }
      }
      if (count > 0) centers.push({ x: cx / count, y: cy / count, name: folder.name })
    }
    return centers
  }, [folders])

  // Resize canvas when container changes (sidebar open/close)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (w > 0 && h > 0) {
        canvas.width = w * 2
        canvas.height = h * 2
      }
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  // Main animation loop — runs once, uses refs for all changing data
  useEffect(() => {
    syncNodes()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function animate() {
      if (!canvas || !ctx) return
      const w = canvas.width / 2
      const h = canvas.height / 2
      time.current += 0.008

      ctx.save()
      ctx.scale(2, 2)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = themeRef.current.graphBg
      ctx.fillRect(0, 0, w, h)

      ctx.save()
      ctx.translate(pan.current.x, pan.current.y)
      ctx.scale(zoom.current, zoom.current)

      const gn = graphNodes.current
      const nodeMap = new Map(gn.map(n => [n.id, n]))
      const hovered = hoveredNode.current
      const dragging = dragNode.current

      const isFocused = !!focusedNodeIdRef.current
      const isHierarchy = layoutModeRef.current === 'hierarchy'
      const cxWorld = w / 2 / zoom.current - pan.current.x / zoom.current
      const cyWorld = h / 2 / zoom.current - pan.current.y / zoom.current
      // Hierarchy column spacing — ancestors flow leftward, children rightward.
      const COL_W = 260

      // Anchor columns to the focus node's world position so panning the camera doesn't drag them.
      const focusNodeForLayout = isFocused ? nodeMap.get(focusedNodeIdRef.current!) : null
      const anchorX = focusNodeForLayout?.x ?? cxWorld
      const anchorY = focusNodeForLayout?.y ?? cyWorld

      // Physics — repulsion + drift toward role-appropriate column.
      for (let i = 0; i < gn.length; i++) {
        const a = gn[i]
        if (a === dragging) continue
        const aRole = nodeRolesRef.current.get(a.id)

        if (isFocused && isHierarchy && (aRole === 'ancestor' || aRole === 'child' || aRole === 'sibling')) {
          // Pull toward target column — strong X spring keeps the directional flow obvious.
          let targetX = anchorX
          let yPullStrength = 0.0015
          if (aRole === 'ancestor') {
            const d = ancestorDepthRef.current.get(a.id) ?? 1
            targetX = anchorX - d * COL_W
            // Anchor ancestors near focus Y so the chain reads as a horizontal line, not a tree.
            yPullStrength = 0.02
          } else if (aRole === 'child') {
            targetX = anchorX + COL_W
          } else if (aRole === 'sibling') {
            // Siblings sit just left of focus, offset vertically by physics.
            targetX = anchorX - COL_W * 0.5
          }
          a.vx! += (targetX - a.x!) * 0.03
          a.vy! += (anchorY - a.y!) * yPullStrength
        } else if (!isFocused && isHierarchy) {
          // Unfocused hierarchy: wrap each depth-group into a sub-grid so it doesn't pile vertically.
          const { depthMap, slotMap } = rootLayoutRef.current
          const d = depthMap.get(a.id) ?? 0
          const slot = slotMap.get(a.id) ?? 0
          const ROWS_PER_SUBCOL = 8
          const ySpacing = 60
          const subColWidth = COL_W * 0.5
          const subCol = Math.floor(slot / ROWS_PER_SUBCOL)
          const row = slot % ROWS_PER_SUBCOL
          const targetX = cxWorld + (d - 1) * COL_W * 1.4 + subCol * subColWidth
          const targetY = cyWorld + (row - (ROWS_PER_SUBCOL - 1) / 2) * ySpacing
          a.vx! += (targetX - a.x!) * 0.03
          a.vy! += (targetY - a.y!) * 0.03
        } else {
          // Organic drift — toward camera center, very weak so things stay where they settled.
          a.vx! += (cxWorld - a.x!) * 0.0001
          a.vy! += (cyWorld - a.y!) * 0.0001
        }

        for (let j = i + 1; j < gn.length; j++) {
          const b = gn[j]
          if (b === dragging) continue
          const bRole = nodeRolesRef.current.get(b.id)
          // Web nodes are background decoration — skip web↔web repulsion entirely so they stay put.
          if (aRole === 'web' && bRole === 'web') continue
          const dx = a.x! - b.x!
          const dy = a.y! - b.y!
          const distSq = dx * dx + dy * dy
          // Distance falloff — nodes farther than 220 don't interact, lets the graph settle into local clusters.
          if (distSq > 220 * 220) continue
          const dist = Math.sqrt(distSq) || 1
          const force = 3000 / distSq
          a.vx! += (dx / dist) * force
          a.vy! += (dy / dist) * force
          b.vx! -= (dx / dist) * force
          b.vy! -= (dy / dist) * force
        }
      }

      for (const edge of visibleEdgesRef.current) {
        const a = nodeMap.get(edge.from_node_id)
        const b = nodeMap.get(edge.to_node_id)
        if (!a || !b || a === dragging || b === dragging) continue
        const dx = b.x! - a.x!
        const dy = b.y! - a.y!
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const idealDist = edge.relationship === 'contradicts' ? 300 : 150
        // In hierarchy mode, weaken edge spring along X so columns dominate; keep Y so siblings still cluster.
        const aRole = nodeRolesRef.current.get(a.id)
        const bRole = nodeRolesRef.current.get(b.id)
        const inHierarchyEdge = isFocused && isHierarchy && (aRole === 'ancestor' || aRole === 'child' || aRole === 'sibling' || aRole === 'focus') && (bRole === 'ancestor' || bRole === 'child' || bRole === 'sibling' || bRole === 'focus')
        const xMult = inHierarchyEdge ? 0.15 : 1
        const force = (dist - idealDist) * 0.002 * edge.strength
        a.vx! += (dx / dist) * force * xMult
        a.vy! += (dy / dist) * force
        b.vx! -= (dx / dist) * force * xMult
        b.vy! -= (dy / dist) * force
      }

      for (const n of gn) {
        if (n === dragging) continue

        // Focus stays pinned — clear forces before integration so accumulated repulsion can't shift it.
        const role = nodeRolesRef.current.get(n.id)
        if (role === 'focus') {
          n.vx = 0; n.vy = 0
          continue
        }

        // Aggressive damping so nodes settle quickly instead of floating.
        const damping = (role === 'ancestor' || role === 'sibling' || role === 'web') ? 0.55 : 0.75

        n.vx! *= damping
        n.vy! *= damping
        // Velocity cap — keeps repulsion blow-ups from launching nodes.
        const VMAX = 6
        if (n.vx! > VMAX) n.vx = VMAX; else if (n.vx! < -VMAX) n.vx = -VMAX
        if (n.vy! > VMAX) n.vy = VMAX; else if (n.vy! < -VMAX) n.vy = -VMAX
        // Sleep threshold — kill imperceptible drift so the graph fully stops.
        if (Math.abs(n.vx!) < 0.02 && Math.abs(n.vy!) < 0.02) { n.vx = 0; n.vy = 0 }
        n.x! += n.vx!
        n.y! += n.vy!

        // Lerp display values toward targets
        const LERP = 0.06
        if (n.targetAlpha !== undefined) {
          n.displayAlpha = (n.displayAlpha ?? 0.85) + (n.targetAlpha - (n.displayAlpha ?? 0.85)) * LERP
        }
        if (n.targetRadius !== undefined) {
          n.displayRadius = (n.displayRadius ?? n.radius!) + (n.targetRadius - (n.displayRadius ?? n.radius!)) * LERP
        }
      }

      // Camera lerp — only when actively transitioning to a new target. The user can pan/zoom freely after.
      if (cameraTransitioning.current) {
        const dx = targetPan.current.x - pan.current.x
        const dy = targetPan.current.y - pan.current.y
        const dz = targetZoom.current - zoom.current
        pan.current.x += dx * 0.08
        pan.current.y += dy * 0.08
        zoom.current += dz * 0.08
        // Stop transitioning when settled
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(dz) < 0.01) {
          cameraTransitioning.current = false
        }
      }

      // --- Draw cluster glows ---
      for (const [, nodeIds] of folderMap.current.entries()) {
        let cx = 0, cy = 0, count = 0
        for (const nid of nodeIds) {
          const node = nodeMap.get(nid)
          if (node) { cx += node.x!; cy += node.y!; count++ }
        }
        if (count < 2) continue
        cx /= count; cy /= count
        let maxDist = 0
        for (const nid of nodeIds) {
          const node = nodeMap.get(nid)
          if (node) {
            const d = Math.sqrt((node.x! - cx) ** 2 + (node.y! - cy) ** 2)
            if (d > maxDist) maxDist = d
          }
        }
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDist + 60)
        grad.addColorStop(0, 'rgba(120, 100, 200, 0.04)')
        grad.addColorStop(0.7, 'rgba(120, 100, 200, 0.015)')
        grad.addColorStop(1, 'rgba(120, 100, 200, 0)')
        ctx.beginPath()
        ctx.arc(cx, cy, maxDist + 60, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }

      // --- Draw edges ---
      for (const edge of visibleEdgesRef.current) {
        const a = nodeMap.get(edge.from_node_id)
        const b = nodeMap.get(edge.to_node_id)
        if (!a || !b) continue
        const color = REL_COLORS[edge.relationship] || REL_COLORS.related
        const isContradiction = edge.relationship === 'contradicts'
        const isHighlighted = hovered && (hovered.id === edge.from_node_id || hovered.id === edge.to_node_id)
        // Edge fades with its nodes
        const nodeAlpha = Math.min(a.displayAlpha ?? 0.85, b.displayAlpha ?? 0.85)
        const baseAlpha = isHighlighted ? 0.6 : (0.05 + edge.strength * 0.3)
        ctx.globalAlpha = baseAlpha * nodeAlpha
        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = (0.5 + edge.strength * 2) * (isHighlighted ? 1.5 : 1)
        if (isContradiction) {
          ctx.setLineDash([4, 4])
          const vibrate = Math.sin(time.current * 8) * 2
          ctx.moveTo(a.x! + vibrate, a.y!)
          ctx.lineTo(b.x! - vibrate, b.y!)
        } else {
          ctx.setLineDash([])
          ctx.moveTo(a.x!, a.y!)
          ctx.lineTo(b.x!, b.y!)
        }
        ctx.stroke()
        ctx.setLineDash([])
        if (!isContradiction && isHighlighted) {
          const t = (time.current * 0.4 + edge.strength) % 1
          const px = a.x! + (b.x! - a.x!) * t
          const py = a.y! + (b.y! - a.y!) * t
          ctx.beginPath()
          ctx.arc(px, py, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.globalAlpha = 0.7
          ctx.fill()
        }
      }

      // --- Draw connecting line (shift+drag) ---
      if (isConnecting.current && connectFrom.current) {
        ctx.globalAlpha = 0.6
        ctx.beginPath()
        ctx.strokeStyle = '#a78bfa'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.moveTo(connectFrom.current.x!, connectFrom.current.y!)
        ctx.lineTo(connectMouseWorld.current.x, connectMouseWorld.current.y)
        ctx.stroke()
        ctx.setLineDash([])
        // Draw arrow head
        const dx = connectMouseWorld.current.x - connectFrom.current.x!
        const dy = connectMouseWorld.current.y - connectFrom.current.y!
        const angle = Math.atan2(dy, dx)
        ctx.beginPath()
        ctx.moveTo(connectMouseWorld.current.x, connectMouseWorld.current.y)
        ctx.lineTo(connectMouseWorld.current.x - 10 * Math.cos(angle - 0.4), connectMouseWorld.current.y - 10 * Math.sin(angle - 0.4))
        ctx.moveTo(connectMouseWorld.current.x, connectMouseWorld.current.y)
        ctx.lineTo(connectMouseWorld.current.x - 10 * Math.cos(angle + 0.4), connectMouseWorld.current.y - 10 * Math.sin(angle + 0.4))
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // --- Draw nodes ---
      ctx.globalAlpha = 1
      for (const n of gn) {
        const color = TYPE_COLORS_THEMED[n.type] || TYPE_COLORS.raw
        const r = n.displayRadius ?? n.radius ?? 4
        const alpha = n.displayAlpha ?? 0.85
        const isHovered = hovered === n
        const isConnectSource = connectFrom.current === n
        const role = nodeRolesRef.current.get(n.id)

        if (alpha < 0.05) continue

        // Glow for hover, focus, or connect source
        if (isHovered || isConnectSource || role === 'focus') {
          const glowR = (isHovered || isConnectSource) ? r * 4 : role === 'focus' ? r * 3 : r * 2
          const grad = ctx.createRadialGradient(n.x!, n.y!, r * 0.5, n.x!, n.y!, glowR)
          grad.addColorStop(0, color + '30')
          grad.addColorStop(1, color + '00')
          ctx.beginPath()
          ctx.arc(n.x!, n.y!, glowR, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.globalAlpha = alpha
          ctx.fill()
        }

        // Core dot
        ctx.beginPath()
        ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = isHovered ? Math.min(1, alpha + 0.3) : alpha
        ctx.fill()

        // Ring on connect source
        if (isConnectSource) {
          ctx.beginPath()
          ctx.arc(n.x!, n.y!, r + 3, 0, Math.PI * 2)
          ctx.strokeStyle = '#a78bfa'
          ctx.lineWidth = 1.5
          ctx.globalAlpha = 0.8
          ctx.stroke()
        }

        // Ring on the arrow-key-cycled child — visually marks which neighbor the detail panel is showing.
        if (cycledChildIdRef.current === n.id) {
          const pulse = 1 + Math.sin(time.current * 4) * 0.15
          ctx.beginPath()
          ctx.arc(n.x!, n.y!, r + 5 * pulse, 0, Math.PI * 2)
          ctx.strokeStyle = '#fbbf24'
          ctx.lineWidth = 2
          ctx.globalAlpha = 0.9
          ctx.stroke()
        }

        // Label — focused node gets full content card, others get truncated labels
        const isFocus = role === 'focus'
        const showLabel = isHovered || isFocus || (role === 'child' && r >= 6) || (role === 'top' && r >= 8)

        if (isFocus && alpha > 0.3) {
          // Full info card for focused node
          ctx.globalAlpha = alpha
          const cardY = n.y! + r + 16
          const maxWidth = 280
          ctx.font = 'bold 12px system-ui'
          ctx.textAlign = 'center'

          // Type label
          ctx.fillStyle = color
          ctx.globalAlpha = 0.6 * alpha
          ctx.font = '9px system-ui'
          ctx.fillText(n.type.toUpperCase(), n.x!, cardY)

          // Content — word wrap
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.globalAlpha = alpha
          ctx.font = '12px system-ui'
          const words = n.content.split(' ')
          let line = ''
          let lineY = cardY + 16
          for (const word of words) {
            const test = line + (line ? ' ' : '') + word
            if (ctx.measureText(test).width > maxWidth && line) {
              ctx.fillText(line, n.x!, lineY)
              line = word
              lineY += 16
              if (lineY > cardY + 64) { ctx.fillText(line + '…', n.x!, lineY); line = ''; break }
            } else {
              line = test
            }
          }
          if (line) ctx.fillText(line, n.x!, lineY)

          // Connection count
          const connCount = adj.get(n.id)?.length || 0
          const hiddenCount = hiddenChildCountRef.current.get(n.id) || 0
          ctx.font = '9px system-ui'
          ctx.fillStyle = 'rgba(255,255,255,0.3)'
          ctx.globalAlpha = 0.5 * alpha
          ctx.fillText(`${connCount} connections${hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}`, n.x!, lineY + 18)
        } else if (showLabel && alpha > 0.15) {
          ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'
          const fontSize = isHovered ? 11 : 8
          ctx.font = `${fontSize}px system-ui`
          ctx.textAlign = 'center'
          ctx.globalAlpha = (isHovered ? 1 : 0.5) * alpha
          const maxLen = isHovered ? 50 : 22
          const label = n.content.length > maxLen ? n.content.slice(0, maxLen) + '…' : n.content
          ctx.fillText(label, n.x!, n.y! + r + 12)
        }

        // Expand badge — hidden children count
        const hiddenCount = hiddenChildCountRef.current.get(n.id)
        if (hiddenCount && hiddenCount > 0 && alpha > 0.3) {
          const badgeX = n.x! + r + 2
          const badgeY = n.y! - r - 2
          ctx.globalAlpha = (isHovered ? 0.9 : 0.5) * alpha
          ctx.fillStyle = '#a78bfa'
          ctx.beginPath()
          ctx.arc(badgeX, badgeY, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = themeRef.current.graphBg
          ctx.font = 'bold 7px system-ui'
          ctx.textAlign = 'center'
          ctx.fillText(`${hiddenCount}`, badgeX, badgeY + 2.5)
        }

        ctx.globalAlpha = 1
      }

      // --- Draw cluster labels ---
      const centers = getClusterCenters()
      for (const c of centers) {
        ctx.fillStyle = 'rgba(180, 160, 255, 0.25)'
        ctx.font = '10px system-ui'
        ctx.textAlign = 'center'
        ctx.globalAlpha = 0.4
        ctx.fillText(c.name.toUpperCase(), c.x, c.y - 30)
        ctx.globalAlpha = 1
      }

      ctx.restore()
      ctx.restore()
      animRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — runs once, uses refs for all changing data

  // Mouse handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function findNode(sx: number, sy: number): GraphNode | null {
      const rect = canvas!.getBoundingClientRect()
      const x = (sx - rect.left - pan.current.x) / zoom.current
      const y = (sy - rect.top - pan.current.y) / zoom.current
      for (const n of graphNodes.current) {
        const r = (n.radius || 4) + 6
        if (Math.abs(n.x! - x) < r && Math.abs(n.y! - y) < r) return n
      }
      return null
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

      // Connecting mode
      if (isConnecting.current && connectFrom.current) {
        connectMouseWorld.current = {
          x: (mouse.current.x - pan.current.x) / zoom.current,
          y: (mouse.current.y - pan.current.y) / zoom.current,
        }
        const target = findNode(e.clientX, e.clientY)
        hoveredNode.current = target
        canvas!.style.cursor = target && target !== connectFrom.current ? 'crosshair' : 'crosshair'
        return
      }

      if (isDragging.current && dragNode.current) {
        // Mark that the user actually dragged so mouseup can distinguish click from drag.
        const dxFromDown = e.clientX - mouseDownPos.current.x
        const dyFromDown = e.clientY - mouseDownPos.current.y
        if (Math.abs(dxFromDown) > 3 || Math.abs(dyFromDown) > 3) didDrag.current = true
        dragNode.current.x = (mouse.current.x - pan.current.x) / zoom.current
        dragNode.current.y = (mouse.current.y - pan.current.y) / zoom.current
        dragNode.current.vx = 0
        dragNode.current.vy = 0
        return
      }

      if (isPanning.current) {
        pan.current.x += e.clientX - panStart.current.x
        pan.current.y += e.clientY - panStart.current.y
        panStart.current = { x: e.clientX, y: e.clientY }
        return
      }

      const node = findNode(e.clientX, e.clientY)
      hoveredNode.current = node
      canvas!.style.cursor = node ? 'pointer' : 'grab'

      if (node) {
        setTooltip({
          x: e.clientX - canvas!.getBoundingClientRect().left,
          y: e.clientY - canvas!.getBoundingClientRect().top,
          content: node.content,
          type: node.type,
        })
      } else {
        setTooltip(null)
      }
    }

    function onMouseDown(e: MouseEvent) {
      const node = findNode(e.clientX, e.clientY)

      // Shift+click on node = start connecting
      if (e.shiftKey && node) {
        isConnecting.current = true
        connectFrom.current = node
        connectMouseWorld.current = { x: node.x!, y: node.y! }
        canvas!.style.cursor = 'crosshair'
        return
      }

      if (node) {
        dragNode.current = node
        isDragging.current = true
        didDrag.current = false
        mouseDownPos.current = { x: e.clientX, y: e.clientY }
        canvas!.style.cursor = 'grabbing'
      } else {
        isPanning.current = true
        cameraTransitioning.current = false // User took control
        panStart.current = { x: e.clientX, y: e.clientY }
        canvas!.style.cursor = 'grabbing'
      }
    }

    function onMouseUp(e: MouseEvent) {
      // Finish connecting
      if (isConnecting.current && connectFrom.current) {
        const target = findNode(e.clientX, e.clientY)
        if (target && target !== connectFrom.current) {
          const fromN = connectFrom.current
          const toN = target
          setPendingConnection({ fromNode: fromN, toNode: toN })
          // Auto-detect relationship
          setConnDetecting(true)
          fetch('/api/detect-relationship', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from_content: fromN.content, to_content: toN.content }),
          })
            .then(r => r.json())
            .then(data => {
              setConnRelationship(data.relationship || 'supports')
              setConnStrength(data.strength ?? 0.8)
              setConnDetecting(false)
            })
            .catch(() => setConnDetecting(false))
        }
        isConnecting.current = false
        connectFrom.current = null
        canvas!.style.cursor = hoveredNode.current ? 'pointer' : 'grab'
        return
      }

      if (isDragging.current && dragNode.current) {
        // If user didn't drag past the threshold, treat as a click → traverse to that node
        // AND open the detail side panel so source/attachments are immediately visible.
        // A real drag just drops the node and does nothing else.
        if (!didDrag.current) {
          const node = dragNode.current
          if (pushFocusRef.current) pushFocusRef.current(node.id)
          if (onNodeClickRef.current) onNodeClickRef.current(node.id)
        }
      }
      dragNode.current = null
      isDragging.current = false
      didDrag.current = false
      isPanning.current = false
      canvas!.style.cursor = hoveredNode.current ? 'pointer' : 'grab'
    }

    // Double-click on a node opens the detail side panel (full info).
    function onDoubleClick(e: MouseEvent) {
      const node = findNode(e.clientX, e.clientY)
      if (node && onNodeClickRef.current) {
        onNodeClickRef.current(node.id)
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = canvas!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const oldZoom = zoom.current
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      zoom.current = Math.max(0.2, Math.min(5, zoom.current * delta))
      pan.current.x = mx - (mx - pan.current.x) * (zoom.current / oldZoom)
      pan.current.y = my - (my - pan.current.y) * (zoom.current / oldZoom)
      // User took control — stop any in-flight camera transition.
      cameraTransitioning.current = false
    }

    function onMouseLeave() {
      hoveredNode.current = null
      dragNode.current = null
      isDragging.current = false
      isPanning.current = false
      isConnecting.current = false
      connectFrom.current = null
      setTooltip(null)
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('dblclick', onDoubleClick)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mouseleave', onMouseLeave)

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('dblclick', onDoubleClick)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [router])

  // Cycle state — preview a child via arrow keys without leaving the current focus.
  const [cycledChildId, setCycledChildId] = useState<string | null>(null)
  const cycledChildIdRef = useRef(cycledChildId)
  cycledChildIdRef.current = cycledChildId
  // Reset preview whenever focus or filter changes (the cyclable list is now different).
  useEffect(() => { setCycledChildId(null) }, [focusedNodeId, filterMode])

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (cycledChildIdRef.current) { setCycledChildId(null); return }
        if (graphNav && focusStack.length > 0) {
          e.preventDefault()
          graphNav.popFocus()
        }
      }
      // Arrow keys cycle through visible children of the focused node — preview only,
      // no stack mutation. The right detail panel updates so the user can read source/info.
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!focusedNodeId) return
        // Cyclable list = children of focus that pass the current filter.
        const candidates = (adj.get(focusedNodeId) || []).filter(id => finalVisibleIds.has(id))
        if (candidates.length === 0) return
        e.preventDefault()
        const cur = cycledChildIdRef.current
        const idx = cur ? candidates.indexOf(cur) : -1
        const dir = e.key === 'ArrowRight' ? 1 : -1
        const nextIdx = idx === -1
          ? (dir > 0 ? 0 : candidates.length - 1)
          : (idx + dir + candidates.length) % candidates.length
        const nextId = candidates[nextIdx]
        setCycledChildId(nextId)
        // Open the detail panel for the previewed child.
        if (onNodeClickRef.current) onNodeClickRef.current(nextId)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [graphNav, focusStack, focusedNodeId, adj, finalVisibleIds])

  async function handleConnect() {
    if (!pendingConnection) return
    setConnSaving(true)
    await fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_node_id: pendingConnection.fromNode.id,
        to_node_id: pendingConnection.toNode.id,
        relationship: connRelationship,
        strength: connStrength,
      }),
    })
    setConnSaving(false)
    setPendingConnection(null)
    setConnRelationship('supports')
    setConnStrength(0.8)
    router.refresh()
  }

  if (nodes.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-neutral-600 text-sm">the field is empty</p>
        <p className="text-neutral-700 text-xs">drop fragments to see your thought-space form</p>
      </div>
    )
  }

  return (
    <div className={`relative ${fullscreen ? 'h-full' : 'flex-1'}`}>
      <canvas
        ref={canvasRef}
        className={`w-full cursor-grab ${fullscreen ? 'rounded-none border-0 h-full' : 'rounded-2xl border border-white/[0.04]'}`}
        style={{ backgroundColor: theme.graphBg, ...(fullscreen ? { height: '100%' } : { height: 'calc(100vh)' }) }}
      />

      {/* Back button + hint */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        {focusStack.length > 0 && graphNav && (
          <button
            onClick={() => graphNav.popFocus()}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-neutral-400 hover:text-white bg-white/[0.05] border border-white/[0.06] rounded-lg hover:bg-white/[0.08] transition-all"
          >
            ← back
          </button>
        )}
        <span className="text-[10px] text-neutral-700">
          {focusStack.length > 0 ? 'esc to go back · ← → to cycle · double-click for details' : 'click to explore · double-click for details · shift+drag to connect'}
        </span>
      </div>

      {/* Filter chip — collapsed by default; expands on hover with smooth max-width + opacity grow. */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 group">
        <div className="flex items-center bg-[#0a0a0a]/80 border border-white/[0.06] rounded-lg p-0.5 backdrop-blur-sm shadow-lg">
          <span className="px-2.5 py-1 text-[10px] text-neutral-500 select-none whitespace-nowrap">
            <span className="text-neutral-700">filter ·</span> <span className="text-white/70">{filterMode}</span>
          </span>
          <div
            className="
              flex items-center gap-1 overflow-hidden
              max-w-0 opacity-0 ml-0
              group-hover:max-w-[480px] group-hover:opacity-100 group-hover:ml-1 group-hover:pl-1 group-hover:border-l group-hover:border-white/[0.06]
              transition-[max-width,opacity,margin,padding] duration-300 ease-out
            "
          >
            {(['all', 'concepts', 'sources', 'evidence'] as const).map(m => {
              const disabled = m === 'evidence' && !focusedNodeId
              if (m === filterMode) return null
              return (
                <button
                  key={m}
                  onClick={() => !disabled && setFilterMode(m)}
                  disabled={disabled}
                  title={m === 'evidence' ? 'Show every node that transitively supports the focused claim' : undefined}
                  className={`shrink-0 px-2.5 py-1 text-[10px] rounded transition-colors whitespace-nowrap ${
                    disabled
                      ? 'text-neutral-800 cursor-not-allowed'
                      : 'text-neutral-500 hover:text-white/80 hover:bg-white/[0.05]'
                  }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Search bar */}
      <GraphSearchBar nodes={nodes} nodeRadii={nodeRadii} typeColors={TYPE_COLORS_THEMED} onSelect={(id) => {
        // Reset filter so the searched node is guaranteed visible (a type filter could hide it).
        setFilterMode('all')
        // Pan camera to the selected node *now* so the user immediately sees where they navigated.
        // Without this the focus updates but the camera lerp can land far from the chosen node.
        const target = graphNodes.current.find(n => n.id === id)
        const canvas = canvasRef.current
        if (target && target.x !== undefined && target.y !== undefined && canvas) {
          targetZoom.current = 1.4
          targetPan.current = {
            x: canvas.offsetWidth / 2 - target.x * targetZoom.current,
            y: canvas.offsetHeight / 2 - target.y * targetZoom.current,
          }
          cameraTransitioning.current = true
        }
        if (pushFocusRef.current) pushFocusRef.current(id)
        if (onNodeClickRef.current) onNodeClickRef.current(id)
      }} />

      {/* Fullscreen toggle */}
      {!fullscreen && (
        <a
          href="/graph"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-600 hover:text-white bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all"
          title="Open full view"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
          </svg>
        </a>
      )}

      {/* Tooltip */}
      {tooltip && !pendingConnection && (
        <div
          className="absolute pointer-events-none bg-neutral-900/95 border border-white/[0.08] rounded-xl px-3 py-2 max-w-[280px] backdrop-blur-sm animate-fade-up"
          style={{
            left: Math.min(tooltip.x + 12, (canvasRef.current?.offsetWidth || 400) - 300),
            top: tooltip.y - 10,
          }}
        >
          <p className="text-white/80 text-[12px] leading-relaxed">{tooltip.content}</p>
          <span className="text-[10px] text-neutral-500 mt-1 inline-block">{tooltip.type}</span>
        </div>
      )}

      {/* Inline connection panel — appears over graph */}
      {pendingConnection && (
        <div className="absolute top-3 right-3 w-56 bg-[#0a0a0a]/95 border border-white/[0.08] rounded-xl p-3 space-y-2 backdrop-blur-sm shadow-2xl z-10">
          <p className="text-[11px] text-white/60 leading-snug truncate">
            <span className="text-purple-400">
              {pendingConnection.fromNode.content.slice(0, 30)}...
            </span>
          </p>
          <p className="text-[10px] text-neutral-600 text-center">connects to</p>
          <p className="text-[11px] text-white/60 leading-snug truncate">
            <span className="text-purple-400">
              {pendingConnection.toNode.content.slice(0, 30)}...
            </span>
          </p>

          {connDetecting ? (
            <p className="text-[10px] text-purple-400/60 animate-pulse text-center py-1">detecting relationship...</p>
          ) : (
            <>
              <select
                value={connRelationship}
                onChange={(e) => setConnRelationship(e.target.value)}
                className="w-full px-2 py-1 bg-[#111] border border-white/[0.08] rounded text-white/80 text-[11px] focus:outline-none [&>option]:bg-[#111]"
              >
                {REL_TYPES.map((r) => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-600 shrink-0">{connStrength.toFixed(1)}</span>
                <input
                  type="range" min="0.1" max="1.0" step="0.1"
                  value={connStrength}
                  onChange={(e) => setConnStrength(parseFloat(e.target.value))}
                  className="flex-1 accent-purple-400"
                />
              </div>
            </>
          )}

          <div className="flex gap-1.5">
            <button
              onClick={() => { setPendingConnection(null); setConnRelationship('supports'); setConnStrength(0.8) }}
              className="flex-1 px-2 py-1 text-[10px] text-neutral-500 hover:text-white transition-colors"
            >
              cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={connSaving || connDetecting}
              className="flex-1 px-2 py-1 text-[10px] text-white/70 bg-purple-500/20 border border-purple-500/30 rounded hover:bg-purple-500/30 transition-all disabled:opacity-40"
            >
              {connSaving ? '...' : 'connect'}
            </button>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex gap-1">
        <button
          onClick={() => { zoom.current = Math.min(5, zoom.current * 1.3) }}
          className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-white bg-white/[0.04] border border-white/[0.06] rounded-lg text-[14px] transition-colors"
        >+</button>
        <button
          onClick={() => { zoom.current = Math.max(0.2, zoom.current * 0.7) }}
          className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-white bg-white/[0.04] border border-white/[0.06] rounded-lg text-[14px] transition-colors"
        >−</button>
        <button
          onClick={() => { zoom.current = 1; pan.current = { x: 0, y: 0 } }}
          className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-white bg-white/[0.04] border border-white/[0.06] rounded-lg text-[10px] transition-colors"
        >fit</button>
      </div>

      {/* Legend */}
      <GraphLegend />
    </div>
  )
}

// === Graph Search Bar ===
function GraphSearchBar({ nodes, nodeRadii, onSelect, typeColors: TYPE_COLORS_THEMED }: {
  nodes: GraphNode[]
  nodeRadii: Map<string, number>
  typeColors: Record<string, string>
  onSelect: (nodeId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const types = ['concept', 'idea', 'question', 'source', 'synthesis'] as const

  const results = useMemo(() => {
    if (!query && !typeFilter) return []
    return nodes
      .filter(n => {
        if (typeFilter && n.type !== typeFilter) return false
        if (query) {
          const q = query.toLowerCase()
          return n.content.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => (nodeRadii.get(b.id) || 0) - (nodeRadii.get(a.id) || 0))
      .slice(0, 12)
  }, [nodes, query, typeFilter, nodeRadii])

  // Reset selection when results change
  useEffect(() => { setSelectedIdx(0) }, [results.length, query, typeFilter])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault()
      onSelect(results[selectedIdx].id)
      setOpen(false); setQuery(''); setTypeFilter(null)
    }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); setTypeFilter(null) }
  }

  function selectResult(id: string) {
    onSelect(id)
    setOpen(false); setQuery(''); setTypeFilter(null)
  }

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 text-[11px] text-neutral-600 hover:text-neutral-400 bg-white/[0.04] border border-white/[0.06] rounded-lg backdrop-blur-sm transition-colors z-10"
        title="Search (⌘K)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="5" cy="5" r="3.5" /><path d="M7.5 7.5L10.5 10.5" />
        </svg>
        <span>search</span>
        <span className="text-[9px] text-neutral-700 ml-1">⌘K</span>
      </button>
    )
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-80 z-20">
      <div className="bg-[#0a0a0a]/95 border border-white/[0.1] rounded-xl backdrop-blur-sm shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-neutral-500 shrink-0">
            <circle cx="5" cy="5" r="3.5" /><path d="M7.5 7.5L10.5 10.5" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="search nodes..."
            className="flex-1 bg-transparent text-[12px] text-white/80 placeholder-neutral-600 focus:outline-none"
          />
          <button onClick={() => { setOpen(false); setQuery(''); setTypeFilter(null) }}
            className="text-neutral-600 hover:text-neutral-400">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l6 6M7 1l-6 6" /></svg>
          </button>
        </div>

        {/* Type filters */}
        <div className="flex gap-1 px-3 py-1.5 border-b border-white/[0.04]">
          <button
            onClick={() => setTypeFilter(null)}
            className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${!typeFilter ? 'text-white/70 bg-white/[0.08]' : 'text-neutral-600 hover:text-neutral-400'}`}
          >all</button>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${typeFilter === t ? 'bg-white/[0.08]' : 'hover:text-neutral-400'}`}
              style={{ color: typeFilter === t ? TYPE_COLORS[t] : undefined }}>
              {t}
            </button>
          ))}
        </div>

        {/* Results */}
        {(query || typeFilter) && (
          <div className="max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-neutral-600 text-center">no matches</p>
            ) : (
              results.map((node, i) => {
                const rank = nodeRadii.get(node.id) || 3
                return (
                  <button key={node.id} onClick={() => selectResult(node.id)}
                    onMouseEnter={() => setSelectedIdx(i)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 transition-colors ${i === selectedIdx ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS_THEMED[node.type] || TYPE_COLORS.raw }} />
                    <span className="text-[11px] text-white/70 truncate flex-1 min-w-0">{node.content}</span>
                    <span className="text-[9px] text-neutral-700 shrink-0" style={{ color: TYPE_COLORS_THEMED[node.type] }}>{node.type}</span>
                    <span className="text-[9px] text-neutral-700 shrink-0 w-4 text-right">{rank.toFixed(0)}</span>
                  </button>
                )
              })
            )}
          </div>
        )}

        {/* Empty state — show top nodes when no query */}
        {!query && !typeFilter && (
          <div className="px-3 py-3 text-center">
            <p className="text-[10px] text-neutral-600">type to search or pick a type filter</p>
          </div>
        )}
      </div>
    </div>
  )
}

function GraphLegend() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const toggle = (key: string) => setExpanded(expanded === key ? null : key)

  const nodeTypes = [
    { type: 'concept', color: TYPE_COLORS.concept, desc: 'Core truth claims — ideas that evidence flows toward' },
    { type: 'idea', color: TYPE_COLORS.idea, desc: 'Extracted insights from your sources' },
    { type: 'question', color: TYPE_COLORS.question, desc: 'Open questions worth exploring further' },
    { type: 'source', color: TYPE_COLORS.source, desc: 'Original source material — articles, papers, videos' },
    { type: 'synthesis', color: TYPE_COLORS.synthesis, desc: 'Connections synthesized across multiple ideas' },
  ]
  const edgeTypes = [
    { rel: 'supports', color: REL_COLORS.supports, desc: 'Evidence that strengthens the target idea', dashed: false },
    { rel: 'contradicts', color: REL_COLORS.contradicts, desc: 'Conflicting evidence — dashed vibrating line', dashed: true },
    { rel: 'refines', color: REL_COLORS.refines, desc: 'Adds nuance or precision to an idea', dashed: false },
    { rel: 'causes', color: REL_COLORS.causes, desc: 'Causal or mechanistic relationship', dashed: false },
    { rel: 'example of', color: REL_COLORS.example_of, desc: 'A concrete instance of a broader concept', dashed: false },
    { rel: 'similar', color: REL_COLORS.similar, desc: 'Related without directional relationship', dashed: false },
  ]
  const visualCues = [
    { label: 'Node size', desc: 'Larger = higher EvidenceRank (more support)' },
    { label: 'Edge thickness', desc: 'Thicker = stronger relationship (0\u20131)' },
    { label: 'Glow', desc: 'Recently added nodes glow, fading over days' },
    { label: '+N badge', desc: 'Hidden children \u2014 click to expand' },
    { label: 'Cluster glow', desc: 'Purple halo groups nodes from same source' },
  ]

  return (
    <div className="absolute bottom-3 left-3 z-10">
      {!open ? (
        <button onClick={() => setOpen(true)} title="Legend"
          className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-neutral-400 bg-white/[0.04] border border-white/[0.06] rounded-lg transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="7" cy="7" r="5.5" /><path d="M7 6.5V10M7 4.5v0" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        <div className="w-52 bg-[#0a0a0a]/95 border border-white/[0.08] rounded-xl backdrop-blur-sm shadow-2xl overflow-hidden">
          <button onClick={() => setOpen(false)}
            className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-neutral-400 hover:text-white/70">
            <span>legend</span>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l6 6M7 1l-6 6" /></svg>
          </button>
          <div className="max-h-[60vh] overflow-y-auto">
            <LegendSection title="nodes" isOpen={expanded === 'nodes'} onToggle={() => toggle('nodes')}>
              {nodeTypes.map(n => (
                <div key={n.type} className="flex items-start gap-2 px-3 py-1">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-[3px]" style={{ backgroundColor: n.color }} />
                  <div className="min-w-0">
                    <span className="text-[10px] text-white/60">{n.type}</span>
                    {expanded === 'nodes' && <p className="text-[9px] text-neutral-600 leading-snug mt-0.5">{n.desc}</p>}
                  </div>
                </div>
              ))}
            </LegendSection>
            <LegendSection title="edges" isOpen={expanded === 'edges'} onToggle={() => toggle('edges')}>
              {edgeTypes.map(e => (
                <div key={e.rel} className="flex items-start gap-2 px-3 py-1">
                  <svg width="14" height="6" viewBox="0 0 14 6" className="shrink-0 mt-[3px]">
                    <line x1="0" y1="3" x2="14" y2="3" stroke={e.color} strokeWidth="1.5" strokeDasharray={e.dashed ? '2 2' : undefined} />
                  </svg>
                  <div className="min-w-0">
                    <span className="text-[10px] text-white/60">{e.rel}</span>
                    {expanded === 'edges' && <p className="text-[9px] text-neutral-600 leading-snug mt-0.5">{e.desc}</p>}
                  </div>
                </div>
              ))}
            </LegendSection>
            <LegendSection title="visual cues" isOpen={expanded === 'cues'} onToggle={() => toggle('cues')}>
              {visualCues.map(c => (
                <div key={c.label} className="px-3 py-1">
                  <span className="text-[10px] text-white/60">{c.label}</span>
                  {expanded === 'cues' && <p className="text-[9px] text-neutral-600 leading-snug mt-0.5">{c.desc}</p>}
                </div>
              ))}
            </LegendSection>
          </div>
          <div className="px-3 py-2 border-t border-white/[0.04] text-[9px] text-neutral-700 space-y-0.5">
            <p>scroll to zoom · drag to pan</p>
            <p>shift+drag between nodes to connect</p>
            <p>click node to expand & inspect</p>
          </div>
        </div>
      )}
    </div>
  )
}

function LegendSection({ title, isOpen, onToggle, children }: {
  title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border-t border-white/[0.04]">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.03] transition-colors">
        <span className="text-[10px] text-neutral-500">{title}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
          className={`text-neutral-700 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
          <path d="M2 1l4 3-4 3z" />
        </svg>
      </button>
      <div className="pb-1.5">{children}</div>
    </div>
  )
}
