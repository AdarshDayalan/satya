'use client'

import { useState, useEffect } from 'react'
import Portal from './Portal'

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (value: string) => void
  title: string
  initialValue: string
  placeholder?: string
}

export default function EditModal({ isOpen, onClose, onSave, title, initialValue, placeholder }: EditModalProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && e.metaKey) { onSave(value); onClose() }
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, value, onClose, onSave])

  if (!isOpen) return null

  return (
    <Portal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-neutral-900 border border-white/[0.08] rounded-2xl p-6 space-y-4 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[14px] font-medium text-neutral-300">{title}</h2>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={4}
          autoFocus
          className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/90 placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.15] transition-colors text-[14px] leading-relaxed"
        />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-neutral-600">⌘ Enter to save</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSave(value); onClose() }}
              className="px-4 py-2 text-[13px] bg-white/[0.08] text-white/90 rounded-lg hover:bg-white/[0.12] border border-white/[0.06] transition-all"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  )
}
