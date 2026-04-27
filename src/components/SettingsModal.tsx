'use client'

import { useState, useEffect } from 'react'

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
      })
  }, [open])

  async function handleSave() {
    setSaving(true)
    setStatus('idle')
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_provider: provider, ai_model: model || undefined, ai_api_key: apiKey || undefined }),
    })
    setSaving(false)
    setStatus(res.ok ? 'saved' : 'error')
    if (res.ok && apiKey) {
      setMaskedKey('•'.repeat(Math.max(0, apiKey.length - 4)) + apiKey.slice(-4))
      setHasKey(true)
      setApiKey('')
    }
  }

  if (!open) return null

  const selectedProvider = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0]

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[101] bg-[#0a0a0a] border border-white/[0.08] rounded-2xl w-full max-w-md mx-4 my-auto p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/80">AI Settings</h2>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 text-xs">close</button>
        </div>

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
        </div>

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
  )
}
