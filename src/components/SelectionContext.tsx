'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import SidePanel from './SidePanel'

interface Selection {
  type: 'node' | 'input'
  id: string
}

interface SelectionContextType {
  select: (type: 'node' | 'input', id: string) => void
}

const SelectionContext = createContext<SelectionContextType>({ select: () => {} })

export function useSelection() {
  return useContext(SelectionContext)
}

export function SelectionProvider({
  children,
  allNodes,
}: {
  children: ReactNode
  allNodes: Array<{ id: string; content: string; type: string }>
}) {
  const [selection, setSelection] = useState<Selection | null>(null)

  const select = useCallback((type: 'node' | 'input', id: string) => {
    setSelection({ type, id })
  }, [])

  const close = useCallback(() => setSelection(null), [])

  return (
    <SelectionContext.Provider value={{ select }}>
      <div className="flex relative z-10" style={{ minHeight: 'calc(100vh - 49px)' }}>
        {children}
        {selection && (
          <SidePanel
            key={`${selection.type}-${selection.id}`}
            type={selection.type}
            id={selection.id}
            onClose={close}
            onNavigate={select}
            allNodes={allNodes}
          />
        )}
      </div>
    </SelectionContext.Provider>
  )
}
