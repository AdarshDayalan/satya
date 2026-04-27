'use client'

import { useState } from 'react'
import Link from 'next/link'
import ProcessingQueue from './ProcessingQueue'
import SpacesPanel from './SpacesPanel'
import KnowledgeGraph from './KnowledgeGraph'
import SidePanel from './SidePanel'
import { useSelection } from './SelectionContext'

type NavKey = 'home' | 'graph' | 'files' | 'publish'

interface AppShellProps {
  children: React.ReactNode
  filesPanel: React.ReactNode
  headerActions?: React.ReactNode
  graphData?: {
    nodes: Array<{ id: string; content: string; type: string; weight?: number; created_at: string }>
    edges: Array<{ from_node_id: string; to_node_id: string; relationship: string; strength: number }>
    folders: Array<{ id: string; name: string }>
    folderNodes: Array<{ folder_id: string; node_id: string }>
  }
}

export default function AppShell({ children, filesPanel, headerActions, graphData }: AppShellProps) {
  const { selection, select, clearSelection, store } = useSelection()
  const [activeNav, setActiveNav] = useState<NavKey>('home')
  const allNodes = Array.from(store.nodes.values()).map(n => ({ id: n.id, content: n.content, type: n.type }))

  function handleNav(key: NavKey) {
    setActiveNav(key === activeNav ? 'home' : key)
  }

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-white/[0.01] blur-3xl pointer-events-none" />

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Icon rail */}
        <nav className="w-11 shrink-0 bg-[#080808] border-r border-white/[0.04] flex flex-col items-center justify-between py-2.5">
          <div className="space-y-0.5">
            <Link href="/home" className="w-8 h-8 flex items-center justify-center mb-3">
              <span className="text-[13px] font-light text-white/80 tracking-tight">S</span>
            </Link>

            <NavButton
              active={activeNav === 'home'}
              onClick={() => handleNav('home')}
              title="Home"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M2 6.5l6-4.5 6 4.5V14H2V6.5z" />
                <path d="M5.5 14V9h5v5" />
              </svg>
            </NavButton>

            <NavButton
              active={activeNav === 'graph'}
              onClick={() => handleNav('graph')}
              title="Graph"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="8" cy="4" r="1.5" />
                <circle cx="3.5" cy="12" r="1.5" />
                <circle cx="12.5" cy="12" r="1.5" />
                <path d="M7 5.5L4.5 10.5M9 5.5L11.5 10.5M5 12h6" />
              </svg>
            </NavButton>

            <NavButton
              active={activeNav === 'files'}
              onClick={() => handleNav('files')}
              title="Files"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M1.5 4.5V13.5H14.5V4.5H1.5Z" />
                <path d="M1.5 4.5L3.5 2.5H7L8.5 4.5" />
              </svg>
            </NavButton>

            <NavButton
              active={activeNav === 'publish'}
              onClick={() => handleNav('publish')}
              title="Spaces"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="8" cy="8" r="6" />
                <path d="M5 8l2 2 4-4" />
              </svg>
            </NavButton>
          </div>

          {/* Bottom */}
          <div className="space-y-0.5">
            {headerActions}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-700 hover:text-red-400/60 hover:bg-red-400/5 transition-all"
                title="Sign out"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M5 1.5H2.5v11H5M9.5 4l3 3-3 3M6 7h6.5" />
                </svg>
              </button>
            </form>
          </div>
        </nav>

        {/* Main content area — switches based on active nav */}
        {activeNav === 'graph' && graphData ? (
          <div className="flex-1 overflow-hidden bg-[#050505]">
            <KnowledgeGraph
              nodes={graphData.nodes}
              edges={graphData.edges}
              folders={graphData.folders}
              folderNodes={graphData.folderNodes}
            />
          </div>
        ) : activeNav === 'files' ? (
          <div className="flex-1 flex overflow-hidden bg-[#080808]">
            <div className="w-56 shrink-0 overflow-y-auto">
              <ProcessingQueue />
              {filesPanel}
            </div>
            {selection ? (
              <SidePanel
                key={`${selection.type}-${selection.id}`}
                type={selection.type}
                id={selection.id}
                onClose={clearSelection}
                onNavigate={select}
                allNodes={allNodes}
                fullWidth
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-neutral-700 text-[13px]">select a source or idea to view details</p>
              </div>
            )}
          </div>
        ) : activeNav === 'publish' ? (
          <div className="flex-1 overflow-y-auto bg-[#080808]">
            <SpacesPanel />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
            {selection && (
              <SidePanel
                key={`${selection.type}-${selection.id}`}
                type={selection.type}
                id={selection.id}
                onClose={clearSelection}
                onNavigate={select}
                allNodes={allNodes}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function NavButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
        active
          ? 'bg-white/[0.08] text-white/80'
          : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04]'
      }`}
      title={title}
    >
      {children}
    </button>
  )
}
