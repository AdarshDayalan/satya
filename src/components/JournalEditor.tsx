'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MarkdownContent from './MarkdownContent'

interface JournalEditorProps {
  inputId: string
  content: string
  status: string
}

export default function JournalEditor({ inputId, content, status }: JournalEditorProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(content)
  const [saving, setSaving] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  // Auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
      textareaRef.current.focus()
    }
  }, [editing, value])

  const save = useCallback(async () => {
    if (value === content) { setEditing(false); return }
    setSaving(true)
    await fetch(`/api/inputs/${inputId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_content: value }),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }, [value, content, inputId, router])

  async function handleReprocess() {
    setReprocessing(true)
    await fetch(`/api/inputs/${inputId}/reprocess`, { method: 'POST' })
    setReprocessing(false)
    router.refresh()
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!editing) return
      if (e.key === 'Escape') { setValue(content); setEditing(false) }
      if (e.key === 's' && e.metaKey) { e.preventDefault(); save() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [editing, content, save])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-[12px] text-neutral-500 hover:text-white bg-white/[0.03] border border-white/[0.06] rounded-lg hover:bg-white/[0.06] transition-all"
            >
              edit
            </button>
          ) : (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 text-[12px] text-white/80 bg-white/[0.08] border border-white/[0.08] rounded-lg hover:bg-white/[0.12] transition-all disabled:opacity-30"
              >
                {saving ? 'saving...' : 'save'}
              </button>
              <button
                onClick={() => { setValue(content); setEditing(false) }}
                className="px-3 py-1.5 text-[12px] text-neutral-500 hover:text-white transition-colors"
              >
                cancel
              </button>
              <span className="text-[10px] text-neutral-700">⌘S to save · Esc to cancel</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            className="px-3 py-1.5 text-[12px] text-neutral-500 hover:text-white bg-white/[0.03] border border-white/[0.06] rounded-lg hover:bg-white/[0.06] transition-all disabled:opacity-30"
          >
            {reprocessing ? 'extracting...' : status === 'failed' ? 'retry extraction' : 're-extract'}
          </button>
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-1 py-0 bg-transparent text-white/80 text-[14px] leading-[1.8] resize-none focus:outline-none font-mono border-l-2 border-white/[0.06] pl-4"
          style={{ minHeight: '200px' }}
        />
      ) : (
        <div
          className="cursor-text min-h-[100px]"
          onClick={() => setEditing(true)}
        >
          {content ? (
            <MarkdownContent content={content} />
          ) : (
            <p className="text-neutral-600 text-[14px] italic">click to start writing...</p>
          )}
        </div>
      )}
    </div>
  )
}
