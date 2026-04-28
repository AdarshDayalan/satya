import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/self/[id]/recompute — recalculate stability for one self node.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: node } = await supabase
    .from('nodes')
    .select('id, type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!node || node.type !== 'self') {
    return NextResponse.json({ error: 'Not a self node' }, { status: 404 })
  }

  await supabase.rpc('recompute_self_stability', { self_id: id })

  const { data: refreshed } = await supabase
    .from('nodes')
    .select('id, stability')
    .eq('id', id)
    .single()

  return NextResponse.json({ stability: refreshed?.stability ?? null })
}
