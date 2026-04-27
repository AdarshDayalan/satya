'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ActionMenu from './ActionMenu'
import ConfirmDialog from './ConfirmDialog'

interface InputActionsProps {
  inputId: string
  status: string
}

export default function InputActions({ inputId, status }: InputActionsProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)

  async function handleReprocess() {
    setReprocessing(true)
    const res = await fetch(`/api/inputs/${inputId}/reprocess`, { method: 'POST' })
    setReprocessing(false)
    if (res.ok) router.refresh()
  }

  async function handleDelete() {
    await fetch(`/api/inputs/${inputId}`, { method: 'DELETE' })
    router.push('/home')
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleReprocess}
          disabled={reprocessing}
          className="px-3 py-1.5 text-[12px] text-neutral-400 bg-white/[0.04] border border-white/[0.06] rounded-lg hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-30"
        >
          {reprocessing ? 'reprocessing...' : status === 'failed' ? 'retry' : 'reprocess'}
        </button>
        <ActionMenu actions={[
          { label: 'Delete input & nodes', onClick: () => setDeleting(true), danger: true },
        ]} />
      </div>

      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={handleDelete}
        title="Delete input"
        message="This will permanently delete this input and all nodes extracted from it."
      />
    </>
  )
}
