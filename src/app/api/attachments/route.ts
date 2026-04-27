import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function detectKind(url: string): 'link' | 'image' | 'video' {
  const lower = url.toLowerCase()
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/.test(lower)) return 'image'
  if (/\.(mp4|webm|mov)(\?|$)/.test(lower)) return 'video'
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(lower)) return 'video'
  return 'link'
}

async function unfurlLink(url: string): Promise<{ title?: string; description?: string; thumbnail_url?: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Satya/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return {}
    const html = await res.text().then(t => t.slice(0, 20000))

    const og = (prop: string) => html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1]
    const meta = (name: string) => html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1]

    return {
      title: og('title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim(),
      description: og('description') || meta('description'),
      thumbnail_url: og('image'),
    }
  } catch {
    return {}
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const nodeId = searchParams.get('node_id')
  if (!nodeId) return NextResponse.json({ error: 'node_id required' }, { status: 400 })

  const { data } = await supabase
    .from('attachments')
    .select('*')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ attachments: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { node_id, url, kind: providedKind, title, description } = await req.json()

  if (!node_id || !url) {
    return NextResponse.json({ error: 'node_id and url required' }, { status: 400 })
  }

  const kind = providedKind || detectKind(url)

  // Auto-unfurl links for metadata
  let meta: { title?: string; description?: string; thumbnail_url?: string } = {}
  if (kind === 'link' || kind === 'video') {
    meta = await unfurlLink(url)
  }

  // For YouTube videos, get thumbnail
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (ytMatch) {
    meta.thumbnail_url = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`
  }

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      user_id: user.id,
      node_id,
      kind,
      url,
      title: title || meta.title || null,
      description: description || meta.description || null,
      thumbnail_url: meta.thumbnail_url || null,
      metadata: meta,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ attachment: data })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('attachments').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ deleted: true })
}
