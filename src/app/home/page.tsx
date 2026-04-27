import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InputBox from '@/components/InputBox'
import NodeList from '@/components/NodeList'
import FolderList from '@/components/FolderList'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: nodes }, { data: folders }] = await Promise.all([
    supabase
      .from('nodes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-white/[0.01] blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-light tracking-tight text-white/90">Satya</h1>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            exit
          </button>
        </form>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 space-y-10 relative z-10">
        <InputBox />
        <FolderList folders={folders ?? []} />
        <NodeList nodes={nodes ?? []} />
      </main>
    </div>
  )
}
