import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InputBox from '@/components/InputBox'
import SourceSidebar from '@/components/SourceSidebar'
import HeaderActions from '@/components/HeaderActions'
import AppShell from '@/components/AppShell'
import { SelectionProvider } from '@/components/SelectionContext'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: nodes }, { data: folders }, { data: inputs }, { data: edges }, { data: folderNodesData }] = await Promise.all([
    supabase.from('nodes').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('folders').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('inputs').select('id, raw_content, source_type, source_metadata, status, created_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('edges').select('from_node_id, to_node_id, relationship, strength').limit(2000),
    supabase.from('folder_nodes').select('folder_id, node_id').limit(1000),
  ])

  const allNodes = (nodes ?? []).map((n: { id: string; content: string; type: string }) => ({
    id: n.id, content: n.content, type: n.type,
  }))

  const graphData = {
    nodes: (nodes ?? []).map((n: { id: string; content: string; type: string; weight?: number; created_at: string; input_id?: string }) => ({
      id: n.id, content: n.content, type: n.type, weight: n.weight, created_at: n.created_at, input_id: n.input_id,
    })),
    inputs: (inputs ?? []).map((i: { id: string; source_type: string }) => ({ id: i.id, source_type: i.source_type })),
    edges: edges ?? [],
    folders: (folders ?? []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })),
    folderNodes: folderNodesData ?? [],
  }

  return (
    <SelectionProvider
      initialNodes={nodes ?? []}
      initialEdges={edges ?? []}
      initialInputs={inputs ?? []}
    >
      <AppShell
        filesPanel={
          <SourceSidebar
            inputs={inputs ?? []}
            folders={folders ?? []}
            folderNodes={folderNodesData ?? []}
            nodes={nodes ?? []}
            edges={edges ?? []}
          />
        }
        headerActions={<HeaderActions />}
        graphData={graphData}
      >
        <main className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 2rem)' }}>
          <div className="w-full max-w-xl px-6 space-y-6">
            <InputBox />
          </div>
        </main>
      </AppShell>
    </SelectionProvider>
  )
}
