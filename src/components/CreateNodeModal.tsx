'use client'

import { useState } from 'react'
import Portal from './Portal'

const NODE_TYPES = ['concept', 'idea', 'question']

export default function CreateNodeModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [content, setContent] = useState('')
  const [type, setType] = useState('idea')
  const [weight, setWeight] = useState(1.0)
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!content.trim()) return
    // Close immediately — optimistic
    const payload = { content, type, weight }
    setContent('')
    setType('idea')
    setWeight(1.0)
    onCreated()
    onClose()
    // Fire to server in background
    fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[101] bg-[#0a0a0a] border border-white/[0.08] rounded-2xl w-full max-w-md mx-4 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/80">Create Node</h2>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 text-xs">close</button>
        </div>

        <div className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's the idea, concept, or question?"
            rows={3}
            autoFocus
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/80 text-sm focus:outline-none focus:border-white/[0.15] placeholder-neutral-600 resize-none"
          />

          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-neutral-500 uppercase tracking-widest">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#111] border border-white/[0.08] rounded-lg text-white/80 text-[12px] focus:outline-none [&>option]:bg-[#111]"
              >
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-neutral-500 uppercase tracking-widest">Weight ({weight.toFixed(1)})</label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value))}
                className="w-full accent-purple-400"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors">cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving || !content.trim()}
            className="px-4 py-1.5 text-xs font-medium text-white/70 bg-white/[0.08] rounded-lg hover:bg-white/[0.12] border border-white/[0.08] transition-all disabled:opacity-40"
          >
            {saving ? 'creating...' : 'create'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
