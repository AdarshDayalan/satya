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

export const DETECT_RELATIONSHIPS_PROMPT = `You are building an organic knowledge graph.

Given a new node and nearby existing nodes, decide how they relate.

New node:
{{new_node}}

Existing nodes:
{{nearby_nodes}}

Return valid JSON only, no markdown fences:
{
  "relationships": [
    {
      "existing_node_id": "...",
      "relationship": "similar | supports | contradicts | refines | example_of | causes | related | none",
      "strength": 0.0,
      "reason": "..."
    }
  ]
}

Rules:
- Only create relationships when meaningful.
- Use "similar" if the ideas are nearly the same.
- Use "supports" if the new node strengthens the existing idea.
- Use "contradicts" if it challenges the existing idea.
- Use "refines" if it narrows, clarifies, or improves the existing idea.
- Use "related" only when useful.
- Return none for weak connections.`

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
