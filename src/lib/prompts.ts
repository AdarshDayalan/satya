export const EXTRACT_IDEAS_PROMPT = `You are building a personal knowledge graph. Extract the core claims, mechanisms, and evidence from this text exactly as the author presents them. Do not judge, filter, or editorialize — faithfully capture what the text says.

Input:
{{raw_content}}

Return JSON:
{
  "summary": "one line summary of the overall thesis",
  "nodes": [{ "content": "...", "type": "concept | idea | question | evidence | mechanism", "source_url": "https://... or null" }]
}

Rules:
- Extract 5-15 nodes depending on density of the input.
- Node content should be a COMPLETE claim or fact — 10-25 words. Not just a label.
  Good: "[specific claim with enough context to stand alone]"
  Bad: "[two vague words]" (too vague to be useful)
- Preserve causal chains: if A causes B causes C, extract all three so connections can form between them.
- Types:
  - "concept" = a core belief, principle, or truth claim
  - "idea" = a specific insight, recommendation, or conclusion
  - "question" = an unresolved question
  - "evidence" = a specific study finding, statistic, or data point
  - "mechanism" = a biological, chemical, or causal pathway
- If the text contains research citations or data, extract the key findings as "evidence" nodes.
- If the text describes how something works (A → B → C), extract as "mechanism" nodes.
- Do NOT merge nodes that are distinct steps in a causal chain — keep them separate.
- Do NOT add your own opinions or caveats. Extract what the author wrote.
- Quality > quantity, but don't under-extract dense content.
- If the input contains URLs and research context from those URLs, set "source_url" to the specific URL the idea came from. If the idea comes from the user's own writing (not a linked source), set "source_url" to null.`

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
