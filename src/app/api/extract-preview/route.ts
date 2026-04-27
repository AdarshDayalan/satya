import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectSource } from '@/lib/sources'
import { extractContent } from '@/lib/extractors'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { raw_content } = await req.json()
  const source = detectSource(raw_content)

  const { enrichedContent, metadata } = await extractContent(
    raw_content,
    source.type,
    { videoId: source.videoId, url: source.url, startTime: source.startTime, endTime: source.endTime, redditPath: source.redditPath, pubmedId: source.pubmedId }
  )

  return NextResponse.json({
    enrichedContent,
    metadata,
    sourceType: source.type,
  })
}
