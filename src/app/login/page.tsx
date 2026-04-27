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
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

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
        <div className="text-center space-y-3">
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
