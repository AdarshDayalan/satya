'use client'

import { useRef, useEffect, useCallback } from 'react'

interface GraphNode {
  id: string
  content: string
  type: string
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface GraphEdge {
  from_node_id: string
  to_node_id: string
  relationship: string
  strength: number
}

const TYPE_COLORS: Record<string, string> = {
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
  related: '#737373',
}

export default function KnowledgeGraph({
  nodes,
  edges,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const graphNodes = useRef<GraphNode[]>([])
  const time = useRef(0)

  const init = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * 2
    canvas.height = h * 2

    // Initialize positions in a circle
    graphNodes.current = nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      const r = Math.min(w, h) * 0.3
      return {
        ...n,
        x: w / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
        y: h / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      }
    })
  }, [nodes])

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

      // Clear with fade trail
      ctx.fillStyle = 'rgba(5, 5, 5, 0.15)'
      ctx.fillRect(0, 0, w, h)

      const gn = graphNodes.current
      const nodeMap = new Map(gn.map((n) => [n.id, n]))

      // Simple force simulation
      for (let i = 0; i < gn.length; i++) {
        const a = gn[i]
        // Center gravity
        a.vx! += (w / 2 - a.x!) * 0.0005
        a.vy! += (h / 2 - a.y!) * 0.0005

        // Repulsion
        for (let j = i + 1; j < gn.length; j++) {
          const b = gn[j]
          const dx = a.x! - b.x!
          const dy = a.y! - b.y!
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 800 / (dist * dist)
          a.vx! += (dx / dist) * force
          a.vy! += (dy / dist) * force
          b.vx! -= (dx / dist) * force
          b.vy! -= (dy / dist) * force
        }
      }

      // Edge attraction
      for (const edge of edges) {
        const a = nodeMap.get(edge.from_node_id)
        const b = nodeMap.get(edge.to_node_id)
        if (!a || !b) continue
        const dx = b.x! - a.x!
        const dy = b.y! - a.y!
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - 100) * 0.002 * edge.strength
        a.vx! += (dx / dist) * force
        a.vy! += (dy / dist) * force
        b.vx! -= (dx / dist) * force
        b.vy! -= (dy / dist) * force
      }

      // Apply velocities with damping
      for (const n of gn) {
        n.vx! *= 0.92
        n.vy! *= 0.92
        n.x! += n.vx!
        n.y! += n.vy!
        // Keep in bounds
        n.x! = Math.max(30, Math.min(w - 30, n.x!))
        n.y! = Math.max(30, Math.min(h - 30, n.y!))
      }

      // Draw edges with pulse
      for (const edge of edges) {
        const a = nodeMap.get(edge.from_node_id)
        const b = nodeMap.get(edge.to_node_id)
        if (!a || !b) continue

        const color = REL_COLORS[edge.relationship] || REL_COLORS.related
        const pulse = 0.15 + Math.sin(time.current * 2 + edge.strength * 10) * 0.1

        ctx.beginPath()
        ctx.moveTo(a.x!, a.y!)
        ctx.lineTo(b.x!, b.y!)
        ctx.strokeStyle = color
        ctx.globalAlpha = pulse * edge.strength
        ctx.lineWidth = 1 + edge.strength
        ctx.stroke()

        // Traveling particle along edge
        const t = (time.current * 0.5 + edge.strength) % 1
        const px = a.x! + (b.x! - a.x!) * t
        const py = a.y! + (b.y! - a.y!) * t
        ctx.beginPath()
        ctx.arc(px, py, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = 0.6
        ctx.fill()
      }

      // Draw nodes
      ctx.globalAlpha = 1
      for (const n of gn) {
        const color = TYPE_COLORS[n.type] || TYPE_COLORS.raw
        const glow = 6 + Math.sin(time.current * 1.5 + n.x! * 0.01) * 3

        // Glow
        const grad = ctx.createRadialGradient(n.x!, n.y!, 0, n.x!, n.y!, glow * 3)
        grad.addColorStop(0, color + '30')
        grad.addColorStop(1, color + '00')
        ctx.beginPath()
        ctx.arc(n.x!, n.y!, glow * 3, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(n.x!, n.y!, 4, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = 0.9
        ctx.fill()

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.font = '9px system-ui'
        ctx.textAlign = 'center'
        ctx.globalAlpha = 0.5
        const label = n.content.length > 25 ? n.content.slice(0, 25) + '…' : n.content
        ctx.fillText(label, n.x!, n.y! + 14)
        ctx.globalAlpha = 1
      }

      ctx.restore()
      animRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => cancelAnimationFrame(animRef.current)
  }, [init, edges])

  if (nodes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-600 text-sm">no connections to visualize yet</p>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-2xl border border-white/[0.04] bg-[#050505]"
      style={{ height: '400px' }}
    />
  )
}
