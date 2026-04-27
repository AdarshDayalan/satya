import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InputBox from '@/components/InputBox'
import NodeList from '@/components/NodeList'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: nodes } = await supabase
    .from('nodes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800 px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Satya</h1>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm text-neutral-400 hover:text-white transition"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <InputBox />
        <NodeList nodes={nodes ?? []} />
      </main>
    </div>
  )
}
