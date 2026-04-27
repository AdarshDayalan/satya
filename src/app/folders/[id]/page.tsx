import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FolderDetail from '@/components/FolderDetail'

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: folder } = await supabase
    .from('folders')
    .select('*')
    .eq('id', id)
    .single()

  if (!folder) redirect('/home')

  const { data: folderNodes } = await supabase
    .from('folder_nodes')
    .select('node:nodes(id, content, type, created_at)')
    .eq('folder_id', id)

  const nodes = (folderNodes ?? [])
    .map((fn: Record<string, unknown>) => fn.node as { id: string; content: string; type: string; created_at: string })
    .filter(Boolean)

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-purple-500/[0.01] blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-4 py-3">
        <Link href="/home" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">
          &larr; back
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 space-y-8 relative z-10">
        <FolderDetail folder={folder} nodes={nodes} />
      </main>
    </div>
  )
}
