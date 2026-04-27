'use client'

import { SelectionProvider } from './SelectionContext'
import { useSelection } from './SelectionContext'
import { GraphNavigationProvider } from './GraphNavigationContext'
import KnowledgeGraph from './KnowledgeGraph'
import GraphSidebar from './GraphSidebar'

interface GraphWithPanelProps {
  nodes: Array<{ id: string; content: string; type: string; created_at: string }>
  edges: Array<{ from_node_id: string; to_node_id: string; relationship: string; strength: number }>
  folders: Array<{ id: string; name: string }>
  folderNodes: Array<{ folder_id: string; node_id: string }>
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

export default function GraphWithPanel({ nodes, edges, folders, folderNodes }: GraphWithPanelProps) {
  const fullNodes = nodes.map(n => ({ ...n, weight: 1, input_id: null }))
  return (
    <SelectionProvider initialNodes={fullNodes} initialEdges={edges} initialInputs={[]}>
      <GraphNavigationProvider nodes={nodes} edges={edges}>
        <div className="flex-1 flex overflow-hidden">
          <GraphSidebarWrapper nodes={nodes} edges={edges} />
          <GraphCanvas nodes={nodes} edges={edges} folders={folders} folderNodes={folderNodes} />
        </div>
      </GraphNavigationProvider>
    </SelectionProvider>
  )
}
