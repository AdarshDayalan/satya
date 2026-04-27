'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InputBox() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ nodes: number; edges: number } | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setResult(null)

    const res = await fetch('/api/process-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_content: content }),
    })

    if (res.ok) {
      const data = await res.json()
      setResult({ nodes: data.nodes?.length ?? 0, edges: data.edges?.length ?? 0 })
      setContent('')
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="input-glow rounded-2xl">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="drop anything here..."
            rows={3}
            className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white/90 placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.12] transition-all text-[15px] leading-relaxed"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="absolute bottom-3 right-3 px-4 py-1.5 text-xs font-medium text-white/60 bg-white/[0.06] rounded-lg hover:bg-white/[0.1] hover:text-white/90 border border-white/[0.06] transition-all disabled:opacity-20 disabled:cursor-default"
        >
          {loading ? (
            <span className="animate-pulse-soft">processing</span>
          ) : (
            'process'
          )}
        </button>
      </form>

      {result && (
        <div className="animate-fade-up text-[13px] text-neutral-500 px-1">
          {result.nodes} meaning nodes extracted · {result.edges} connections found
        </div>
      )}
    </div>
  )
}
