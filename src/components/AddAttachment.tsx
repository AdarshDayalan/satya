'use client'

import { useState } from 'react'

interface AddAttachmentProps {
  nodeId: string
  onAdded: () => void
}

export default function AddAttachment({ nodeId, onAdded }: AddAttachmentProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!url.trim()) return
    setSaving(true)
    await fetch('/api/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: nodeId, url: url.trim() }),
    })
    setUrl('')
    setSaving(false)
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-neutral-500 hover:text-white/70"
      >
        + attach
      </button>
    )
  }

  return (
    <div className="flex gap-1.5 items-center">
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') { setOpen(false); setUrl('') }
        }}
        placeholder="paste link or image URL..."
        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[11px] text-white/80 placeholder-neutral-600 focus:outline-none focus:border-white/[0.15] min-w-0"
      />
      <button
        onClick={handleAdd}
        disabled={saving || !url.trim()}
        className="text-[11px] text-white/60 hover:text-white/80 px-2 py-1 bg-white/[0.06] rounded disabled:opacity-30"
      >
        {saving ? '...' : 'add'}
      </button>
      <button
        onClick={() => { setOpen(false); setUrl('') }}
        className="text-[11px] text-neutral-600 hover:text-neutral-400"
      >
        ✕
      </button>
    </div>
  )
}
