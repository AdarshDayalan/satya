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
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Drop anything here — note, link, thought, quote, transcript..."
          rows={4}
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-neutral-600"
        />
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 transition disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Process'}
        </button>
      </form>

      {result && (
        <div className="text-sm text-neutral-400 bg-neutral-900 rounded-lg px-4 py-3">
          Meaning extracted — {result.nodes} nodes created, {result.edges} connections found.
        </div>
      )}
    </div>
  )
}
