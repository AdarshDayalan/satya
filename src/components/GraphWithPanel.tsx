'use client'

import { SelectionProvider } from './SelectionContext'
import { useSelection } from './SelectionContext'
import { GraphNavigationProvider, useGraphNavigation } from './GraphNavigationContext'
import KnowledgeGraph from './KnowledgeGraph'
import GraphSidebar from './GraphSidebar'
import SidePanel from './SidePanel'

interface GraphWithPanelProps {
  nodes: Array<{ id: string; content: string; type: string; created_at: string; input_id?: string | null; source_url?: string | null; perspectives?: string[] }>
  edges: Array<{ from_node_id: string; to_node_id: string; relationship: string; strength: number; reason?: string }>
  folders: Array<{ id: string; name: string }>
  folderNodes: Array<{ folder_id: string; node_id: string }>
  inputs?: Array<{ id: string; raw_content: string; source_type: string; source_metadata: Record<string, unknown>; status: string; created_at: string }>
}

function GraphCanvas({ nodes, edges, folders, folderNodes }: GraphWithPanelProps) {
  const { select } = useSelection()

  return (
    <div className="flex-1 relative">
      <div className="absolute inset-0">
        <KnowledgeGraph
          nodes={nodes}
          edges={edges}
          folders={folders}
          folderNodes={folderNodes}
          fullscreen
          onNodeClick={(id) => select('node', id)}
        />
      </div>
    </div>
  )
}

function GraphSidebarWrapper({ nodes, edges }: { nodes: GraphWithPanelProps['nodes']; edges: GraphWithPanelProps['edges'] }) {
  const { select } = useSelection()
  return (
    <GraphSidebar
      nodes={nodes}
      edges={edges}
      onNodeDetail={(id) => select('node', id)}
    />
  )
}

// Right detail panel — opens when something is selected (e.g., via double-click on canvas).
function DetailPanelWrapper({ allNodes }: { allNodes: Array<{ id: string; content: string; type: string }> }) {
  const { selection, select, clearSelection } = useSelection()
  const { pushFocus } = useGraphNavigation()
  if (!selection) return null
  // Clicking a connection in the panel should ALSO move the graph view there — same effect as
  // clicking the node on the canvas. We push focus on the graph and update the selected detail node.
  const navigate = (kind: 'node' | 'input', id: string) => {
    if (kind === 'node') pushFocus(id)
    select(kind, id)
  }
  return (
    <SidePanel
      key={`${selection.type}-${selection.id}`}
      type={selection.type}
      id={selection.id}
      onClose={clearSelection}
      onNavigate={navigate}
      allNodes={allNodes}
    />
  )
}

export default function GraphWithPanel({ nodes, edges, folders, folderNodes, inputs = [] }: GraphWithPanelProps) {
  const fullNodes = nodes.map(n => ({ ...n, weight: 1, input_id: n.input_id ?? null }))
  const allNodes = nodes.map(n => ({ id: n.id, content: n.content, type: n.type }))
  return (
    <SelectionProvider initialNodes={fullNodes} initialEdges={edges} initialInputs={inputs}>
      <GraphNavigationProvider nodes={nodes} edges={edges}>
        <div className="flex-1 flex overflow-hidden">
          <GraphSidebarWrapper nodes={nodes} edges={edges} />
          <GraphCanvas nodes={nodes} edges={edges} folders={folders} folderNodes={folderNodes} />
          <DetailPanelWrapper allNodes={allNodes} />
        </div>
      </GraphNavigationProvider>
    </SelectionProvider>
  )
}
