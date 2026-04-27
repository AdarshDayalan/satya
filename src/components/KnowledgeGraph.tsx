'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { computeEvidenceRank, weightToRadius } from '@/lib/evidence-rank'
import { useRouter } from 'next/navigation'

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const graphNodes = useRef<GraphNode[]>([])
  const time = useRef(0)
  const router = useRouter()

  // Keep onNodeClick in a ref so the event listener closure always has the latest
  const onNodeClickRef = useRef(onNodeClick)
  onNodeClickRef.current = onNodeClick

  // Interaction state
  const hoveredNode = useRef<GraphNode | null>(null)
  const dragNode = useRef<GraphNode | null>(null)
  const isDragging = useRef(false)
  const mouse = useRef({ x: 0, y: 0 })
  const pan = useRef({ x: 0, y: 0 })
  const zoom = useRef(1)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string; type: string } | null>(null)

  // Connecting state — shift+drag from node to node
  const isConnecting = useRef(false)
  const connectFrom = useRef<GraphNode | null>(null)
  const connectMouseWorld = useRef({ x: 0, y: 0 })
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null)
  const [connRelationship, setConnRelationship] = useState('supports')
  const [connStrength, setConnStrength] = useState(0.8)
  const [connSaving, setConnSaving] = useState(false)
  const [connDetecting, setConnDetecting] = useState(false)

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

  // Compute EvidenceRank — recursive importance based on evidence flow
  const nodeRadii = useMemo(() => {
    const ranks = computeEvidenceRank(nodes, edges, 4, 0.15)
    return weightToRadius(ranks, 3, 22)
  }, [nodes, edges])

  const init = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * 2
    canvas.height = h * 2

    graphNodes.current = nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      const r = Math.min(w, h) * 0.3
      return {
        ...n,
        x: w / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 60,
        y: h / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 60,
        vx: 0,
        vy: 0,
        connections: 0,
        radius: nodeRadii.get(n.id) || 4,
      }
    })
  }, [nodes, nodeRadii])

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

  useEffect(() => {
    init()
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
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, w, h)

      ctx.save()
      ctx.translate(pan.current.x, pan.current.y)
      ctx.scale(zoom.current, zoom.current)

      const gn = graphNodes.current
      const nodeMap = new Map(gn.map(n => [n.id, n]))
      const hovered = hoveredNode.current
      const dragging = dragNode.current

      // Physics
      for (let i = 0; i < gn.length; i++) {
        const a = gn[i]
        if (a === dragging) continue
        a.vx! += (w / 2 / zoom.current - pan.current.x / zoom.current - a.x!) * 0.0003
        a.vy! += (h / 2 / zoom.current - pan.current.y / zoom.current - a.y!) * 0.0003
        for (let j = i + 1; j < gn.length; j++) {
          const b = gn[j]
          if (b === dragging) continue
          const dx = a.x! - b.x!
          const dy = a.y! - b.y!
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 1000 / (dist * dist)
          a.vx! += (dx / dist) * force
          a.vy! += (dy / dist) * force
          b.vx! -= (dx / dist) * force
          b.vy! -= (dy / dist) * force
        }
      }

      for (const edge of edges) {
        const a = nodeMap.get(edge.from_node_id)
        const b = nodeMap.get(edge.to_node_id)
        if (!a || !b || a === dragging || b === dragging) continue
        const dx = b.x! - a.x!
        const dy = b.y! - a.y!
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const idealDist = edge.relationship === 'contradicts' ? 180 : 90
        const force = (dist - idealDist) * 0.003 * edge.strength
        a.vx! += (dx / dist) * force
        a.vy! += (dy / dist) * force
        b.vx! -= (dx / dist) * force
        b.vy! -= (dy / dist) * force
      }

      for (const n of gn) {
        if (n === dragging) continue
        n.vx! *= 0.9
        n.vy! *= 0.9
        n.x! += n.vx!
        n.y! += n.vy!
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
      for (const edge of edges) {
        const a = nodeMap.get(edge.from_node_id)
        const b = nodeMap.get(edge.to_node_id)
        if (!a || !b) continue
        const color = REL_COLORS[edge.relationship] || REL_COLORS.related
        const isContradiction = edge.relationship === 'contradicts'
        const isHighlighted = hovered && (hovered.id === edge.from_node_id || hovered.id === edge.to_node_id)
        const baseAlpha = isHighlighted ? 0.6 : 0.08 + edge.strength * 0.25
        const pulse = Math.sin(time.current * 2 + edge.strength * 10) * 0.05
        ctx.globalAlpha = baseAlpha + pulse
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
        if (!isContradiction) {
          const t = (time.current * 0.4 + edge.strength) % 1
          const px = a.x! + (b.x! - a.x!) * t
          const py = a.y! + (b.y! - a.y!) * t
          ctx.beginPath()
          ctx.arc(px, py, 1.2, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.globalAlpha = isHighlighted ? 0.8 : 0.3
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
        const color = TYPE_COLORS[n.type] || TYPE_COLORS.raw
        const r = n.radius || 4
        const isHovered = hovered === n
        const isConnectSource = connectFrom.current === n

        const age = (Date.now() - new Date(n.created_at).getTime()) / (1000 * 60 * 60 * 24)
        const recencyAlpha = Math.max(0.02, 0.15 - age * 0.003)

        if (isHovered || isConnectSource || recencyAlpha > 0.03) {
          const glowR = (isHovered || isConnectSource) ? r * 4 : r * 2.5
          const grad = ctx.createRadialGradient(n.x!, n.y!, r * 0.5, n.x!, n.y!, glowR)
          grad.addColorStop(0, color + ((isHovered || isConnectSource) ? '40' : Math.round(recencyAlpha * 255).toString(16).padStart(2, '0')))
          grad.addColorStop(1, color + '00')
          ctx.beginPath()
          ctx.arc(n.x!, n.y!, glowR, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = isHovered ? 1 : 0.85
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

        // Label — scale font with zoom, hide at low zoom to avoid clutter
        const effectiveZoom = zoom.current
        if (isHovered || effectiveZoom > 0.5) {
          ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'
          const fontSize = isHovered ? 11 : Math.max(7, 9 / Math.max(effectiveZoom, 0.6))
          ctx.font = `${fontSize}px system-ui`
          ctx.textAlign = 'center'
          ctx.globalAlpha = isHovered ? 1 : Math.min(0.6, effectiveZoom * 0.6)
          const maxLen = isHovered ? 40 : 18
          const label = n.content.length > maxLen ? n.content.slice(0, maxLen) + '…' : n.content
          ctx.fillText(label, n.x!, n.y! + r + 12)
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
  }, [init, edges, getClusterCenters])

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
        canvas!.style.cursor = 'grabbing'
      } else {
        isPanning.current = true
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
        const node = findNode(e.clientX, e.clientY)
        if (node && node === dragNode.current) {
          const dx = Math.abs((mouse.current.x - pan.current.x) / zoom.current - node.x!)
          const dy = Math.abs((mouse.current.y - pan.current.y) / zoom.current - node.y!)
          if (dx < 2 && dy < 2) {
            if (onNodeClickRef.current) {
              onNodeClickRef.current(node.id)
            } else {
              router.push(`/nodes/${node.id}`)
            }
          }
        }
      }
      dragNode.current = null
      isDragging.current = false
      isPanning.current = false
      canvas!.style.cursor = hoveredNode.current ? 'pointer' : 'grab'
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
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mouseleave', onMouseLeave)

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [router])

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
        className={`w-full bg-[#050505] cursor-grab ${fullscreen ? 'rounded-none border-0 h-full' : 'rounded-2xl border border-white/[0.04]'}`}
        style={fullscreen ? { height: '100%' } : { height: 'calc(100vh)' }}
      />

      {/* Hint */}
      <div className="absolute top-3 left-3 text-[10px] text-neutral-700">
        shift + drag to connect
      </div>

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
    </div>
  )
}
