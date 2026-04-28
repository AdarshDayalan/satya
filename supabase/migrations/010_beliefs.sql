-- Belief layer: stable assertions that emerge from converging fragments.
-- A belief is a node with type = 'belief'. Stability is computed from the
-- balance of supporting vs. contradicting edges incident on the node.

ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS stability float,
  ADD COLUMN IF NOT EXISTS promoted_from uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_nodes_belief_user
  ON nodes (user_id, promoted_at DESC)
  WHERE type = 'belief';

-- Recompute stability for a single belief node from its incident edges.
-- Score: (sum of supporting strengths - sum of contradicting strengths)
-- divided by total strength, clamped to [-1, 1]. Null when no signed edges.
CREATE OR REPLACE FUNCTION recompute_belief_stability(belief_id uuid)
RETURNS float
LANGUAGE plpgsql
AS $$
DECLARE
  pos float;
  neg float;
  total float;
  score float;
BEGIN
  SELECT
    coalesce(sum(case when relationship in ('supports','evidence_for','example_of','refines') then strength else 0 end), 0),
    coalesce(sum(case when relationship = 'contradicts' then strength else 0 end), 0)
  INTO pos, neg
  FROM edges
  WHERE from_node_id = belief_id OR to_node_id = belief_id;

  total := pos + neg;
  IF total = 0 THEN
    score := NULL;
  ELSE
    score := (pos - neg) / total;
  END IF;

  UPDATE nodes SET stability = score WHERE id = belief_id;
  RETURN score;
END;
$$;
