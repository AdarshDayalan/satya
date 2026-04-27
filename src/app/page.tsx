import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/home')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-white/[0.01] blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center space-y-8 max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <svg width="64" height="64" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="54" stroke="white" strokeWidth="1.5" opacity="0.15"/>
            <path d="M60 18 L60 102" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
            <path d="M28 42 L60 72 L92 42" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
            <circle cx="60" cy="72" r="4" fill="white" opacity="0.8"/>
          </svg>
        </div>

        <div className="space-y-3">
          <h1 className="text-5xl font-light text-white tracking-tight">Satya</h1>
          <p className="text-neutral-500 text-base tracking-wide">truth emerges from connections</p>
        </div>

        <p className="text-neutral-600 text-sm leading-relaxed max-w-xs mx-auto">
          Feed it articles, ideas, and notes. Watch your knowledge graph reveal what you actually believe.
        </p>

        <div className="flex gap-3 justify-center pt-2">
          <Link
            href="/login"
            className="px-6 py-3 bg-white/[0.08] text-white/90 rounded-xl hover:bg-white/[0.12] border border-white/[0.06] transition-all text-sm"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 bg-white text-black rounded-xl hover:bg-neutral-200 transition-all text-sm font-medium"
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  )
}
