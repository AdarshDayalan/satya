export const EXTRACT_IDEAS_PROMPT = `You are building a personal knowledge graph. Extract the core claims, mechanisms, and evidence from this text exactly as the author presents them. Do not judge, filter, or editorialize — faithfully capture what the text says.

Input:
{{raw_content}}

Return JSON:
{
  "summary": "one line summary of the overall thesis",
  "source_type": "journal | youtube | article | research_paper | pubmed | reddit | instagram | blog | podcast | book | twitter | tiktok | newsletter | wikipedia | government",
  "nodes": [{ "content": "...", "type": "concept | idea | question | evidence | mechanism | self", "source_url": "https://... or null", "perspectives": ["science", "..."] }]
}

Rules:
- Extract 5-15 nodes depending on density of the input.
- Node content should be a COMPLETE claim or fact — 10-25 words. Not just a label.
  Good: "[specific claim with enough context to stand alone]"
  Bad: "[two vague words]" (too vague to be useful)
- Preserve causal chains: if A causes B causes C, extract all three so connections can form between them.
- Types:
  - "concept" = a core principle or truth claim about the world
  - "idea" = a specific insight, recommendation, or conclusion
  - "question" = an unresolved question
  - "evidence" = a specific study finding, statistic, or data point
  - "mechanism" = a biological, chemical, or causal pathway
  - "self" = anything in the author's own first-person voice about themselves — thoughts, what they're inspired by, what they want to do, intentions, values, fears, what feels true to them, who they're becoming. Use for journal-style introspective writing. Signals: "I want", "I'm drawn to", "I keep thinking about", "what matters to me", "I'm afraid of", "I should", "I am". A self node is NOT an external claim — it's a fragment of the author's inner life.
- If the text contains research citations or data, extract the key findings as "evidence" nodes.
- If the text describes how something works (A → B → C), extract as "mechanism" nodes.
- Do NOT merge nodes that are distinct steps in a causal chain — keep them separate.
- Do NOT add your own opinions or caveats. Extract what the author wrote.
- Quality > quantity, but don't under-extract dense content.
- If the input contains URLs and research context from those URLs, set "source_url" to the specific URL the idea came from. If the idea comes from the user's own writing (not a linked source), set "source_url" to null.
- "perspectives": tag each node with the domain lenses it draws from. Use 1-3 tags per node. These are the key perspectives — hard-to-fake truth signals that converge across domains:
  - evolutionary: natural selection, adaptation, what survived millions of years
  - historical: patterns across civilizations, what persisted through time
  - scientific: peer-reviewed research, controlled experiments, measurable data
  - anecdotal: personal experience, case studies, first-hand accounts
  - economic: market forces, business incentives, what people pay for
  - geographical: patterns across cultures/regions, environmental influence
  - spiritual: contemplative traditions, meditation, consciousness, ancient wisdom
  - athletic: physical performance, training, embodied knowledge
  - psychological: cognition, behavior, mental models, clinical observation
  - philosophical: logic, ethics, epistemology, first-principles reasoning
  - biological: mechanisms of life, physiology, health, nutrition
  - ecological: natural systems, ecosystems, environmental patterns
  - cultural: art, music, storytelling, collective human expression
  - technological: engineering, tools, systems design
  Pick the most specific applicable lens. A node about "dopamine and meditation" → ["biological", "spiritual"]. A node about "Spartan training methods" → ["historical", "athletic"]. A node about "why organic food costs more" → ["economic", "ecological"].
- "source_type": classify what kind of source this content is from based on its tone, structure, and origin. Use your best judgment:
  - "research_paper" / "pubmed" = academic studies, citations, formal methods
  - "government" = official health/policy guidance (CDC, WHO, FDA, etc.)
  - "article" = journalism, news reporting, longform editorial
  - "blog" = personal opinion pieces, Medium posts, informal writing
  - "podcast" = transcripts or notes from audio conversations
  - "book" = excerpts or notes from published books
  - "youtube" = video content, transcripts
  - "newsletter" = email-style digests, Substack posts
  - "reddit" = community discussion threads
  - "twitter" = tweets, X threads
  - "tiktok" / "instagram" = short-form social media
  - "wikipedia" = encyclopedia-style reference
  - "journal" = the user's own original thinking (no external source)`

export const DETECT_RELATIONSHIPS_PROMPT = `Given a new node and nearby existing nodes from a knowledge graph, find meaningful connections based on the content of the nodes themselves. Do not add external judgment — connect based on what the nodes actually say.

New node:
{{new_node}}

Existing nodes:
{{nearby_nodes}}

Return JSON:
{
  "relationships": [{
    "existing_node_id": "...",
    "relationship": "supports | contradicts | refines | example_of | causes | caused_by | mechanism_of | evidence_for | similar | none",
    "strength": 0.0,
    "reason": "short explanation"
  }]
}

Rules:
- CONNECT nodes when there is a real intellectual or causal link. Err on the side of connecting.
- Relationship types:
  - "supports" = provides evidence or reasoning for the other claim
  - "contradicts" = opposes or challenges the other claim
  - "refines" = adds nuance or specificity to the other
  - "example_of" = is a specific instance of a general principle
  - "causes" = this node causes or leads to the other
  - "caused_by" = this node is caused by the other
  - "mechanism_of" = explains HOW the other node works
  - "evidence_for" = is a study/data point supporting the other
  - "similar" = overlapping but distinct claims
- Strength guide: 0.9+ = direct causal/evidential link. 0.7-0.9 = clear conceptual link. 0.5-0.7 = related but indirect.
- Minimum threshold: 0.5. Below that, use "none".
- When one node describes a mechanism and another describes the outcome, connect them.
- When one node is evidence and another is the claim it supports, connect them.
- Reason should be 5-10 words explaining WHY they connect.
- Do NOT inject external knowledge. Only connect based on what the nodes say.`

export const SUGGEST_FOLDER_PROMPT = `Do these connected nodes form a meaningful theme or research topic?

Nodes:
{{cluster_nodes}}

Return JSON:
{
  "should_create_folder": true,
  "folder_name": "2-5 words",
  "description": "one line describing the theme",
  "confidence": 0.0
}

Rules:
- Create a folder if 3+ nodes share a clear topic, research area, or causal narrative.
- folder_name should be specific and descriptive, not generic.
- If the cluster spans a causal chain, name the chain.
- Derive the name from what the nodes actually say, not from external assumptions.
- Confidence 0.8+ = clear theme. 0.6-0.8 = loose theme. Below 0.6 = don't create.`

export const PROMOTE_SELF_PROMPT = `You are reading a cluster of fragments from someone's journal and connected nodes. Your job is to decide if a recurring first-person pattern has emerged — something the author keeps returning to about who they are, what they want, what inspires them, or how they're moving through life.

Cluster:
{{cluster_nodes}}

Return JSON:
{
  "should_promote": true,
  "self": "one sentence in first person, 10-20 words",
  "confidence": 0.0,
  "reason": "what in the cluster pointed to this pattern, 1 sentence"
}

Rules:
- This is a "self" node — a recurring fragment of the author's inner life, not a truth claim about the world.
- It can be a value, an intention, a desire, a fear, a recurring thought, a thing they keep being drawn to, a quiet resolve. Anything the author keeps surfacing.
- The sentence should be in the author's voice ("I ...") and feel like something they would say about themselves.
- Do NOT promote external claims about the world (those are concepts).
- Do NOT promote one-off thoughts. Only promote when the cluster shows the pattern recurring across fragments.
- Confidence 0.8+ = clearly recurring. 0.6-0.8 = forming. Below 0.6 = don't promote.
- If nothing has stabilized yet, return should_promote: false.`
