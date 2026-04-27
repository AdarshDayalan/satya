/**
 * EvidenceRank — PageRank for ideas.
 *
 * Computes node importance by propagating weight through the edge graph.
 * Evidence and supporting nodes flow their weight upward toward the claims they support.
 * Big ideas emerge naturally from having lots of evidence flowing into them.
 *
 * Source credibility factors into base weight — a node from a peer-reviewed study
 * starts with more weight than one from a blog, so its evidence propagates stronger.
 */

interface Node {
  id: string
  input_id?: string | null
}

interface Edge {
  from_node_id: string
  to_node_id: string
  relationship: string
  strength: number
}

interface Input {
  id: string
  source_type: string
}

/**
 * Source credibility tiers.
 * Determines base weight of nodes from each source type.
 * Higher = more trustworthy = more weight in the graph.
 */
export const SOURCE_CREDIBILITY: Record<string, { score: number; tier: string; label: string }> = {
  // Tier: peer-reviewed — highest trust
  pubmed:         { score: 1.5,  tier: 'peer-reviewed', label: 'Peer-reviewed research' },
  research_paper: { score: 1.4,  tier: 'peer-reviewed', label: 'Research paper' },
  // Tier: institutional — high trust
  government:     { score: 1.3,  tier: 'institutional', label: 'Government / public health' },
  wikipedia:      { score: 0.9,  tier: 'institutional', label: 'Wikipedia' },
  // Tier: editorial — moderate trust
  article:        { score: 0.8,  tier: 'editorial',     label: 'Article / editorial' },
  newsletter:     { score: 0.75, tier: 'editorial',     label: 'Newsletter' },
  book:           { score: 1.2,  tier: 'editorial',     label: 'Book' },
  // Tier: media — lower trust
  podcast:        { score: 0.65, tier: 'media',         label: 'Podcast' },
  youtube:        { score: 0.6,  tier: 'media',         label: 'Video content' },
  blog:           { score: 0.6,  tier: 'media',         label: 'Blog post' },
  // Tier: community — crowd-sourced
  reddit:         { score: 0.5,  tier: 'community',     label: 'Community discussion' },
  // Tier: social — lowest external trust
  instagram:      { score: 0.4,  tier: 'social',        label: 'Social media' },
  twitter:        { score: 0.45, tier: 'social',        label: 'X / Twitter' },
  tiktok:         { score: 0.35, tier: 'social',        label: 'TikTok' },
  // Tier: personal — your own thinking
  journal:        { score: 1.0,  tier: 'personal',      label: 'Your own thinking' },
}

// How much weight flows through each relationship type, and in which direction
const FLOW: Record<string, { weight: number; reverse: boolean }> = {
  evidence_for: { weight: 1.0, reverse: false },
  supports:     { weight: 0.9, reverse: false },
  mechanism_of: { weight: 0.85, reverse: false },
  causes:       { weight: 0.8, reverse: false },
  caused_by:    { weight: 0.8, reverse: true },
  example_of:   { weight: 0.7, reverse: false },
  refines:      { weight: 0.5, reverse: false },
  similar:      { weight: 0.3, reverse: false },
  contradicts:  { weight: -0.3, reverse: false },
}

/**
 * Compute EvidenceRank for all nodes.
 * @param nodes - All nodes in the graph
 * @param edges - All edges
 * @param inputs - All inputs (for credibility lookup)
 * @param iterations - Number of propagation iterations
 * @param damping - Damping factor (like PageRank)
 */
export function computeEvidenceRank(
  nodes: Node[],
  edges: Edge[],
  inputs?: Input[],
  iterations: number = 4,
  damping: number = 0.15,
  userTrustWeights?: Record<string, number>
): Map<string, number> {
  const weights = new Map<string, number>()

  // Build input lookup for credibility
  const inputMap = new Map<string, Input>()
  if (inputs) {
    for (const inp of inputs) inputMap.set(inp.id, inp)
  }

  // Initialize nodes with credibility-weighted base
  for (const node of nodes) {
    let baseWeight = 1.0
    if (node.input_id) {
      const input = inputMap.get(node.input_id)
      if (input) {
        const sourceType = input.source_type
        // User override takes priority, fall back to defaults
        baseWeight = userTrustWeights?.[sourceType] ?? SOURCE_CREDIBILITY[sourceType]?.score ?? 1.0
      }
    }
    weights.set(node.id, baseWeight)
  }

  // Iterate to propagate weights
  for (let iter = 0; iter < iterations; iter++) {
    const newWeights = new Map<string, number>()

    // Reset to base weights each iteration
    for (const node of nodes) {
      let baseWeight = 1.0
      if (node.input_id) {
        const input = inputMap.get(node.input_id)
        if (input) baseWeight = SOURCE_CREDIBILITY[input.source_type]?.score ?? 1.0
      }
      newWeights.set(node.id, baseWeight)
    }

    for (const edge of edges) {
      const flow = FLOW[edge.relationship] || { weight: 0.3, reverse: false }

      const sourceId = flow.reverse ? edge.to_node_id : edge.from_node_id
      const targetId = flow.reverse ? edge.from_node_id : edge.to_node_id

      const sourceWeight = weights.get(sourceId) || 1.0
      const contribution = sourceWeight * Math.abs(flow.weight) * edge.strength * (1 - damping)

      if (flow.weight >= 0) {
        newWeights.set(targetId, (newWeights.get(targetId) || 1.0) + contribution)
      } else {
        const current = newWeights.get(targetId) || 1.0
        newWeights.set(targetId, Math.max(0.5, current - contribution * 0.5))
      }

      if (edge.relationship === 'similar' || edge.relationship === 'refines') {
        const reverseContribution = (weights.get(targetId) || 1.0) * flow.weight * edge.strength * (1 - damping) * 0.5
        newWeights.set(sourceId, (newWeights.get(sourceId) || 1.0) + reverseContribution)
      }
    }

    for (const [id, w] of newWeights) {
      weights.set(id, w)
    }
  }

  return weights
}

/**
 * Convert raw EvidenceRank weights to visual radii.
 */
export function weightToRadius(
  weights: Map<string, number>,
  minRadius: number = 3,
  maxRadius: number = 20
): Map<string, number> {
  const values = [...weights.values()]
  const maxWeight = Math.max(...values, 1)
  const minWeight = Math.min(...values, 1)
  const range = maxWeight - minWeight || 1

  const radii = new Map<string, number>()
  for (const [id, w] of weights) {
    const normalized = (w - minWeight) / range
    radii.set(id, minRadius + normalized * (maxRadius - minRadius))
  }
  return radii
}

/**
 * Get credibility info for a source type.
 */
export function getCredibility(sourceType: string) {
  return SOURCE_CREDIBILITY[sourceType] || { score: 0.7, tier: 'unknown', label: sourceType }
}
