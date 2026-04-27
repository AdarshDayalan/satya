export const EXTRACT_IDEAS_PROMPT = `Extract the core truths from this text into a knowledge graph.

Input:
{{raw_content}}

Return JSON:
{
  "summary": "one line",
  "nodes": [{ "content": "...", "type": "concept | idea | question" }]
}

Rules:
- Keep node content SHORT — max 8-10 words. Think graph labels, not sentences.
- "concept" = a core belief or truth claim (e.g. "Detachment leads to freedom"). NOT names or categories.
- "idea" = a specific claim or piece of evidence (e.g. "Seed oils cause inflammation").
- "question" = an unresolved question raised by the text.
- Only extract what matters. Merge similar ideas. Fewer strong nodes > many weak ones.
- If two ideas say roughly the same thing, keep the sharper one.`

export const DETECT_RELATIONSHIPS_PROMPT = `Given a new node and nearby nodes, find meaningful connections. Be very selective.

New node:
{{new_node}}

Existing nodes:
{{nearby_nodes}}

Return JSON:
{
  "relationships": [{
    "existing_node_id": "...",
    "relationship": "supports | contradicts | refines | example_of | causes | similar | none",
    "strength": 0.0,
    "reason": "3-5 words"
  }]
}

Rules:
- Default to "none". Most nodes should NOT connect.
- Only connect when there's a clear intellectual link, not topic overlap.
- Strength 0.8+ = strong. Below 0.7 = "none".
- Keep reason to 3-5 words max.`

export const SUGGEST_FOLDER_PROMPT = `Do these connected nodes form a meaningful theme?

Nodes:
{{cluster_nodes}}

Return JSON:
{
  "should_create_folder": true,
  "folder_name": "2-4 words",
  "description": "one line",
  "confidence": 0.0
}

Rules:
- Only if the theme is specific and clear. No generic names like "Health".
- folder_name: 2-4 words max.
- If unclear, return should_create_folder false.`
