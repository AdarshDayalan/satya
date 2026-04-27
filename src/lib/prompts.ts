export const EXTRACT_IDEAS_PROMPT = `You are an AI research distiller.

Given raw input, extract the core meaning nodes.

A meaning node is a short, atomic idea that can connect to other ideas.

Return valid JSON only, no markdown fences.

Input:
{{raw_content}}

Return:
{
  "summary": "...",
  "nodes": [
    {
      "content": "...",
      "type": "idea"
    }
  ],
  "questions": [
    "..."
  ]
}

Rules:
- Extract 3 to 8 nodes max.
- Each node should be atomic.
- Avoid vague summaries.
- Avoid duplicate ideas.
- Preserve uncertainty.
- Do not exaggerate claims.`

export const DETECT_RELATIONSHIPS_PROMPT = `You are building an organic knowledge graph. Be highly selective — only connect ideas that genuinely illuminate each other.

Given a new node and nearby existing nodes, decide if any have a STRONG, specific relationship.

New node:
{{new_node}}

Existing nodes:
{{nearby_nodes}}

Return valid JSON only, no markdown fences:
{
  "relationships": [
    {
      "existing_node_id": "...",
      "relationship": "similar | supports | contradicts | refines | example_of | causes | none",
      "strength": 0.0,
      "reason": "..."
    }
  ]
}

Rules:
- Most nodes should NOT be connected. Default to "none".
- Only connect ideas that share a specific, articulable intellectual link.
- Do NOT connect ideas just because they appear in the same text or share a broad topic.
- "supports" = one idea provides evidence or reasoning for the other.
- "contradicts" = they make opposing claims about the same thing.
- "refines" = one narrows, deepens, or clarifies the other.
- "example_of" = one is a concrete instance of the other's abstract claim.
- "causes" = one directly leads to or produces the other.
- "similar" = they make nearly the same claim in different words. Use sparingly.
- Never use "related" — if you can't name a specific relationship type, use "none".
- Strength 0.8+ = strong, clear link. 0.6-0.8 = moderate. Below 0.6 = probably "none".`

export const SUGGEST_FOLDER_PROMPT = `You are identifying emergent themes in a knowledge graph.

Given these connected nodes, decide whether they form a meaningful cluster.

Nodes:
{{cluster_nodes}}

Return valid JSON only, no markdown fences:
{
  "should_create_folder": true,
  "folder_name": "...",
  "description": "...",
  "confidence": 0.0
}

Rules:
- Only suggest a folder if the theme is clear.
- Folder names should be short and natural.
- Do not create generic folders like "Health" or "Food".
- Prefer specific emergent themes.
- If unclear, return should_create_folder false.`
