'use client'

import { useState, useEffect } from 'react'
import Portal from './Portal'
import ThemePicker from './ThemePicker'
import { SOURCE_CREDIBILITY } from '@/lib/evidence-rank'

const PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'], keyUrl: 'https://aistudio.google.com/apikey', keyLabel: 'aistudio.google.com' },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'], keyUrl: 'https://platform.openai.com/api-keys', keyLabel: 'platform.openai.com' },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'], keyUrl: 'https://console.anthropic.com/settings/keys', keyLabel: 'console.anthropic.com' },
]

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [maskedKey, setMaskedKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [trustWeights, setTrustWeights] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<'ai' | 'trust'>('ai')
  const [embProvider, setEmbProvider] = useState('')
  const [embApiKey, setEmbApiKey] = useState('')
  const [embMaskedKey, setEmbMaskedKey] = useState('')
  const [hasEmbKey, setHasEmbKey] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setProvider(data.ai_provider || 'gemini')
        setModel(data.ai_model || '')
        setMaskedKey(data.ai_api_key_masked || '')
        setHasKey(data.has_key || false)
        setApiKey('')
        setTrustWeights(data.trust_weights || {})
        setEmbProvider(data.embedding_provider || '')
        setEmbMaskedKey(data.embedding_api_key_masked || '')
        setHasEmbKey(data.has_embedding_key || false)
        setEmbApiKey('')
      })
  }, [open])

  async function handleSave() {
    setSaving(true)
    setStatus('idle')
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ai_provider: provider, ai_model: model || undefined, ai_api_key: apiKey || undefined,
        trust_weights: trustWeights,
        embedding_provider: embProvider || undefined, embedding_api_key: embApiKey || undefined,
      }),
    })
    setSaving(false)
    setStatus(res.ok ? 'saved' : 'error')
    if (res.ok && apiKey) {
      setMaskedKey('•'.repeat(Math.max(0, apiKey.length - 4)) + apiKey.slice(-4))
      setHasKey(true)
      setApiKey('')
    }
    if (res.ok && embApiKey) {
      setEmbMaskedKey('•'.repeat(Math.max(0, embApiKey.length - 4)) + embApiKey.slice(-4))
      setHasEmbKey(true)
      setEmbApiKey('')
    }
  }

  if (!open) return null

  const selectedProvider = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0]

  return (
    <Portal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[101] bg-[#0a0a0a] border border-white/[0.08] rounded-2xl w-full max-w-md mx-4 my-auto p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/80">Settings</h2>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 text-xs">close</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/[0.06] pb-0">
          {(['ai', 'trust'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[11px] rounded-t-lg border-b-2 transition-colors ${tab === t ? 'text-white/80 border-purple-400/60' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}>
              {t === 'ai' ? 'AI Provider' : 'Source Trust'}
            </button>
          ))}
        </div>

        {tab === 'trust' ? (
          <div className="space-y-3">
            <p className="text-[11px] text-neutral-500">
              Adjust how much you trust each source type. Higher = more influence in the graph. Changes affect EvidenceRank.
            </p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {Object.entries(SOURCE_CREDIBILITY).map(([key, cred]) => {
                const value = trustWeights[key] ?? cred.score
                const isCustom = trustWeights[key] !== undefined
                return (
                  <div key={key} className="flex items-center gap-2 group">
                    <span className="text-[11px] text-white/60 w-28 truncate shrink-0" title={cred.label}>{cred.label}</span>
                    <span className={`text-[9px] w-16 shrink-0 ${
                      cred.tier === 'peer-reviewed' ? 'text-green-400/60' :
                      cred.tier === 'institutional' ? 'text-teal-400/60' :
                      cred.tier === 'editorial' ? 'text-blue-400/60' :
                      cred.tier === 'media' ? 'text-amber-400/60' :
                      cred.tier === 'community' ? 'text-orange-400/60' :
                      cred.tier === 'social' ? 'text-pink-400/60' :
                      'text-white/40'
                    }`}>{cred.tier}</span>
                    <input
                      type="range" min="0" max="2" step="0.05"
                      value={value}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        setTrustWeights(prev => ({ ...prev, [key]: v }))
                      }}
                      className="flex-1 accent-purple-400 h-1"
                    />
                    <span className={`text-[10px] w-7 text-right font-mono ${isCustom ? 'text-purple-400/80' : 'text-neutral-600'}`}>
                      {value.toFixed(1)}
                    </span>
                    {isCustom && (
                      <button onClick={() => {
                        setTrustWeights(prev => { const n = { ...prev }; delete n[key]; return n })
                      }} className="text-[9px] text-neutral-700 hover:text-neutral-400 opacity-0 group-hover:opacity-100" title="Reset to default">
                        ↺
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {Object.keys(trustWeights).length > 0 && (
              <button onClick={() => setTrustWeights({})} className="text-[10px] text-neutral-600 hover:text-neutral-400">
                reset all to defaults
              </button>
            )}
          </div>
        ) : (
        <div className="space-y-4">
          {/* Provider */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-500 uppercase tracking-widest">Provider</label>
            <select
              value={provider}
              onChange={(e) => { setProvider(e.target.value); setModel('') }}
              className="w-full px-3 py-2 bg-[#111] border border-white/[0.08] rounded-lg text-white/80 text-sm focus:outline-none focus:border-white/[0.15] [&>option]:bg-[#111] [&>option]:text-white/80"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-500 uppercase tracking-widest">Model</label>
            <select
              value={model || selectedProvider.models[0]}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-[#111] border border-white/[0.08] rounded-lg text-white/80 text-sm focus:outline-none focus:border-white/[0.15] [&>option]:bg-[#111] [&>option]:text-white/80"
            >
              {selectedProvider.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-500 uppercase tracking-widest">API Key</label>
            {hasKey && !apiKey && (
              <p className="text-[12px] text-neutral-500 font-mono">{maskedKey}</p>
            )}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? 'enter new key to replace' : 'paste your API key'}
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/80 text-sm focus:outline-none focus:border-white/[0.15] placeholder-neutral-600"
            />
            <p className="text-[11px] text-neutral-600">
              Your key is stored securely and never shared. Get one at{' '}
              <a href={selectedProvider.keyUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400/60 hover:text-purple-400">
                {selectedProvider.keyLabel}
              </a>
            </p>
          </div>

          {/* Embedding Provider (optional override) */}
          <div className="pt-3 border-t border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-neutral-500 uppercase tracking-widest">Embeddings</label>
              <span className="text-[10px] text-neutral-700">optional — defaults to same provider</span>
            </div>
            <select
              value={embProvider}
              onChange={(e) => setEmbProvider(e.target.value)}
              className="w-full px-3 py-2 bg-[#111] border border-white/[0.08] rounded-lg text-white/80 text-sm focus:outline-none focus:border-white/[0.15] [&>option]:bg-[#111] [&>option]:text-white/80"
            >
              <option value="">Same as AI provider</option>
              {PROVIDERS.filter(p => p.id !== 'anthropic').map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {embProvider && embProvider !== provider && (
              <div className="space-y-1.5">
                {hasEmbKey && !embApiKey && (
                  <p className="text-[12px] text-neutral-500 font-mono">{embMaskedKey}</p>
                )}
                <input
                  type="password"
                  value={embApiKey}
                  onChange={(e) => setEmbApiKey(e.target.value)}
                  placeholder={hasEmbKey ? 'enter new key to replace' : 'paste embedding API key'}
                  className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/80 text-sm focus:outline-none focus:border-white/[0.15] placeholder-neutral-600"
                />
              </div>
            )}
          </div>
        </div>
        )}

        <ThemePicker />

        <div className="flex items-center justify-between pt-2">
          <span className="text-[12px]">
            {status === 'saved' && <span className="text-green-400/70">saved</span>}
            {status === 'error' && <span className="text-red-400/70">failed to save</span>}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-medium text-white/70 bg-white/[0.08] rounded-lg hover:bg-white/[0.12] border border-white/[0.08] transition-all disabled:opacity-40"
          >
            {saving ? 'saving...' : 'save'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
