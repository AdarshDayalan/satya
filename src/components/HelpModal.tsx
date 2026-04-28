'use client'

import { useState } from 'react'
import Portal from './Portal'

const SECTIONS = [
  'overview',
  'input',
  'nodes',
  'graph',
  'evidence-rank',
  'perspectives',
  'sources',
  'self',
  'folders',
  'spaces',
  'shortcuts',
] as const

type Section = (typeof SECTIONS)[number]

const SECTION_LABELS: Record<Section, string> = {
  overview: 'What is Satya?',
  input: 'The Input Box',
  nodes: 'Node Types',
  graph: 'The Graph',
  'evidence-rank': 'EvidenceRank',
  perspectives: 'Perspectives',
  sources: 'Source Trust',
  self: 'Self Nodes',
  folders: 'Folders',
  spaces: 'Spaces',
  shortcuts: 'Shortcuts & Tips',
}

export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [section, setSection] = useState<Section>('overview')

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-[101] bg-[#0a0a0a] border border-white/[0.08] rounded-2xl w-full max-w-2xl mx-4 shadow-2xl flex overflow-hidden" style={{ maxHeight: 'calc(100vh - 4rem)' }}>

          {/* Sidebar nav */}
          <nav className="w-44 shrink-0 border-r border-white/[0.06] py-4 overflow-y-auto">
            <div className="px-4 pb-3">
              <h2 className="text-[13px] text-white/80 font-medium">Help</h2>
              <p className="text-[10px] text-neutral-600 mt-0.5">learn how Satya works</p>
            </div>
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`w-full text-left px-4 py-1.5 text-[12px] transition-colors ${
                  section === s
                    ? 'text-white/80 bg-white/[0.06]'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]'
                }`}
              >
                {SECTION_LABELS[s]}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] text-white/90 font-medium">{SECTION_LABELS[section]}</h3>
              <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 text-[11px]">close</button>
            </div>

            {section === 'overview' && <OverviewSection />}
            {section === 'input' && <InputSection />}
            {section === 'nodes' && <NodesSection />}
            {section === 'graph' && <GraphSection />}
            {section === 'evidence-rank' && <EvidenceRankSection />}
            {section === 'perspectives' && <PerspectivesSection />}
            {section === 'sources' && <SourcesSection />}
            {section === 'self' && <SelfSection />}
            {section === 'folders' && <FoldersSection />}
            {section === 'spaces' && <SpacesSection />}
            {section === 'shortcuts' && <ShortcutsSection />}
          </div>
        </div>
      </div>
    </Portal>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-white/60 leading-relaxed">{children}</p>
}

function H4({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[12px] text-white/80 font-medium uppercase tracking-wider mt-4 mb-1">{children}</h4>
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full border ${color}`}>{children}</span>
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/60 font-mono">{children}</kbd>
}

function Def({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[12px] text-white/70 w-24 shrink-0 font-medium">{term}</span>
      <span className="text-[12px] text-white/50 flex-1">{children}</span>
    </div>
  )
}

function OverviewSection() {
  return (
    <>
      <P>
        Satya is your personal knowledge graph. Drop anything into it — journal entries, YouTube links, research papers, Reddit threads, articles — and the AI extracts the core ideas, finds connections between them, and ranks everything by how well-supported it is.
      </P>
      <P>
        It&apos;s not a note-taking app. It&apos;s a thinking tool that surfaces patterns you&apos;d miss. When the same truth shows up independently across neuroscience, ancient philosophy, and athletic training — Satya finds that convergence and ranks it higher.
      </P>
      <H4>How it works</H4>
      <div className="space-y-2">
        <Def term="1. Drop">Paste a URL, write a journal entry, or dictate via voice. Satya detects the source type automatically.</Def>
        <Def term="2. Extract">AI extracts 5-15 idea nodes from your input — concepts, evidence, mechanisms, questions.</Def>
        <Def term="3. Connect">Each new node is compared against your existing graph. The AI finds relationships: supports, contradicts, causes, refines, etc.</Def>
        <Def term="4. Rank">EvidenceRank propagates weight through the graph. Ideas with more evidence from diverse perspectives rise to the top.</Def>
        <Def term="5. Discover">The graph reveals convergent truths — patterns that appear across multiple domains and sources.</Def>
      </div>
      <H4>Philosophy</H4>
      <P>
        The most important truths aren&apos;t found in any single paper or authority. They emerge when multiple independent perspectives — evolutionary biology, contemplative traditions, athletic performance, historical patterns — converge on the same insight. Satya is built to find those convergences.
      </P>
    </>
  )
}

function InputSection() {
  return (
    <>
      <P>The input box is the front door to your graph. It handles everything from quick links to long journal entries.</P>
      <H4>What you can drop</H4>
      <div className="space-y-2">
        <Def term="URLs">YouTube, Reddit, PubMed, articles, blogs, tweets — auto-detected and enriched (transcripts, full text, etc.)</Def>
        <Def term="Journal entries">Write freely in markdown. Click &quot;expand to journal&quot; for a full editor. Your own thinking gets source type &quot;journal&quot;.</Def>
        <Def term="Bulk paste">Multiple URLs on separate lines get processed individually as separate sources.</Def>
        <Def term="Voice">Click the mic button to dictate. Transcription happens in real-time.</Def>
      </div>
      <H4>Connection Hint</H4>
      <P>
        When writing a journal entry, click &quot;connection hint&quot; to tell the AI what patterns you&apos;re noticing. For example: &quot;relates to flow state, dopamine, ancient training&quot;. This biases the AI to look harder for connections to those topics in your existing graph.
      </P>
      <H4>Processing flow</H4>
      <P>
        Your input is saved instantly (you can keep working), then processed in the background. You&apos;ll see a status line showing progress: captured → extracting meaning → done with node/edge counts.
      </P>
    </>
  )
}

function NodesSection() {
  return (
    <>
      <P>Nodes are the atomic units of your knowledge graph. Each one is a single, complete claim or fact — not a label, not a vague topic.</P>
      <H4>Types</H4>
      <div className="space-y-2">
        <Def term={<><Pill color="text-pink-400/60 bg-pink-400/10 border-pink-400/20">concept</Pill></>}>
          A core truth claim or principle about the world. The most important type — these are what evidence flows toward.
        </Def>
        <Def term={<><Pill color="text-blue-400/60 bg-blue-400/10 border-blue-400/20">idea</Pill></>}>
          A specific insight, recommendation, or conclusion. More actionable than a concept.
        </Def>
        <Def term={<><Pill color="text-cyan-400/60 bg-cyan-400/10 border-cyan-400/20">evidence</Pill></>}>
          A study finding, statistic, or data point. Flows weight upward to the claims it supports.
        </Def>
        <Def term={<><Pill color="text-amber-400/60 bg-amber-400/10 border-amber-400/20">mechanism</Pill></>}>
          How something works — a causal pathway (A causes B causes C). Explains the &quot;why&quot; behind claims.
        </Def>
        <Def term={<><Pill color="text-amber-400/60 bg-amber-400/10 border-amber-400/20">question</Pill></>}>
          An unresolved question worth tracking. Gaps in your understanding.
        </Def>
        <Def term={<><Pill color="text-violet-300/80 bg-violet-400/10 border-violet-400/20">self</Pill></>}>
          A fragment of your inner life — values, intentions, recurring thoughts. Only extracted from journal entries. See &quot;Self Nodes&quot; section.
        </Def>
      </div>
      <H4>Good vs bad nodes</H4>
      <P>
        Good: &quot;Chronic sun avoidance increases all-cause mortality more than moderate UV exposure&quot; (complete, specific, stands alone).
      </P>
      <P>
        Bad: &quot;Sun health&quot; (too vague — that&apos;s a topic label, not a truth claim).
      </P>
    </>
  )
}

function GraphSection() {
  return (
    <>
      <P>The graph is where your ideas become visible as a network. Node size = how well-supported an idea is. Bigger nodes have more evidence flowing into them.</P>
      <H4>Navigation</H4>
      <div className="space-y-2">
        <Def term="Click a node">Focus on it — see its connections, children expand around it.</Def>
        <Def term="Click again">Drill deeper — the node becomes the new center.</Def>
        <Def term="Back button / Esc">Go back up the focus stack.</Def>
        <Def term="Arrow keys">Cycle through sibling nodes at the current depth.</Def>
      </div>
      <H4>Creating connections</H4>
      <P>
        Hold <Kbd>Shift</Kbd> and drag from one node to another. A panel appears to pick the relationship type and strength. The AI will auto-suggest the best relationship.
      </P>
      <H4>Layout modes</H4>
      <div className="space-y-2">
        <Def term="Organic">Physics-based layout. Nodes cluster naturally by their connections.</Def>
        <Def term="Hierarchy">Column-based layout showing depth. Higher concepts on the left, supporting evidence cascades right.</Def>
      </div>
      <H4>Filter modes</H4>
      <div className="space-y-2">
        <Def term="All">Show everything visible at the current focus level.</Def>
        <Def term="Concepts">Filter to concept nodes only — see just the big ideas.</Def>
        <Def term="Evidence">Trace all evidence supporting the focused claim — follows supports/evidence_for edges upstream.</Def>
      </div>
      <H4>Search</H4>
      <P>Press <Kbd>Cmd+K</Kbd> to search nodes by content. Filter by type. Click a result to navigate to it in the graph.</P>
    </>
  )
}

function EvidenceRankSection() {
  return (
    <>
      <P>
        EvidenceRank is like PageRank, but for ideas. It computes how well-supported each idea is by propagating weight through the connection graph. Evidence and supporting nodes flow their weight upward toward the claims they support.
      </P>
      <H4>How weight flows</H4>
      <div className="space-y-2">
        <Def term="evidence_for">Full weight (1.0x) — direct evidence for a claim</Def>
        <Def term="supports">Strong flow (0.9x) — general support</Def>
        <Def term="mechanism_of">Strong flow (0.85x) — explains how it works</Def>
        <Def term="causes">Good flow (0.8x) — causal relationship</Def>
        <Def term="example_of">Moderate flow (0.7x) — specific instance of a general claim</Def>
        <Def term="refines">Some flow (0.5x) — adds nuance</Def>
        <Def term="similar">Weak flow (0.3x) — related but distinct</Def>
        <Def term="contradicts">Negative flow (-0.3x) — reduces weight of the target</Def>
      </div>
      <H4>Source credibility</H4>
      <P>
        A node&apos;s base weight depends on where it came from. PubMed papers start at 1.5x, your journal at 1.0x, a TikTok at 0.35x. You can customize these weights in Settings → Source Trust.
      </P>
      <H4>Convergence bonus</H4>
      <P>
        This is the most important part. When an idea is supported by evidence from diverse perspectives — for example, neuroscience AND ancient philosophy AND athletic training — it gets a convergence multiplier:
      </P>
      <div className="space-y-1 mt-2">
        <Def term="2 perspectives">1.2x boost</Def>
        <Def term="3 perspectives">1.5x boost</Def>
        <Def term="4 perspectives">1.8x boost</Def>
        <Def term="5+ perspectives">2.0x boost</Def>
      </div>
      <P>
        This means a journal entry synthesizing flow state across spirituality + athletics + neuroscience + history (4 perspectives, 1.8x) can outrank a single PubMed paper (1.5 base, 1 perspective).
      </P>
    </>
  )
}

function PerspectivesSection() {
  return (
    <>
      <P>
        Every idea gets tagged with the domain lenses it draws from. These are hard-to-fake truth signals — when they converge, it&apos;s a strong indicator of something real.
      </P>
      <H4>The 14 lenses</H4>
      <div className="space-y-2">
        <Def term="evolutionary">Natural selection, adaptation, what survived millions of years</Def>
        <Def term="historical">Patterns across civilizations, what persisted through time</Def>
        <Def term="scientific">Peer-reviewed research, controlled experiments, measurable data</Def>
        <Def term="anecdotal">Personal experience, case studies, first-hand accounts</Def>
        <Def term="economic">Market forces, business incentives, what people pay for</Def>
        <Def term="geographical">Patterns across cultures/regions, environmental influence</Def>
        <Def term="spiritual">Contemplative traditions, meditation, consciousness, ancient wisdom</Def>
        <Def term="athletic">Physical performance, training, embodied knowledge</Def>
        <Def term="psychological">Cognition, behavior, mental models, clinical observation</Def>
        <Def term="philosophical">Logic, ethics, epistemology, first-principles reasoning</Def>
        <Def term="biological">Mechanisms of life, physiology, health, nutrition</Def>
        <Def term="ecological">Natural systems, ecosystems, environmental patterns</Def>
        <Def term="cultural">Art, music, storytelling, collective human expression</Def>
        <Def term="technological">Engineering, tools, systems design</Def>
      </div>
      <H4>Why these matter</H4>
      <P>
        Evolution can&apos;t be faked. Historical patterns across independent civilizations can&apos;t be gamed. Free market behavior reveals real preferences. When the same insight emerges independently across these lenses, the convergence IS the truth signal.
      </P>
    </>
  )
}

function SourcesSection() {
  return (
    <>
      <P>
        Satya auto-detects what kind of source your input comes from, and assigns a trust tier. The AI also classifies ambiguous sources by reading the actual content.
      </P>
      <H4>Source types & trust tiers</H4>
      <div className="space-y-1 mt-2">
        {[
          { name: 'PubMed', score: '1.5', tier: 'peer-reviewed', color: 'text-green-400/70' },
          { name: 'Research paper', score: '1.4', tier: 'peer-reviewed', color: 'text-green-400/70' },
          { name: 'Government', score: '1.3', tier: 'institutional', color: 'text-teal-400/70' },
          { name: 'Book', score: '1.2', tier: 'editorial', color: 'text-blue-400/60' },
          { name: 'Journal (yours)', score: '1.0', tier: 'personal', color: 'text-white/40' },
          { name: 'Wikipedia', score: '0.9', tier: 'institutional', color: 'text-teal-400/70' },
          { name: 'Article', score: '0.8', tier: 'editorial', color: 'text-blue-400/60' },
          { name: 'Newsletter', score: '0.75', tier: 'editorial', color: 'text-blue-400/60' },
          { name: 'Podcast', score: '0.65', tier: 'media', color: 'text-amber-400/60' },
          { name: 'YouTube', score: '0.6', tier: 'media', color: 'text-amber-400/60' },
          { name: 'Blog', score: '0.6', tier: 'media', color: 'text-amber-400/60' },
          { name: 'Reddit', score: '0.5', tier: 'community', color: 'text-orange-400/60' },
          { name: 'Twitter / X', score: '0.45', tier: 'social', color: 'text-pink-400/60' },
          { name: 'Instagram', score: '0.4', tier: 'social', color: 'text-pink-400/60' },
          { name: 'TikTok', score: '0.35', tier: 'social', color: 'text-pink-400/60' },
        ].map(s => (
          <div key={s.name} className="flex items-center gap-2 text-[12px]">
            <span className="text-white/60 w-28">{s.name}</span>
            <span className={`w-20 ${s.color}`}>{s.tier}</span>
            <span className="text-neutral-600 font-mono">{s.score}</span>
          </div>
        ))}
      </div>
      <H4>Customizing trust</H4>
      <P>
        Go to Settings → Source Trust to adjust these weights with sliders. Your overrides apply to EvidenceRank calculations across the entire graph. Reset individual types or all at once.
      </P>
    </>
  )
}

function SelfSection() {
  return (
    <>
      <P>
        Self nodes are different from everything else in your graph. They&apos;re not claims about the world — they&apos;re fragments of who you are. Your values, intentions, recurring thoughts, what inspires you, what you&apos;re afraid of.
      </P>
      <H4>How they work</H4>
      <P>
        When you write journal entries, the AI detects first-person introspective content and extracts it as &quot;self&quot; type nodes. Signals: &quot;I want&quot;, &quot;I&apos;m drawn to&quot;, &quot;I keep thinking about&quot;, &quot;what matters to me&quot;.
      </P>
      <H4>Promotion</H4>
      <P>
        When the AI notices a pattern recurring across multiple journal entries — something you keep returning to — it promotes those fragments into a consolidated self node. This only happens when there&apos;s clear evidence of a recurring pattern (confidence threshold: 0.6).
      </P>
      <H4>What self nodes are NOT</H4>
      <P>
        They&apos;re not truth claims about the world (those are concepts). They&apos;re not one-off thoughts. They represent the stable patterns in your inner life — the things that keep surfacing.
      </P>
    </>
  )
}

function FoldersSection() {
  return (
    <>
      <P>Folders group related nodes together. They come in two flavors.</P>
      <H4>Favorites (user-created)</H4>
      <P>
        Create your own folders with the + button in the Explorer sidebar. Save nodes to favorites using the star icon on any node&apos;s detail panel. Rename or delete by hovering the folder name or right-clicking.
      </P>
      <H4>Themes (AI-generated)</H4>
      <P>
        When the AI processes your input and detects a cluster of 3+ connected nodes sharing a clear topic, it automatically creates a theme folder. If the cluster matches an existing theme (40%+ overlap), the AI adds to it rather than creating a duplicate.
      </P>
      <H4>Multi-select</H4>
      <P>
        Click the grid icon in the Explorer header to enter multi-select mode. Check nodes and sources, then bulk move to a folder or delete.
      </P>
      <H4>Cleanup</H4>
      <P>
        The Explorer sidebar shows a &quot;cleanup&quot; section at the bottom with disconnected nodes (no edges). You can delete them individually or prune all at once.
      </P>
    </>
  )
}

function SpacesSection() {
  return (
    <>
      <P>
        Spaces let you curate a subset of your graph into a shareable narrative. Pick ideas, set weights to control emphasis, and publish via a link.
      </P>
      <H4>Creating a space</H4>
      <P>
        Click Spaces in the nav → &quot;+ new space&quot;. Give it a name and description. Then add ideas using the toolbar: browse by hierarchy tree, add individual nodes, bulk add by source, or add entire folders.
      </P>
      <H4>Cascade view</H4>
      <P>
        Ideas in a space are ranked by combined weight (EvidenceRank multiplied by your custom weight). Hover to adjust weights with +/- buttons. The bar visualization shows relative importance.
      </P>
      <H4>Publishing</H4>
      <P>
        Toggle &quot;publish&quot; to make a space public. Copy the shareable link. Anyone with the link can see your curated ideas — your knowledge as a narrative, not a flat document.
      </P>
    </>
  )
}

function ShortcutsSection() {
  return (
    <>
      <H4>Global</H4>
      <div className="space-y-2">
        <Def term={<Kbd>Cmd+K</Kbd>}>Open node search in the graph</Def>
        <Def term={<Kbd>Esc</Kbd>}>Close panels, go back in graph, dismiss modals</Def>
      </div>
      <H4>Input Box</H4>
      <div className="space-y-2">
        <Def term={<Kbd>Cmd+Enter</Kbd>}>Submit / process input</Def>
        <Def term="Expand">Click &quot;expand to journal&quot; for full markdown editor</Def>
        <Def term="Voice">Click mic button to dictate, click again to stop</Def>
      </div>
      <H4>Graph</H4>
      <div className="space-y-2">
        <Def term="Click node">Focus on it, expand connections</Def>
        <Def term="Double-click">Open node detail panel</Def>
        <Def term={<Kbd>Shift + drag</Kbd>}>Draw a connection between two nodes</Def>
        <Def term={<><Kbd>Left</Kbd> <Kbd>Right</Kbd></>}>Cycle through sibling nodes</Def>
        <Def term={<Kbd>Backspace</Kbd>}>Go back / pop focus</Def>
        <Def term="Scroll / pinch">Zoom in/out</Def>
        <Def term="Drag canvas">Pan the view</Def>
      </div>
      <H4>Explorer</H4>
      <div className="space-y-2">
        <Def term="Right-click folder">Rename or delete</Def>
        <Def term="Hover folder">Edit/delete icons appear</Def>
        <Def term="Grid icon">Toggle multi-select mode</Def>
      </div>
      <H4>Tips</H4>
      <div className="space-y-2">
        <Def term="Connection hints">When journaling, use the hint field to tell the AI what patterns you&apos;re noticing — it looks harder for those connections</Def>
        <Def term="Diverse sources">Drop the same topic from different angles (paper + podcast + journal) — the convergence bonus makes ideas with diverse support rise naturally</Def>
        <Def term="Journal often">Your journal entries (1.0 trust) can outrank papers (1.5 trust) when they synthesize across 3+ perspectives due to the convergence multiplier</Def>
        <Def term="Evidence mode">In the graph, use the Evidence filter to trace ALL upstream evidence supporting a focused claim</Def>
      </div>
    </>
  )
}
