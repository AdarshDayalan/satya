'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.015] blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm space-y-10 relative z-10 animate-fade-up">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-light text-white tracking-tight">Satya</h1>
          <p className="text-neutral-500 text-sm tracking-wide">begin your truth graph</p>
        </div>

        {success ? (
          <div className="text-center space-y-2 animate-fade-up">
            <p className="text-neutral-300 text-sm">Check your email for a confirmation link.</p>
            <p className="text-neutral-600 text-xs">Then return here to enter.</p>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
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
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-white/[0.15] transition-colors"
            />

            {error && <p className="text-red-400/80 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-white/[0.08] text-white/90 font-medium rounded-xl hover:bg-white/[0.12] border border-white/[0.06] transition-all disabled:opacity-30"
            >
              {loading ? 'Creating...' : 'Create space'}
            </button>
          </form>
        )}

        <p className="text-center text-neutral-600 text-sm">
          Already have a space?{' '}
          <Link href="/login" className="text-neutral-400 hover:text-white transition-colors">
            Enter
          </Link>
        </p>
      </div>
    </div>
  )
}
