'use client'

import { useState, useRef, useEffect } from 'react'

interface Action {
  label: string
  onClick: () => void
  danger?: boolean
}

export default function ActionMenu({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
        className="p-1 rounded-md text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.05] transition-all opacity-0 group-hover:opacity-100"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-neutral-900 border border-white/[0.08] rounded-xl shadow-2xl py-1 animate-fade-up">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); action.onClick(); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${
                action.danger
                  ? 'text-red-400 hover:bg-red-400/10'
                  : 'text-neutral-300 hover:bg-white/[0.05]'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
