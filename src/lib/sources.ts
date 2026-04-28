export type SourceType =
  | 'journal' | 'youtube' | 'instagram' | 'article' | 'research_paper'
  | 'reddit' | 'pubmed' | 'blog' | 'podcast' | 'book' | 'twitter'
  | 'tiktok' | 'newsletter' | 'wikipedia' | 'government'

interface DetectedSource {
  type: SourceType
  url: string | null
  videoId?: string
  startTime?: number
  endTime?: number
  redditPath?: string
  pubmedId?: string
  isPmc?: boolean
  doi?: string
}

const YT_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/
const YT_TIME_REGEX = /[?&]t=(\d+)/
const INSTA_REGEX = /instagram\.com\/(reel|p)\/([\w-]+)/
const ARXIV_REGEX = /arxiv\.org\/(?:abs|pdf)\/([\d.]+)/
const REDDIT_REGEX = /reddit\.com\/(r\/\w+\/comments\/\w+[^\s]*)/
const PUBMED_REGEX = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/
const PMC_REGEX = /(?:pmc\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov\/pmc)\/articles\/PMC(\d+)/
const DOI_REGEX = /10\.\d{4,}\/[^\s]+/
const ACADEMIC_DOMAINS = [
  'link.springer.com', 'springer.com',
  'journals.plos.org', 'plosone.org',
  'academia.edu',
  'researchgate.net',
  'journalofdairyscience.org',
  'sciencedirect.com',
  'nature.com',
  'cell.com',
  'thelancet.com',
  'bmj.com',
  'nejm.org',
  'wiley.com', 'onlinelibrary.wiley.com',
  'tandfonline.com',
  'frontiersin.org',
  'mdpi.com',
  'biomedcentral.com',
  'jci.org',
]
const TWITTER_REGEX = /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/
const TIKTOK_REGEX = /tiktok\.com\/@[\w.]+\/video\/\d+/
const WIKIPEDIA_REGEX = /(?:\w+\.)?wikipedia\.org\/wiki\//
const GOV_DOMAINS = ['.gov', '.gov.uk', '.gc.ca', '.gov.au', 'who.int', 'cdc.gov', 'nih.gov', 'fda.gov', 'epa.gov']
const PODCAST_DOMAINS = ['podcasts.apple.com', 'open.spotify.com/episode', 'open.spotify.com/show', 'overcast.fm', 'pocketcasts.com', 'castbox.fm']
const BLOG_DOMAINS = ['medium.com', 'substack.com', 'dev.to', 'hashnode.dev', 'wordpress.com', 'blogger.com', 'tumblr.com']
const NEWSLETTER_DOMAINS = ['beehiiv.com', 'buttondown.email', 'convertkit.com', 'mailchi.mp']
const PDF_REGEX = /\.pdf(?:\?|$|#)/i
const URL_REGEX = /https?:\/\/[^\s]+/
const TIME_RANGE_REGEX = /(?:from\s+)?(\d{1,2}:\d{2})\s*(?:to|-)\s*(\d{1,2}:\d{2})/i

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number)
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2]
}

export function countEmbeddedUrls(content: string): number {
  return (content.match(/https?:\/\/[^\s]+/g) || []).length
}

export function detectSource(content: string): DetectedSource {
  // If content has multiple URLs AND substantial prose, treat as journal with embedded sources.
  // This ensures all links get individually scraped via extractJournal.
  const allUrls = content.match(/https?:\/\/[^\s]+/g) || []
  if (allUrls.length > 1) {
    const proseChars = content.replace(/https?:\/\/[^\s]+/g, '').replace(/\s+/g, ' ').trim().length
    if (proseChars > 50) {
      return { type: 'journal', url: null }
    }
  }

  const ytMatch = content.match(YT_REGEX)
  if (ytMatch) {
    const result: DetectedSource = { type: 'youtube', url: content.match(URL_REGEX)?.[0] ?? null, videoId: ytMatch[1] }
    // Check for &t= param
    const tMatch = content.match(YT_TIME_REGEX)
    if (tMatch) result.startTime = parseInt(tMatch[1])
    // Check for "from X:XX to Y:YY" in text
    const rangeMatch = content.match(TIME_RANGE_REGEX)
    if (rangeMatch) {
      result.startTime = parseTimestamp(rangeMatch[1])
      result.endTime = parseTimestamp(rangeMatch[2])
    }
    return result
  }

  const redditMatch = content.match(REDDIT_REGEX)
  if (redditMatch) {
    return { type: 'reddit', url: content.match(URL_REGEX)?.[0] ?? null, redditPath: redditMatch[1] }
  }

  const pmcMatch = content.match(PMC_REGEX)
  if (pmcMatch) {
    return { type: 'pubmed', url: content.match(URL_REGEX)?.[0] ?? null, pubmedId: pmcMatch[1], isPmc: true }
  }

  const pubmedMatch = content.match(PUBMED_REGEX)
  if (pubmedMatch) {
    return { type: 'pubmed', url: content.match(URL_REGEX)?.[0] ?? null, pubmedId: pubmedMatch[1] }
  }

  if (INSTA_REGEX.test(content)) {
    return { type: 'instagram', url: content.match(URL_REGEX)?.[0] ?? null }
  }

  if (ARXIV_REGEX.test(content)) {
    return { type: 'research_paper', url: content.match(URL_REGEX)?.[0] ?? null }
  }

  if (TWITTER_REGEX.test(content)) {
    return { type: 'twitter', url: content.match(URL_REGEX)?.[0] ?? null }
  }

  if (TIKTOK_REGEX.test(content)) {
    return { type: 'tiktok', url: content.match(URL_REGEX)?.[0] ?? null }
  }

  if (WIKIPEDIA_REGEX.test(content)) {
    return { type: 'wikipedia', url: content.match(URL_REGEX)?.[0] ?? null }
  }

  const urlMatch = content.match(URL_REGEX)
  if (urlMatch) {
    const url = urlMatch[0]

    // Extract DOI from URL or content
    const doiMatch = content.match(DOI_REGEX)
    const doi = doiMatch ? doiMatch[0].replace(/[).,;]+$/, '') : undefined

    // Check if it's an academic domain
    const isAcademic = ACADEMIC_DOMAINS.some(d => url.includes(d))

    // Check if it's a PDF
    if (PDF_REGEX.test(url)) {
      return { type: 'research_paper', url, doi }
    }

    if (isAcademic || doi) {
      return { type: 'research_paper', url, doi }
    }

    // Government sources
    if (GOV_DOMAINS.some(d => url.includes(d))) {
      return { type: 'government', url }
    }

    // Podcasts
    if (PODCAST_DOMAINS.some(d => url.includes(d))) {
      return { type: 'podcast', url }
    }

    // Newsletters (check before blog since substack can be both)
    if (NEWSLETTER_DOMAINS.some(d => url.includes(d))) {
      return { type: 'newsletter', url }
    }

    // Blogs
    if (BLOG_DOMAINS.some(d => url.includes(d))) {
      return { type: 'blog', url }
    }

    return { type: 'article', url }
  }

  return { type: 'journal', url: null }
}
