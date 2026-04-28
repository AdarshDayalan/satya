import type { SupabaseClient } from '@supabase/supabase-js'

// Recompute stability for any self node touched by the given node ids.
// Safe to call with non-self ids — they're filtered out.
export async function recomputeStabilityFor(
  supabase: SupabaseClient,
  nodeIds: string[]
): Promise<void> {
  if (nodeIds.length === 0) return

  const { data: selves } = await supabase
    .from('nodes')
    .select('id')
    .in('id', nodeIds)
    .eq('type', 'self')

  for (const s of selves ?? []) {
    await supabase.rpc('recompute_self_stability', { self_id: s.id })
  }
}
