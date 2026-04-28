import type { SupabaseClient } from '@supabase/supabase-js'

// Recompute stability for any belief node touched by the given node ids.
// Safe to call with non-belief ids — they're filtered out.
export async function recomputeStabilityFor(
  supabase: SupabaseClient,
  nodeIds: string[]
): Promise<void> {
  if (nodeIds.length === 0) return

  const { data: beliefs } = await supabase
    .from('nodes')
    .select('id')
    .in('id', nodeIds)
    .eq('type', 'belief')

  for (const b of beliefs ?? []) {
    await supabase.rpc('recompute_belief_stability', { belief_id: b.id })
  }
}
