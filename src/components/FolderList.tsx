'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import EditModal from './EditModal'

interface Folder {
  id: string
  name: string
  description: string | null
  confidence: number
  created_at: string
}

export default function FolderList({ folders }: { folders: Folder[] }) {
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  async function handleCreate(name: string) {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 mb-3">
        <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest">
          {folders.length > 0 ? 'Themes' : ''}
        </h2>
        <button
          onClick={() => setCreating(true)}
          className="text-[11px] text-neutral-600 hover:text-neutral-300 transition-colors"
        >
          + new theme
        </button>
      </div>
      {folders.length > 0 && (
        <div className="space-y-1.5 stagger-children">
          {folders.map((folder) => (
            <Link
              key={folder.id}
              href={`/folders/${folder.id}`}
              className="theme-card block border border-white/[0.04] rounded-xl px-4 py-3"
            >
              <p className="text-white/80 text-[14px] font-medium">{folder.name}</p>
              {folder.description && (
                <p className="text-neutral-600 text-[12px] mt-1 line-clamp-2 leading-relaxed">
                  {folder.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      <EditModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onSave={handleCreate}
        title="Create theme"
        initialValue=""
        placeholder="Name your theme..."
      />
    </div>
  )
}
