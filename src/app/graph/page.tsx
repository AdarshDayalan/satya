import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import GraphWithPanel from '@/components/GraphWithPanel'

export default async function GraphPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: nodes }, { data: edges }, { data: folders }, { data: folderNodes }, { data: inputs }] = await Promise.all([
    // Pull input_id and source_url so the SidePanel can render the Source card.
    supabase.from('nodes').select('id, content, type, created_at, input_id, source_url, perspectives').order('created_at', { ascending: false }).limit(500),
    supabase.from('edges').select('from_node_id, to_node_id, relationship, strength, reason').limit(2000),
    supabase.from('folders').select('id, name').limit(50),
    supabase.from('folder_nodes').select('folder_id, node_id').limit(1000),
    supabase.from('inputs').select('id, raw_content, source_type, source_metadata, status, created_at').limit(500),
  ])

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      <header className="shrink-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
        <Link href="/home" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">
          &larr; back
        </Link>
        <span className="text-[11px] text-neutral-600 uppercase tracking-widest">thought field</span>
        <div className="w-12" />
      </header>
      <GraphWithPanel
        nodes={nodes ?? []}
        edges={edges ?? []}
        folders={folders ?? []}
        folderNodes={folderNodes ?? []}
        inputs={inputs ?? []}
      />
    </div>
  )
}
