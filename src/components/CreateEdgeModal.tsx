'use client'

import { useState } from 'react'
import Portal from './Portal'

const RELATIONSHIP_TYPES = ['supports', 'contradicts', 'refines', 'example_of', 'causes', 'similar']

interface Node {
  id: string
  content: string
  type: string
}

export default function CreateEdgeModal({
  open,
  onClose,
  onCreated,
  nodes,
  fromNodeId,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  nodes: Node[]
  fromNodeId?: string
}) {
  const [from, setFrom] = useState(fromNodeId || '')
  const [to, setTo] = useState('')
  const [relationship, setRelationship] = useState('supports')
  const [strength, setStrength] = useState(0.8)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!from || !to || from === to) return
    setSaving(true)
    const res = await fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_node_id: from, to_node_id: to, relationship, strength, reason }),
    })
    setSaving(false)
    if (res.ok) {
      setTo('')
      setReason('')
      onCreated()
      onClose()
    }
  }

  if (!open) return null

  return (
    <Portal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[101] bg-[#0a0a0a] border border-white/[0.08] rounded-2xl w-full max-w-md mx-4 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/80">Connect Nodes</h2>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 text-xs">close</button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-widest">From</label>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#111] border border-white/[0.08] rounded-lg text-white/80 text-[12px] focus:outline-none [&>option]:bg-[#111]"
            >
              <option value="">select node...</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.content.slice(0, 60)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-widest">Relationship</label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#111] border border-white/[0.08] rounded-lg text-white/80 text-[12px] focus:outline-none [&>option]:bg-[#111]"
            >
              {RELATIONSHIP_TYPES.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-widest">To</label>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#111] border border-white/[0.08] rounded-lg text-white/80 text-[12px] focus:outline-none [&>option]:bg-[#111]"
            >
              <option value="">select node...</option>
              {nodes.filter((n) => n.id !== from).map((n) => (
                <option key={n.id} value={n.id}>{n.content.slice(0, 60)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-widest">Strength ({strength.toFixed(1)})</label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="w-full accent-purple-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-widest">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are these connected?"
              className="w-full px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/80 text-[12px] focus:outline-none focus:border-white/[0.15] placeholder-neutral-600"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors">cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving || !from || !to || from === to}
            className="px-4 py-1.5 text-xs font-medium text-white/70 bg-white/[0.08] rounded-lg hover:bg-white/[0.12] border border-white/[0.08] transition-all disabled:opacity-40"
          >
            {saving ? 'connecting...' : 'connect'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
