'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/home')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.015] blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm space-y-10 relative z-10 animate-fade-up">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <svg width="48" height="48" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="60" cy="60" r="54" stroke="white" strokeWidth="1.5" opacity="0.15"/>
              <path d="M60 18 L60 102" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              <path d="M28 42 L60 72 L92 42" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
              <circle cx="60" cy="72" r="4" fill="white" opacity="0.8"/>
            </svg>
          </div>
          <h1 className="text-4xl font-light text-white tracking-tight">Satya</h1>
          <p className="text-neutral-500 text-sm tracking-wide">truth emerges</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-white/[0.15] transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-white/[0.15] transition-colors"
          />

          {error && <p className="text-red-400/80 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-white/[0.08] text-white/90 font-medium rounded-xl hover:bg-white/[0.12] border border-white/[0.06] transition-all disabled:opacity-30"
          >
            {loading ? 'Entering...' : 'Enter'}
          </button>
        </form>

        <p className="text-center text-neutral-600 text-sm">
          New here?{' '}
          <Link href="/signup" className="text-neutral-400 hover:text-white transition-colors">
            Create space
          </Link>
        </p>
      </div>
    </div>
  )
}
