'use client'

import KnowledgeGraph from './KnowledgeGraph'

interface FullGraphProps {
  nodes: Array<{ id: string; content: string; type: string; created_at: string }>
  edges: Array<{ from_node_id: string; to_node_id: string; relationship: string; strength: number }>
  folders: Array<{ id: string; name: string }>
  folderNodes: Array<{ folder_id: string; node_id: string }>
}

export default function FullGraph({ nodes, edges, folders, folderNodes }: FullGraphProps) {
  return (
    <div className="absolute inset-0">
      <KnowledgeGraph
        nodes={nodes}
        edges={edges}
        folders={folders}
        folderNodes={folderNodes}
        fullscreen
      />
    </div>
  )
}
