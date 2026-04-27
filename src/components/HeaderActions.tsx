'use client'

import { useState } from 'react'
import SettingsModal from './SettingsModal'

export default function HeaderActions() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setSettingsOpen(true)}
        className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        settings
      </button>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
