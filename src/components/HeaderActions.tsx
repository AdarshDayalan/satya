'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SettingsModal from './SettingsModal'
import CreateNodeModal from './CreateNodeModal'

export default function HeaderActions() {
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setCreateOpen(true)}
        className="text-[12px] text-purple-400/50 hover:text-purple-400 transition-colors"
      >
        + node
      </button>
      <button
        onClick={() => setSettingsOpen(true)}
        className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        settings
      </button>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CreateNodeModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => router.refresh()} />
    </>
  )
}
