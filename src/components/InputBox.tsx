'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type SourceType = 'journal' | 'youtube' | 'instagram' | 'article' | 'research_paper' | 'reddit' | 'pubmed'

type Result = {
  nodes: number
  edges: number
  folder: string | null
}

type Preview = {
  enrichedContent: string
  metadata: Record<string, unknown>
  sourceType: SourceType
}

const SOURCE_LABELS: Record<SourceType, { label: string; color: string }> = {
  journal: { label: 'journal', color: 'text-white/40' },
  youtube: { label: 'YouTube', color: 'text-red-400' },
  instagram: { label: 'Instagram', color: 'text-pink-400' },
  article: { label: 'article', color: 'text-blue-400' },
  research_paper: { label: 'paper', color: 'text-green-400' },
  reddit: { label: 'Reddit', color: 'text-orange-400' },
  pubmed: { label: 'PubMed', color: 'text-cyan-400' },
}

function detectSourceType(text: string): SourceType {
  if (/(?:youtube\.com\/watch|youtu\.be\/)/.test(text)) return 'youtube'
  if (/reddit\.com\/r\//.test(text)) return 'reddit'
  if (/pubmed\.ncbi\.nlm\.nih\.gov\/\d+/.test(text)) return 'pubmed'
  if (/instagram\.com\/(reel|p)\//.test(text)) return 'instagram'
  if (/arxiv\.org\//.test(text)) return 'research_paper'
  if (/https?:\/\//.test(text)) return 'article'
  return 'journal'
}

export default function InputBox() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [personalNote, setPersonalNote] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  const detectedSource = useMemo(() => detectSourceType(content), [content])
  const sourceInfo = SOURCE_LABELS[detectedSource]
  const isUrlSource = detectedSource !== 'journal'

  function autoResize() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript + ' '
        }
      }
      if (final) {
        setContent((prev) => prev + final)
      }
    }

    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
  }, [])

  function toggleListening() {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
      setListening(true)
    }
  }

  async function handlePreview() {
    if (!content.trim()) return
    setPreviewing(true)
    setError(null)

    try {
      const res = await fetch('/api/extract-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_content: content }),
      })
      const data = await res.json()
      if (res.ok) {
        setPreview(data)
      } else {
        setError(data.error || 'Failed to extract content')
      }
    } catch {
      setError('Connection failed. Try again.')
    }

    setPreviewing(false)
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/process-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_content: personalNote
            ? `${content}\n\nPersonal notes: ${personalNote}`
            : content,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult({
          nodes: data.nodes?.length ?? 0,
          edges: data.edges?.length ?? 0,
          folder: data.folder?.name ?? null,
        })
        setContent('')
        setPreview(null)
        setPersonalNote('')
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
      <form onSubmit={(e) => { e.preventDefault(); isUrlSource ? handlePreview() : handleSubmit() }}>
        <div className="input-glow rounded-2xl">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              autoResize()
              if (error) setError(null)
              if (result) setResult(null)
              if (preview) setPreview(null)
            }}
            placeholder="drop anything here..."
            rows={2}
            disabled={loading || previewing}
            className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white/90 placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.12] transition-all text-[15px] leading-relaxed disabled:opacity-40"
            style={{ minHeight: '5rem', overflow: 'hidden' }}
          />
        </div>
        <div className="flex items-center justify-between mt-3 px-1">
          {isUrlSource && (
            <span className={`text-[11px] font-medium ${sourceInfo.color} animate-fade-up`}>
              {sourceInfo.label} detected
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <button
            type="button"
            onClick={toggleListening}
            disabled={loading || previewing || !recognitionRef.current}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-20 disabled:cursor-default ${
              listening
                ? 'text-red-400 bg-red-400/10 border-red-400/30 animate-pulse-soft'
                : 'text-white/60 bg-white/[0.06] border-white/[0.06] hover:bg-white/[0.1] hover:text-white/90'
            }`}
          >
            {listening ? '● stop' : '🎙 voice'}
          </button>
          <button
            type="submit"
            disabled={loading || previewing || !content.trim()}
            className="px-4 py-1.5 text-xs font-medium text-white/60 bg-white/[0.06] rounded-lg hover:bg-white/[0.1] hover:text-white/90 border border-white/[0.06] transition-all disabled:opacity-20 disabled:cursor-default"
          >
            {loading ? (
              <span className="animate-pulse-soft">extracting meaning...</span>
            ) : previewing ? (
              <span className="animate-pulse-soft">fetching content...</span>
            ) : isUrlSource ? (
              'preview'
            ) : (
              'process'
            )}
          </button>
        </div>
      </form>

      {/* Preview panel for URL sources */}
      {preview && (
        <div className="animate-fade-up space-y-3">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-medium uppercase tracking-widest ${SOURCE_LABELS[preview.sourceType]?.color || 'text-white/40'}`}>
                {SOURCE_LABELS[preview.sourceType]?.label || preview.sourceType}
              </span>
              {preview.metadata.title ? (
                <>
                  <span className="text-neutral-800">·</span>
                  <span className="text-[12px] text-white/70 font-medium">{String(preview.metadata.title)}</span>
                </>
              ) : null}
            </div>
            {preview.metadata.author ? (
              <p className="text-[12px] text-neutral-500">{String(preview.metadata.author)}</p>
            ) : null}
            {preview.metadata.authors ? (
              <p className="text-[12px] text-neutral-500">{String(preview.metadata.authors)}</p>
            ) : null}
            {preview.metadata.subreddit ? (
              <p className="text-[12px] text-orange-400/60">{String(preview.metadata.subreddit)}</p>
            ) : null}
            <div className="max-h-48 overflow-y-auto">
              <p className="text-[13px] text-white/60 leading-relaxed whitespace-pre-wrap">
                {preview.enrichedContent.slice(0, 2000)}
                {preview.enrichedContent.length > 2000 ? '…' : ''}
              </p>
            </div>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-3">
            <textarea
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              placeholder="add your notes about this source..."
              rows={2}
              className="w-full bg-transparent text-white/80 placeholder-neutral-600 resize-none focus:outline-none text-[13px] leading-relaxed"
            />
          </div>
          <div className="flex items-center gap-2 px-1">
            <button
              onClick={() => handleSubmit()}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium text-white/80 bg-white/[0.08] rounded-lg hover:bg-white/[0.12] border border-white/[0.08] transition-all disabled:opacity-40"
            >
              {loading ? (
                <span className="animate-pulse-soft">extracting meaning...</span>
              ) : (
                'confirm & process'
              )}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              cancel
            </button>
          </div>
        </div>
      )}

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
