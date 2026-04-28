import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/beliefs/[id]/recompute — recalculate stability for one belief.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: belief } = await supabase
    .from('nodes')
    .select('id, type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!belief || belief.type !== 'belief') {
    return NextResponse.json({ error: 'Not a belief' }, { status: 404 })
  }

  await supabase.rpc('recompute_belief_stability', { belief_id: id })

  const { data: refreshed } = await supabase
    .from('nodes')
    .select('id, stability')
    .eq('id', id)
    .single()

  return NextResponse.json({ stability: refreshed?.stability ?? null })
}
