'use client'

import { useState, useCallback } from 'react'
import SidePanel from './SidePanel'

interface Selection {
  type: 'node' | 'input'
  id: string
}

export default function HomeLayout({
  children,
  allNodes,
}: {
  children: (onSelect: (type: 'node' | 'input', id: string) => void) => React.ReactNode
  allNodes: Array<{ id: string; content: string; type: string }>
}) {
  const [selection, setSelection] = useState<Selection | null>(null)

  const handleSelect = useCallback((type: 'node' | 'input', id: string) => {
    setSelection({ type, id })
  }, [])

  const handleClose = useCallback(() => setSelection(null), [])

  return (
    <div className="flex relative z-10" style={{ minHeight: 'calc(100vh - 49px)' }}>
      {children(handleSelect)}

      {selection && (
        <SidePanel
          key={`${selection.type}-${selection.id}`}
          type={selection.type}
          id={selection.id}
          onClose={handleClose}
          onNavigate={handleSelect}
          allNodes={allNodes}
        />
      )}
    </div>
  )
}
