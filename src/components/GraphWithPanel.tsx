'use client'

import { SelectionProvider } from './SelectionContext'
import { useSelection } from './SelectionContext'
import KnowledgeGraph from './KnowledgeGraph'

interface GraphWithPanelProps {
  nodes: Array<{ id: string; content: string; type: string; created_at: string }>
  edges: Array<{ from_node_id: string; to_node_id: string; relationship: string; strength: number }>
  folders: Array<{ id: string; name: string }>
  folderNodes: Array<{ folder_id: string; node_id: string }>
}

function GraphCanvas({ nodes, edges, folders, folderNodes }: GraphWithPanelProps) {
  const { select } = useSelection()

  return (
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
  )
}

export default function GraphWithPanel({ nodes, edges, folders, folderNodes }: GraphWithPanelProps) {
  const fullNodes = nodes.map(n => ({ ...n, weight: 1, input_id: null }))
  return (
    <SelectionProvider initialNodes={fullNodes} initialEdges={edges} initialInputs={[]}>
      <div className="flex-1 relative">
        <GraphCanvas nodes={nodes} edges={edges} folders={folders} folderNodes={folderNodes} />
      </div>
    </SelectionProvider>
  )
}
