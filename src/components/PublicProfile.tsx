'use client'

import { useState } from 'react'
import KnowledgeGraph from './KnowledgeGraph'

interface Profile {
  display_name: string
  bio: string
  slug: string
}

interface Node {
  id: string
  content: string
  type: string
  input_id: string | null
  created_at: string
}

interface Edge {
  from_node_id: string
  to_node_id: string
  relationship: string
  strength: number
}

interface Folder {
  id: string
  name: string
  description: string | null
}

const typeColors: Record<string, string> = {
  idea: 'text-blue-400/60',
  question: 'text-amber-400/60',
  source: 'text-green-400/60',
  synthesis: 'text-purple-400/60',
  raw: 'text-neutral-500',
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  journal: { label: 'journal', color: 'text-white/40' },
  youtube: { label: 'YouTube', color: 'text-red-400' },
  instagram: { label: 'Instagram', color: 'text-pink-400' },
  article: { label: 'article', color: 'text-blue-400' },
  research_paper: { label: 'paper', color: 'text-green-400' },
  reddit: { label: 'Reddit', color: 'text-orange-400' },
  pubmed: { label: 'PubMed', color: 'text-cyan-400' },
}

const TABS = [
  { key: 'graph', label: 'graph' },
  { key: 'browse', label: 'browse' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function PublicProfile({
  profile,
  nodes,
  edges,
  folders,
  inputs,
}: {
  profile: Profile
  nodes: Node[]
  edges: Edge[]
  folders: Folder[]
  inputs: Record<string, { source_type: string; source_metadata: Record<string, unknown> }>
}) {
  const [tab, setTab] = useState<TabKey>('graph')
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-purple-500/[0.015] blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/80 border-b border-white/[0.04] px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-light tracking-tight text-white/90">{profile.display_name}</h1>
              {profile.bio && (
                <p className="text-[13px] text-neutral-500 mt-0.5">{profile.bio}</p>
              )}
            </div>
            <div className="text-right">
              <span className="text-[11px] text-purple-400/40 font-medium tracking-widest uppercase">Satya</span>
              <p className="text-[10px] text-neutral-700 mt-0.5">{nodes.length} nodes · {edges.length} connections</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 relative z-10">
        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedNode(null) }}
              className={`px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest rounded-lg border transition-all ${
                tab === t.key
                  ? 'border-white/10 text-white/80 bg-white/[0.06]'
                  : 'border-transparent text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Graph tab */}
        {tab === 'graph' && (
          <div className="space-y-4">
            <KnowledgeGraph nodes={nodes} edges={edges} folders={[]} folderNodes={[]} />
            <p className="text-[11px] text-neutral-700 text-center">
              click a node in the browse tab to explore
            </p>
          </div>
        )}

        {/* Browse tab */}
        {tab === 'browse' && (
          <div className="space-y-8">
            {/* Folders */}
            {folders.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1 mb-3">
                  Themes
                </h2>
                <div className="space-y-1.5">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="theme-card block border border-white/[0.04] rounded-xl px-4 py-3"
                    >
                      <p className="text-white/80 text-[14px] font-medium">{folder.name}</p>
                      {folder.description && (
                        <p className="text-neutral-600 text-[12px] mt-1 leading-relaxed">{folder.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nodes */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest px-1 mb-3">
                Fragments
              </h2>
              <div className="space-y-1.5 stagger-children">
                {nodes.map((node) => {
                  const inputInfo = node.input_id ? inputs[node.input_id] : null
                  const sourceConfig = SOURCE_LABELS[inputInfo?.source_type || 'journal'] || SOURCE_LABELS.journal

                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                      className={`w-full text-left node-card block border rounded-xl px-4 py-3 transition-all ${
                        selectedNode?.id === node.id
                          ? 'border-purple-400/20 bg-purple-400/[0.04]'
                          : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <p className="text-white/80 text-[14px] leading-relaxed">{node.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[11px] ${typeColors[node.type] || 'text-neutral-600'}`}>
                          {node.type}
                        </span>
                        <span className="text-neutral-800">·</span>
                        <span className={`text-[10px] ${sourceConfig.color}`}>
                          {sourceConfig.label}
                        </span>
                        {inputInfo?.source_metadata?.title ? (
                          <>
                            <span className="text-neutral-800">·</span>
                            <span className="text-[10px] text-neutral-600 truncate max-w-[200px]">
                              {String(inputInfo.source_metadata.title)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected node detail */}
            {selectedNode && (
              <div className="animate-fade-up bg-white/[0.02] border border-purple-400/10 rounded-2xl px-5 py-4 space-y-3">
                <p className="text-white/90 text-[15px] leading-relaxed">{selectedNode.content}</p>
                {(() => {
                  const inputInfo = selectedNode.input_id ? inputs[selectedNode.input_id] : null
                  if (!inputInfo) return null
                  const meta = inputInfo.source_metadata
                  return (
                    <div className="space-y-1 pt-2 border-t border-white/[0.04]">
                      <p className="text-[11px] text-neutral-600 uppercase tracking-widest">source</p>
                      {meta.title ? <p className="text-[13px] text-white/70">{String(meta.title)}</p> : null}
                      {meta.author ? <p className="text-[12px] text-neutral-500">{String(meta.author)}</p> : null}
                      {meta.authors ? <p className="text-[12px] text-neutral-500">{String(meta.authors)}</p> : null}
                      {meta.url ? (
                        <a
                          href={String(meta.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-400/60 hover:text-blue-400 transition-colors"
                        >
                          {String(meta.url)}
                        </a>
                      ) : null}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
