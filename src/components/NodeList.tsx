import Link from 'next/link'

interface Node {
  id: string
  content: string
  type: string
  created_at: string
}

export default function NodeList({ nodes }: { nodes: Node[] }) {
  if (nodes.length === 0) {
    return (
      <p className="text-neutral-500 text-sm text-center">
        No nodes yet. Drop something in to get started.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
        Recent Nodes
      </h2>
      {nodes.map((node) => (
        <Link
          key={node.id}
          href={`/nodes/${node.id}`}
          className="block bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 hover:border-neutral-600 transition"
        >
          <p className="text-white text-sm">{node.content}</p>
          <p className="text-neutral-500 text-xs mt-1">
            {node.type} · {new Date(node.created_at).toLocaleDateString()}
          </p>
        </Link>
      ))}
    </div>
  )
}
