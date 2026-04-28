'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type SourceType = 'journal' | 'youtube' | 'instagram' | 'article' | 'research_paper' | 'reddit' | 'pubmed'

type CaptureState = 'idle' | 'capturing' | 'captured' | 'processing' | 'done' | 'error'

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
  const [state, setState] = useState<CaptureState>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [connectionHint, setConnectionHint] = useState('')
  const [showHint, setShowHint] = useState(false)
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
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' '
      }
      if (final) setContent(prev => prev + final)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
  }, [])

  function toggleListening() {
    if (!recognitionRef.current) return
    if (listening) recognitionRef.current.stop()
    else { recognitionRef.current.start(); setListening(true) }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!content.trim() || state === 'capturing' || state === 'processing') return

    const submittedContent = content

    // Step 1: Capture instantly
    setState('capturing')
    setStatusMsg('saving...')
    setError(null)

    try {
      const captureRes = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_content: submittedContent, connection_hint: connectionHint || undefined }),
      })

      if (!captureRes.ok) {
        const data = await captureRes.json()
        throw new Error(data.error || 'Failed to save')
      }

      const captureData = await captureRes.json()
      const isBulk = captureData.bulk
      const count = captureData.count || 1

      // Instant feedback — clear input immediately
      setState('captured')
      setStatusMsg(isBulk ? `${count} sources captured` : 'captured')
      setContent('')
      setConnectionHint('')
      setShowHint(false)
      setExpanded(false)
      router.refresh()

      // Step 2: Process each input in background (fire and forget)
      setState('processing')
      setStatusMsg(isBulk ? `extracting meaning from ${count} sources...` : 'extracting meaning...')

      // For bulk, process each input independently
      const inputs = captureData.inputs || [captureData.input]
      const processPromises = inputs.map((input: { id: string }) =>
        fetch('/api/process-input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input_id: input.id }),
        }).catch(() => null)
      )

      // Also fire with raw_content for single input (backward compat)
      if (!isBulk) {
        fetch('/api/process-input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_content: submittedContent, connection_hint: connectionHint || undefined }),
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            const nodes = data.nodes?.length ?? 0
            const edges = data.edges?.length ?? 0
            const folder = data.folder?.name
            setStatusMsg(
              `${nodes} nodes · ${edges} connections` +
              (folder ? ` · theme: ${folder}` : '')
            )
            setState('done')
            router.refresh()
          } else {
            setStatusMsg('extraction failed — input saved')
            setState('error')
          }
          setTimeout(() => { setState('idle'); setStatusMsg('') }, 5000)
        }).catch(() => {
          setStatusMsg('extraction failed — input saved')
          setState('error')
          setTimeout(() => { setState('idle'); setStatusMsg('') }, 5000)
        })
      } else {
        // For bulk, just wait for all and show summary
        Promise.allSettled(processPromises).then(() => {
          setStatusMsg(`${count} sources processed`)
          setState('done')
          router.refresh()
          setTimeout(() => { setState('idle'); setStatusMsg('') }, 5000)
        })
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setState('idle')
    }
  }

  const stateColors: Record<CaptureState, string> = {
    idle: '',
    capturing: 'text-neutral-500',
    captured: 'text-green-400/60',
    processing: 'text-amber-400/60',
    done: 'text-green-400/60',
    error: 'text-red-400/60',
  }

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
        <div className="input-glow rounded-2xl">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              autoResize()
              if (error) setError(null)
              if (!expanded && e.target.value.includes('\n')) setExpanded(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleSubmit() }
            }}
            placeholder={expanded ? 'write freely — markdown supported...' : 'drop anything here...'}
            rows={expanded ? 8 : 2}
            disabled={state === 'capturing'}
            className={`w-full px-5 py-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white/90 placeholder-neutral-600 resize-none focus:outline-none focus:border-white/[0.12] transition-all text-[15px] leading-relaxed disabled:opacity-40 ${expanded ? 'font-mono text-[14px]' : ''}`}
            style={{ minHeight: expanded ? '200px' : '5rem', overflow: 'hidden' }}
          />
        </div>

        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex items-center gap-3">
            {isUrlSource && (
              <span className={`text-[11px] font-medium ${sourceInfo.color} animate-fade-up`}>
                {sourceInfo.label} detected
              </span>
            )}
            {!isUrlSource && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors"
              >
                {expanded ? '↑ collapse' : '↓ expand to journal'}
              </button>
            )}
          </div>
          {expanded && !isUrlSource && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowHint(!showHint)}
                className={`text-[10px] transition-colors ${showHint || connectionHint ? 'text-purple-400/60' : 'text-neutral-700 hover:text-neutral-500'}`}>
                {showHint ? '↑ hide hint' : '⟡ connection hint'}
              </button>
              <span className="text-[10px] text-neutral-700">markdown · ⌘Enter</span>
            </div>
          )}
        </div>

        {showHint && (
          <div className="mt-2 px-1">
            <input
              value={connectionHint}
              onChange={(e) => setConnectionHint(e.target.value)}
              placeholder="e.g. relates to flow state, dopamine, ancient training..."
              className="w-full px-3 py-1.5 bg-purple-400/[0.04] border border-purple-400/10 rounded-lg text-white/70 text-[12px] focus:outline-none focus:border-purple-400/20 placeholder-neutral-600"
            />
            <p className="text-[10px] text-neutral-700 mt-1 px-1">biases the AI to look harder for connections to these topics</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-2 px-1">
          <button
            type="button"
            onClick={toggleListening}
            disabled={state === 'capturing' || !recognitionRef.current}
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
            disabled={state === 'capturing' || !content.trim()}
            className="px-4 py-1.5 text-xs font-medium text-white/60 bg-white/[0.06] rounded-lg hover:bg-white/[0.1] hover:text-white/90 border border-white/[0.06] transition-all disabled:opacity-20 disabled:cursor-default"
          >
            {state === 'capturing' ? 'saving...' : 'drop'}
          </button>
        </div>
      </form>

      {/* Status line */}
      {statusMsg && (
        <div className={`animate-fade-up flex items-center gap-2 px-1 ${stateColors[state]}`}>
          {state === 'processing' && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse-soft" />
          )}
          {state === 'done' && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400/60" />
          )}
          <span className="text-[12px]">
            {state === 'processing' ? (
              <span className="animate-pulse-soft">{statusMsg}</span>
            ) : statusMsg}
          </span>
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
