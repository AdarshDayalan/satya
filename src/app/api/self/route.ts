import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/self — list this user's self nodes with stability.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('nodes')
    .select('id, content, summary, stability, promoted_from, promoted_at, created_at, input_id')
    .eq('user_id', user.id)
    .eq('type', 'self')
    .order('promoted_at', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ selves: data ?? [] })
}
