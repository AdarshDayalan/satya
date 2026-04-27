'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Result = {
  nodes: number
  edges: number
  folder: string | null
}

export default function InputBox() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/process-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_content: content }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult({
          nodes: data.nodes?.length ?? 0,
          edges: data.edges?.length ?? 0,
          folder: data.folder?.name ?? null,
        })
        setContent('')
        router.refresh()
      } else {
        setError(data.message || 'Processing failed — your input was saved.')
      }
    } catch {
      setError('Connection failed. Try again.')
    }

    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="input-glow rounded-2xl">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              if (error) setError(null)
              if (result) setResult(null)
            }}
            placeholder="drop anything here..."
            rows={3}
            disabled={loading}
            className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white/90 placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.12] transition-all text-[15px] leading-relaxed disabled:opacity-40"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="absolute bottom-3 right-3 px-4 py-1.5 text-xs font-medium text-white/60 bg-white/[0.06] rounded-lg hover:bg-white/[0.1] hover:text-white/90 border border-white/[0.06] transition-all disabled:opacity-20 disabled:cursor-default"
        >
          {loading ? (
            <span className="animate-pulse-soft">extracting meaning...</span>
          ) : (
            'process'
          )}
        </button>
      </form>

      {result && (
        <div className="animate-fade-up space-y-1 px-1">
          <p className="text-[13px] text-neutral-400">
            {result.nodes} meaning nodes extracted · {result.edges} connections found
          </p>
          {result.folder && (
            <p className="text-[12px] text-purple-400/60">
              new theme emerged: {result.folder}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="animate-fade-up px-1">
          <p className="text-[13px] text-red-400/70">{error}</p>
        </div>
      )}
    </div>
  )
}
