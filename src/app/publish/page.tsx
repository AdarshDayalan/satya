import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PublishManager from '@/components/PublishManager'

export default async function PublishPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: nodes }, { data: folders }] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('nodes').select('id, content, type, created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('folders').select('id, name, description, created_at').order('created_at', { ascending: false }).limit(50),
  ])

  let publishedNodeIds: string[] = []
  let publishedFolderIds: string[] = []

  if (profile) {
    const [{ data: pn }, { data: pf }] = await Promise.all([
      supabase.from('published_nodes').select('node_id').eq('profile_id', profile.id),
      supabase.from('published_folders').select('folder_id').eq('profile_id', profile.id),
    ])
    publishedNodeIds = (pn ?? []).map((r) => r.node_id)
    publishedFolderIds = (pf ?? []).map((r) => r.folder_id)
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-white/[0.01] blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-4 py-3 flex items-center justify-between">
        <Link href="/home" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">
          &larr; back
        </Link>
        {profile?.slug && (
          <Link
            href={`/s/${profile.slug}`}
            className="text-[12px] text-purple-400/60 hover:text-purple-400 transition-colors"
          >
            view public profile &rarr;
          </Link>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 relative z-10">
        <PublishManager
          profile={profile}
          nodes={nodes ?? []}
          folders={folders ?? []}
          publishedNodeIds={publishedNodeIds}
          publishedFolderIds={publishedFolderIds}
        />
      </main>
    </div>
  )
}
