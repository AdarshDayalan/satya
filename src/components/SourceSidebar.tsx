'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import EditModal from './EditModal'
import ConfirmDialog from './ConfirmDialog'

interface Input {
  id: string
  raw_content: string
  source_type: string
  source_metadata: Record<string, unknown>
  status: string
  created_at: string
}

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  journal: { label: 'Journal', color: 'text-white/50' },
  youtube: { label: 'YouTube', color: 'text-red-400' },
  instagram: { label: 'Instagram', color: 'text-pink-400' },
  article: { label: 'Article', color: 'text-blue-400' },
  research_paper: { label: 'Paper', color: 'text-green-400' },
  reddit: { label: 'Reddit', color: 'text-orange-400' },
  pubmed: { label: 'PubMed', color: 'text-cyan-400' },
}

export default function SourceSidebar({ inputs }: { inputs: Input[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<string | null>(null)
  const [editingInput, setEditingInput] = useState<Input | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sourceTypes = [...new Set(inputs.map((i) => i.source_type || 'journal'))]
  const filtered = filter ? inputs.filter((i) => (i.source_type || 'journal') === filter) : inputs

  async function handleEdit(content: string) {
    if (!editingInput) return
    await fetch(`/api/inputs/${editingInput.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_content: content }),
    })
    setEditingInput(null)
    router.refresh()
  }

  async function handleDelete() {
    if (!deletingId) return
    await fetch(`/api/inputs/${deletingId}`, { method: 'DELETE' })
    setDeletingId(null)
    router.refresh()
  }

  return (
    <aside className="w-64 shrink-0 border-r border-white/[0.04] bg-white/[0.01] overflow-y-auto">
      <div className="p-4 space-y-4">
        <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest">
          Sources
        </h2>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter(null)}
            className={`px-2.5 py-1 text-[11px] rounded-full border transition-all ${
              filter === null
                ? 'border-white/20 text-white/80 bg-white/[0.06]'
                : 'border-white/[0.04] text-neutral-600 hover:text-neutral-400'
            }`}
          >
            all
          </button>
          {sourceTypes.map((type) => {
            const config = SOURCE_CONFIG[type] || SOURCE_CONFIG.journal
            return (
              <button
                key={type}
                onClick={() => setFilter(filter === type ? null : type)}
                className={`px-2.5 py-1 text-[11px] rounded-full border transition-all ${
                  filter === type
                    ? `border-white/20 ${config.color} bg-white/[0.06]`
                    : 'border-white/[0.04] text-neutral-600 hover:text-neutral-400'
                }`}
              >
                {config.label}
              </button>
            )
          })}
        </div>

        {/* Input list */}
        <div className="space-y-1">
          {filtered.map((input) => {
            const config = SOURCE_CONFIG[input.source_type || 'journal'] || SOURCE_CONFIG.journal
            const title =
              (input.source_metadata?.title as string) ||
              input.raw_content.slice(0, 60) + (input.raw_content.length > 60 ? '…' : '')

            return (
              <div key={input.id} className="group relative">
                <Link
                  href={`/inputs/${input.id}`}
                  className="block px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <p className="text-[13px] text-white/70 line-clamp-2 leading-snug group-hover:text-white/90 transition-colors pr-10">
                    {title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] ${config.color}`}>{config.label}</span>
                    <span className="text-neutral-800">·</span>
                    <span className="text-[10px] text-neutral-700">
                      {new Date(input.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
                {/* Edit/Delete buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingInput(input) }}
                    className="p-1 rounded text-neutral-600 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                    title="Edit"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M7 2l3 3-7 7H0v-3z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingId(input.id) }}
                    className="p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    title="Delete"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 2l8 8M10 2l-8 8" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-neutral-700 text-[12px] px-3 py-4">no sources yet</p>
          )}
        </div>
      </div>

      <EditModal
        isOpen={!!editingInput}
        onClose={() => setEditingInput(null)}
        onSave={handleEdit}
        title="Edit source"
        initialValue={editingInput?.raw_content || ''}
      />

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete source"
        message="This will permanently delete this source and all nodes extracted from it."
      />
    </aside>
  )
}
