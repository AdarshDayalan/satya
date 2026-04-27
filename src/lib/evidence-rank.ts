/**
 * EvidenceRank — PageRank for ideas.
 *
 * Computes node importance by propagating weight through the edge graph.
 * Evidence and supporting nodes flow their weight upward toward the claims they support.
 * Big ideas emerge naturally from having lots of evidence flowing into them.
 */

interface Node {
  id: string
}

interface Edge {
  from_node_id: string
  to_node_id: string
  relationship: string
  strength: number
}

// How much weight flows through each relationship type, and in which direction
// Positive = from → to. Negative = to → from (reverse flow).
const FLOW: Record<string, { weight: number; reverse: boolean }> = {
  evidence_for: { weight: 1.0, reverse: false },   // evidence → claim: claim gets bigger
  supports:     { weight: 0.9, reverse: false },   // support → supported: supported gets bigger
  mechanism_of: { weight: 0.85, reverse: false },  // mechanism → outcome: outcome gets bigger
  causes:       { weight: 0.8, reverse: false },   // cause → effect: effect gets bigger
  caused_by:    { weight: 0.8, reverse: true },    // effect → cause: cause gets bigger
  example_of:   { weight: 0.7, reverse: false },   // example → general: general gets bigger
  refines:      { weight: 0.5, reverse: false },   // refinement → original: both grow slightly
  similar:      { weight: 0.3, reverse: false },   // mutual weak flow
  contradicts:  { weight: -0.3, reverse: false },  // contradiction reduces target weight slightly
}

export function computeEvidenceRank(
  nodes: Node[],
  edges: Edge[],
  iterations: number = 4,
  damping: number = 0.15
): Map<string, number> {
  const weights = new Map<string, number>()

  // Initialize all nodes at 1.0
  for (const node of nodes) {
    weights.set(node.id, 1.0)
  }

  // Iterate to propagate weights
  for (let iter = 0; iter < iterations; iter++) {
    const newWeights = new Map<string, number>()
    for (const node of nodes) {
      newWeights.set(node.id, 1.0) // base weight each iteration
    }

    for (const edge of edges) {
      const flow = FLOW[edge.relationship] || { weight: 0.3, reverse: false }

      // Determine source → target of the flow
      const sourceId = flow.reverse ? edge.to_node_id : edge.from_node_id
      const targetId = flow.reverse ? edge.from_node_id : edge.to_node_id

      const sourceWeight = weights.get(sourceId) || 1.0
      const contribution = sourceWeight * Math.abs(flow.weight) * edge.strength * (1 - damping)

      if (flow.weight >= 0) {
        // Positive flow: target gains weight
        newWeights.set(targetId, (newWeights.get(targetId) || 1.0) + contribution)
      } else {
        // Negative flow (contradicts): target loses some weight, but floor at 0.5
        const current = newWeights.get(targetId) || 1.0
        newWeights.set(targetId, Math.max(0.5, current - contribution * 0.5))
      }

      // Small reverse flow for bidirectional relationships
      if (edge.relationship === 'similar' || edge.relationship === 'refines') {
        const reverseContribution = (weights.get(targetId) || 1.0) * flow.weight * edge.strength * (1 - damping) * 0.5
        newWeights.set(sourceId, (newWeights.get(sourceId) || 1.0) + reverseContribution)
      }
    }

    // Update weights
    for (const [id, w] of newWeights) {
      weights.set(id, w)
    }
  }

  return weights
}

/**
 * Convert raw EvidenceRank weights to visual radii.
 * Maps the weight range to a radius range suitable for rendering.
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
    const normalized = (w - minWeight) / range // 0 to 1
    radii.set(id, minRadius + normalized * (maxRadius - minRadius))
  }
  return radii
}
