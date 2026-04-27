import { SourceType } from './sources'

interface ExtractionResult {
  enrichedContent: string
  metadata: Record<string, unknown>
}

export async function extractContent(
  rawContent: string,
  sourceType: SourceType,
  options: { videoId?: string; url?: string | null; startTime?: number; endTime?: number; redditPath?: string; pubmedId?: string }
): Promise<ExtractionResult> {
  switch (sourceType) {
    case 'youtube':
      return extractYouTube(rawContent, options)
    case 'reddit':
      return extractReddit(rawContent, options.redditPath)
    case 'pubmed':
      return extractPubMed(rawContent, options.pubmedId)
    case 'article':
      return extractArticle(rawContent, options.url)
    case 'instagram':
      return extractInstagram(rawContent, options.url)
    default:
      return { enrichedContent: rawContent, metadata: {} }
  }
}

async function extractYouTube(
  rawContent: string,
  options: { videoId?: string; startTime?: number; endTime?: number }
): Promise<ExtractionResult> {
  const { videoId, startTime, endTime } = options
  if (!videoId) return { enrichedContent: rawContent, metadata: {} }

  const metadata: Record<string, unknown> = { videoId }

  // Fetch oEmbed metadata
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`
    )
    if (oembed.ok) {
      const data = await oembed.json()
      metadata.title = data.title
      metadata.author = data.author_name
      metadata.thumbnail = data.thumbnail_url
    }
  } catch { /* non-critical */ }

  // Fetch transcript
  let transcriptText = ''
  try {
    const { YoutubeTranscript } = await import('youtube-transcript')
    const segments = await YoutubeTranscript.fetchTranscript(videoId)

    // Filter to time range if specified
    const filtered = segments.filter((s: { offset: number; duration: number }) => {
      const segStart = s.offset / 1000
      const segEnd = segStart + s.duration / 1000
      if (startTime !== undefined && segEnd < startTime) return false
      if (endTime !== undefined && segStart > endTime) return false
      return true
    })

    transcriptText = filtered.map((s: { text: string }) => s.text).join(' ')
    metadata.transcriptLength = transcriptText.length
    if (startTime !== undefined) metadata.startTime = startTime
    if (endTime !== undefined) metadata.endTime = endTime
  } catch {
    transcriptText = '[transcript unavailable]'
  }

  const timeLabel = startTime !== undefined
    ? ` (${formatTime(startTime)}${endTime ? ` to ${formatTime(endTime)}` : ''})`
    : ''

  const enriched = [
    `[YouTube Video${timeLabel}]`,
    metadata.title ? `Title: ${metadata.title}` : null,
    metadata.author ? `Channel: ${metadata.author}` : null,
    '',
    'Transcript:',
    transcriptText,
    '',
    rawContent.replace(/https?:\/\/[^\s]+/g, '').trim() || null,
  ].filter(Boolean).join('\n')

  return { enrichedContent: enriched, metadata }
}

async function extractArticle(
  rawContent: string,
  url: string | null | undefined
): Promise<ExtractionResult> {
  if (!url) return { enrichedContent: rawContent, metadata: {} }

  const metadata: Record<string, unknown> = { url }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Satya/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { enrichedContent: rawContent, metadata }

    const html = await res.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) metadata.title = titleMatch[1].trim()

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    if (descMatch) metadata.description = descMatch[1]

    // Strip HTML to get text content (simple approach)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000) // Cap at 5k chars for Gemini

    metadata.contentLength = textContent.length

    const enriched = [
      `[Article]`,
      metadata.title ? `Title: ${metadata.title}` : null,
      metadata.description ? `Description: ${metadata.description}` : null,
      '',
      'Content:',
      textContent,
      '',
      rawContent.replace(/https?:\/\/[^\s]+/g, '').trim() || null,
    ].filter(Boolean).join('\n')

    return { enrichedContent: enriched, metadata }
  } catch {
    return { enrichedContent: rawContent, metadata }
  }
}

async function extractInstagram(
  rawContent: string,
  url: string | null | undefined
): Promise<ExtractionResult> {
  if (!url) return { enrichedContent: rawContent, metadata: {} }

  const metadata: Record<string, unknown> = { url }

  // Instagram oEmbed (limited but free)
  try {
    const oembed = await fetch(
      `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=public`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (oembed.ok) {
      const data = await oembed.json()
      if (data.title) metadata.caption = data.title
      if (data.author_name) metadata.author = data.author_name
    }
  } catch { /* Instagram oEmbed often blocked without app token */ }

  const enriched = [
    `[Instagram Post]`,
    metadata.author ? `Author: ${metadata.author}` : null,
    metadata.caption ? `Caption: ${metadata.caption}` : null,
    '',
    rawContent,
  ].filter(Boolean).join('\n')

  return { enrichedContent: enriched, metadata }
}

async function extractReddit(
  rawContent: string,
  redditPath: string | undefined
): Promise<ExtractionResult> {
  if (!redditPath) return { enrichedContent: rawContent, metadata: {} }

  const metadata: Record<string, unknown> = {}

  try {
    // Reddit .json API — no auth needed
    const res = await fetch(`https://www.reddit.com/${redditPath}.json`, {
      headers: { 'User-Agent': 'Satya/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { enrichedContent: rawContent, metadata }

    const json = await res.json()
    const post = json[0]?.data?.children?.[0]?.data
    if (!post) return { enrichedContent: rawContent, metadata }

    metadata.title = post.title
    metadata.author = post.author
    metadata.subreddit = post.subreddit_name_prefixed
    metadata.score = post.score
    metadata.url = `https://reddit.com/${redditPath}`

    const postBody = post.selftext || ''

    // Top comments (first 10)
    const comments = (json[1]?.data?.children ?? [])
      .slice(0, 10)
      .filter((c: { kind: string }) => c.kind === 't1')
      .map((c: { data: { author: string; body: string; score: number } }) =>
        `[${c.data.author} · ${c.data.score}pts] ${c.data.body}`
      )
      .join('\n\n')

    const enriched = [
      `[Reddit Post]`,
      `Title: ${post.title}`,
      `Subreddit: ${metadata.subreddit}`,
      `Author: u/${post.author} · ${post.score} upvotes`,
      '',
      postBody ? `Post:\n${postBody}` : null,
      comments ? `\nTop Comments:\n${comments}` : null,
      '',
      rawContent.replace(/https?:\/\/[^\s]+/g, '').trim() || null,
    ].filter(Boolean).join('\n')

    return { enrichedContent: enriched, metadata }
  } catch {
    return { enrichedContent: rawContent, metadata }
  }
}

async function extractPubMed(
  rawContent: string,
  pubmedId: string | undefined
): Promise<ExtractionResult> {
  if (!pubmedId) return { enrichedContent: rawContent, metadata: {} }

  const metadata: Record<string, unknown> = { pubmedId }

  try {
    // NCBI E-utilities — free, no key needed
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pubmedId}&retmode=xml`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return { enrichedContent: rawContent, metadata }

    const xml = await res.text()

    // Parse key fields from XML
    const title = xml.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/)?.[1]
    const abstractParts = xml.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/g)
    const abstract = abstractParts
      ?.map((p: string) => {
        const label = p.match(/Label="([^"]+)"/)?.[1]
        const text = p.match(/>([^<]+)</)?.[1]
        return label ? `${label}: ${text}` : text
      })
      .join('\n\n') || ''

    // Authors
    const authorMatches = xml.match(/<LastName>([^<]+)<\/LastName>\s*<ForeName>([^<]+)<\/ForeName>/g)
    const authors = authorMatches
      ?.slice(0, 5)
      .map((a: string) => {
        const last = a.match(/<LastName>([^<]+)/)?.[1]
        const first = a.match(/<ForeName>([^<]+)/)?.[1]
        return `${first} ${last}`
      })
      .join(', ') || ''

    // Journal + year
    const journal = xml.match(/<Title>([^<]+)<\/Title>/)?.[1]
    const year = xml.match(/<Year>(\d{4})<\/Year>/)?.[1]

    // MeSH terms
    const meshMatches = xml.match(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g)
    const meshTerms = meshMatches
      ?.map((m: string) => m.match(/>([^<]+)/)?.[1])
      .filter(Boolean)
      .join(', ') || ''

    metadata.title = title
    metadata.authors = authors
    metadata.journal = journal
    metadata.year = year
    metadata.meshTerms = meshTerms
    metadata.url = `https://pubmed.ncbi.nlm.nih.gov/${pubmedId}/`

    const enriched = [
      `[PubMed Research Paper]`,
      title ? `Title: ${title}` : null,
      authors ? `Authors: ${authors}` : null,
      journal ? `Journal: ${journal}${year ? ` (${year})` : ''}` : null,
      meshTerms ? `MeSH Terms: ${meshTerms}` : null,
      '',
      abstract ? `Abstract:\n${abstract}` : null,
      '',
      rawContent.replace(/https?:\/\/[^\s]+/g, '').trim() || null,
    ].filter(Boolean).join('\n')

    return { enrichedContent: enriched, metadata }
  } catch {
    return { enrichedContent: rawContent, metadata }
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
