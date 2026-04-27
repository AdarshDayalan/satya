import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: spaces } = await supabase
    .from('spaces')
    .select('*, space_items(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ spaces: spaces ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await req.json()
  const randomSuffix = Math.random().toString(36).slice(2, 10)
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
  const slug = `${base}-${randomSuffix}`

  const { data, error } = await supabase
    .from('spaces')
    .insert({ user_id: user.id, name, slug, description: description || '' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
