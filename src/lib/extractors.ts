import { SourceType } from './sources'

interface ExtractionResult {
  enrichedContent: string
  metadata: Record<string, unknown>
}

export async function extractContent(
  rawContent: string,
  sourceType: SourceType,
  options: { videoId?: string; url?: string | null; startTime?: number; endTime?: number; redditPath?: string; pubmedId?: string; isPmc?: boolean; doi?: string }
): Promise<ExtractionResult> {
  switch (sourceType) {
    case 'youtube':
      return extractYouTube(rawContent, options)
    case 'reddit':
      return extractReddit(rawContent, options.redditPath)
    case 'pubmed':
      return extractPubMed(rawContent, options.pubmedId, options.isPmc)
    case 'research_paper':
      return extractResearchPaper(rawContent, options.url, options.doi)
    case 'article':
      return extractArticle(rawContent, options.url)
    case 'instagram':
      return extractInstagram(rawContent, options.url)
    case 'journal':
      return extractJournal(rawContent)
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
      .slice(0, 5000)

    // Detect bot/captcha pages
    const blockedSignals = ['recaptcha', 'captcha', 'checking your browser', 'just a moment', 'cloudflare', 'access denied', 'enable javascript']
    const lowerText = textContent.toLowerCase()
    const isBlocked = blockedSignals.some(s => lowerText.includes(s)) || textContent.length < 200

    if (isBlocked) {
      // Fall back to just the URL — don't feed captcha text to AI
      return {
        enrichedContent: `[Article — content could not be extracted (site requires browser)]\nURL: ${url}\n\n${rawContent.replace(/https?:\/\/[^\s]+/g, '').trim()}`.trim(),
        metadata: { ...metadata, extractionFailed: true },
      }
    }

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

  // Strategy 1: fetch the page HTML and parse embedded JSON-LD / meta tags
  try {
    // Googlebot UA is needed — Instagram blocks normal UAs for non-logged-in users
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })

    if (res.ok) {
      const html = await res.text()

      // Try og:title (usually has caption)
      const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i)?.[1]
      if (ogTitle) metadata.caption = decodeHtmlEntities(ogTitle)

      // og:description often has more detail
      const ogDesc = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:description["']/i)?.[1]
      if (ogDesc) metadata.description = decodeHtmlEntities(ogDesc)

      // og:image for thumbnail
      const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i)?.[1]
      if (ogImage) metadata.thumbnail = ogImage

      // og:video for reels
      const ogVideo = html.match(/<meta\s+(?:property|name)=["']og:video["']\s+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:video["']/i)?.[1]
      if (ogVideo) metadata.videoUrl = ogVideo

      // Try to get author from title pattern "Author on Instagram: ..."
      const captionStr = (metadata.caption as string) || ''
      // Match: "Author on Instagram: "caption text""
      const onInstaIdx = captionStr.indexOf(' on Instagram:')
      if (onInstaIdx > 0) {
        metadata.author = captionStr.slice(0, onInstaIdx).trim()
        // Strip the "Author on Instagram: " prefix and surrounding quotes
        let rest = captionStr.slice(onInstaIdx + ' on Instagram:'.length).trim()
        // Remove leading/trailing smart or straight quotes
        rest = rest.replace(/^[""\u201C\u201D]+|[""\u201C\u201D]+$/g, '').trim()
        if (rest) metadata.caption = rest
      } else {
        // Alternative pattern
        const altMatch = captionStr.match(/^(.+?)\s+(?:posted on|shared a)\s+/i)
        if (altMatch) metadata.author = altMatch[1].trim()
      }

      // Parse author from description if not found yet
      if (!metadata.author && ogDesc) {
        const descAuthor = ogDesc.match(/^(\d[\d,]*)\s+likes?,\s+(\d+)\s+comments?\s+-\s+(.+?)\s+\(/i)
        if (descAuthor) {
          metadata.likes = descAuthor[1]
          metadata.comments = descAuthor[2]
          metadata.author = descAuthor[3]
        }
      }

      // Detect if it's a Reel/Video — also check og:url which may redirect /p/ to /reel/
      const ogUrl = html.match(/<meta\s+(?:property|name)=["']og:url["']\s+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:url["']/i)?.[1]
      const isReel = url.includes('/reel/') || ogUrl?.includes('/reel/') || !!ogVideo
      metadata.type = isReel ? 'reel' : 'post'
    }
  } catch { /* page fetch failed */ }

  const postType = metadata.type === 'reel' ? 'Instagram Reel' : 'Instagram Post'

  // Extract engagement from description if not already parsed
  if (!metadata.likes && metadata.description) {
    const engMatch = (metadata.description as string).match(/^([\d,]+)\s+likes?,\s+([\d,]+)\s+comments?/i)
    if (engMatch) {
      metadata.likes = engMatch[1]
      metadata.comments = engMatch[2]
    }
  }

  const enriched = [
    `[${postType}]`,
    metadata.author ? `Author: @${(metadata.author as string).replace(/^@/, '')}` : null,
    metadata.likes ? `Engagement: ${metadata.likes} likes, ${metadata.comments} comments` : null,
    '',
    metadata.caption ? `Caption:\n${metadata.caption}` : null,
    '',
    rawContent.replace(/https?:\/\/[^\s]+/g, '').trim() || null,
  ].filter(Boolean).join('\n')

  return { enrichedContent: enriched, metadata }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num)))
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
  pubmedId: string | undefined,
  isPmc?: boolean
): Promise<ExtractionResult> {
  if (!pubmedId) return { enrichedContent: rawContent, metadata: {} }

  let resolvedId = pubmedId
  const metadata: Record<string, unknown> = { pubmedId }

  // If PMC ID, convert to PubMed ID first
  if (isPmc) {
    metadata.pmcId = `PMC${pubmedId}`
    try {
      const convertRes = await fetch(
        `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=PMC${pubmedId}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (convertRes.ok) {
        const data = await convertRes.json()
        const pmid = data.records?.[0]?.pmid
        if (pmid) resolvedId = pmid
      }
    } catch { /* use PMC ID directly with pmc db */ }
  }

  try {
    // NCBI E-utilities — free, no key needed
    const db = isPmc && resolvedId === pubmedId ? 'pmc' : 'pubmed'
    const fetchId = isPmc && resolvedId === pubmedId ? `PMC${pubmedId}` : resolvedId
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=${db}&id=${fetchId}&retmode=xml`,
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

async function extractResearchPaper(
  rawContent: string,
  url: string | null | undefined,
  doi: string | undefined
): Promise<ExtractionResult> {
  const metadata: Record<string, unknown> = { url }

  // Try to find DOI from URL if not provided
  let resolvedDoi = doi
  if (!resolvedDoi && url) {
    // Common patterns: /article/10.XXXX/..., ?id=10.XXXX/...
    const doiFromUrl = url.match(/10\.\d{4,}\/[^\s?#]+/)
    if (doiFromUrl) resolvedDoi = doiFromUrl[0].replace(/[).,;]+$/, '')
  }

  // CrossRef API — free, no key needed, covers millions of papers
  if (resolvedDoi) {
    try {
      const res = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(resolvedDoi)}`,
        {
          headers: { 'User-Agent': 'Satya/1.0 (mailto:hello@satya.app)' },
          signal: AbortSignal.timeout(8000),
        }
      )
      if (res.ok) {
        const data = await res.json()
        const work = data.message

        metadata.doi = resolvedDoi
        metadata.title = work.title?.[0]
        metadata.journal = work['container-title']?.[0]
        metadata.year = work.published?.['date-parts']?.[0]?.[0] || work.created?.['date-parts']?.[0]?.[0]
        metadata.type = work.type

        // Authors
        const authors = (work.author ?? [])
          .slice(0, 6)
          .map((a: { given?: string; family?: string }) =>
            [a.given, a.family].filter(Boolean).join(' ')
          )
          .join(', ')
        if (authors) metadata.authors = authors

        // Abstract (CrossRef sometimes has it)
        let abstract = ''
        if (work.abstract) {
          abstract = work.abstract
            .replace(/<[^>]+>/g, '') // Strip JATS XML tags
            .replace(/\s+/g, ' ')
            .trim()
        }

        // Subject/keywords
        const subjects = (work.subject ?? []).join(', ')
        if (subjects) metadata.subjects = subjects

        const enriched = [
          `[Research Paper]`,
          metadata.title ? `Title: ${metadata.title}` : null,
          authors ? `Authors: ${authors}` : null,
          metadata.journal ? `Journal: ${metadata.journal}${metadata.year ? ` (${metadata.year})` : ''}` : null,
          metadata.doi ? `DOI: ${metadata.doi}` : null,
          subjects ? `Subjects: ${subjects}` : null,
          '',
          abstract ? `Abstract:\n${abstract}` : null,
          '',
          rawContent.replace(/https?:\/\/[^\s]+/g, '').trim() || null,
        ].filter(Boolean).join('\n')

        return { enrichedContent: enriched, metadata }
      }
    } catch { /* CrossRef failed, fall through */ }
  }

  // Fallback: try scraping the page like an article
  const articleResult = await extractArticle(rawContent, url)

  // If article extraction failed (captcha), return with research_paper label
  if ((articleResult.metadata as Record<string, unknown>).extractionFailed) {
    return {
      enrichedContent: `[Research Paper — content could not be extracted]\nURL: ${url}\n\n${rawContent.replace(/https?:\/\/[^\s]+/g, '').trim()}`.trim(),
      metadata: { ...metadata, extractionFailed: true },
    }
  }

  // Re-label as research paper
  return {
    enrichedContent: articleResult.enrichedContent.replace('[Article]', '[Research Paper]'),
    metadata: { ...articleResult.metadata, ...metadata },
  }
}

async function extractJournal(rawContent: string): Promise<ExtractionResult> {
  // Find all URLs embedded in the journal text
  const urlRegex = /https?:\/\/[^\s)>\]]+/g
  const urls = [...new Set(rawContent.match(urlRegex) || [])]

  if (urls.length === 0) {
    return { enrichedContent: rawContent, metadata: {} }
  }

  const metadata: Record<string, unknown> = { embeddedUrls: urls.length }

  // Fetch context from embedded links (parallel, max 15 to cover research dumps)
  const urlsToFetch = urls.slice(0, 15)
  const contexts = await Promise.allSettled(
    urlsToFetch.map(async (url) => {
      try {
        // PubMed special handling
        const pubmedMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)
        if (pubmedMatch) {
          const res = await fetch(
            `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pubmedMatch[1]}&retmode=xml`,
            { signal: AbortSignal.timeout(5000) }
          )
          if (res.ok) {
            const xml = await res.text()
            const title = xml.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/)?.[1]
            const abstract = xml.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/g)
              ?.map((p: string) => p.match(/>([^<]+)/)?.[1]).join(' ') || ''
            return `[PubMed ${pubmedMatch[1]}] ${title || ''}: ${abstract.slice(0, 500)}`
          }
        }

        // PMC special handling
        const pmcMatch = url.match(/(?:pmc\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov\/pmc)\/articles\/PMC(\d+)/)
        if (pmcMatch) {
          const res = await fetch(
            `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcMatch[1]}&retmode=xml`,
            { signal: AbortSignal.timeout(5000) }
          )
          if (res.ok) {
            const xml = await res.text()
            const title = xml.match(/<article-title>([^<]+)<\/article-title>/)?.[1]
            const abstract = xml.match(/<abstract[\s\S]*?<\/abstract>/)?.[0]
              ?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) || ''
            return `[PMC${pmcMatch[1]}] ${title || ''}: ${abstract}`
          }
        }

        // Generic URL — fetch title + meta description
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Satya/1.0)' },
          signal: AbortSignal.timeout(4000),
        })
        if (!res.ok) return null
        const html = await res.text().then(t => t.slice(0, 15000))
        const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
        const desc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
        if (title || desc) return `[${new URL(url).hostname}] ${title || ''}: ${desc || ''}`
        return null
      } catch {
        return null
      }
    })
  )

  const contextLines = contexts
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(Boolean) as string[]

  if (contextLines.length === 0) {
    return { enrichedContent: rawContent, metadata }
  }

  metadata.resolvedSources = contextLines.length

  const enriched = [
    rawContent,
    '',
    '--- Research context from embedded links ---',
    ...contextLines,
  ].join('\n')

  return { enrichedContent: enriched, metadata }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
