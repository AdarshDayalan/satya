import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InputBox from '@/components/InputBox'
import SourceSidebar from '@/components/SourceSidebar'
import HomeTabs from '@/components/HomeTabs'
import HeaderActions from '@/components/HeaderActions'
import HomeLayout from '@/components/HomeLayout'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: nodes }, { data: folders }, { data: inputs }, { data: edges }, { data: folderNodesData }] = await Promise.all([
    supabase
      .from('nodes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('inputs')
      .select('id, raw_content, source_type, source_metadata, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('edges')
      .select('from_node_id, to_node_id, relationship, strength')
      .limit(200),
    supabase
      .from('folder_nodes')
      .select('folder_id, node_id')
      .limit(500),
  ])

  const allNodes = (nodes ?? []).map((n) => ({ id: n.id, content: n.content, type: n.type }))

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-white/[0.01] blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-light tracking-tight text-white/90">Satya</h1>
        <div className="flex items-center gap-4">
          <a href="/publish" className="text-[12px] text-purple-400/50 hover:text-purple-400 transition-colors">
            publish
          </a>
          <HeaderActions />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              exit
            </button>
          </form>
        </div>
      </header>

      <HomeLayout allNodes={allNodes}>
        {(onSelect) => (
          <>
            <SourceSidebar
              inputs={inputs ?? []}
              folders={folders ?? []}
              folderNodes={folderNodesData ?? []}
              nodes={nodes ?? []}
              onSelect={onSelect}
            />

            <main className="flex-1 max-w-2xl mx-auto px-6 py-10 space-y-10">
              <InputBox />
              <HomeTabs
                nodes={nodes ?? []}
                edges={edges ?? []}
                folders={folders ?? []}
                folderNodes={folderNodesData ?? []}
                inputs={inputs ?? []}
                onSelect={onSelect}
              />
            </main>
          </>
        )}
      </HomeLayout>
    </div>
  )
}
