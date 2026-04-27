export type SourceType = 'journal' | 'youtube' | 'instagram' | 'article' | 'research_paper' | 'reddit' | 'pubmed'

interface DetectedSource {
  type: SourceType
  url: string | null
  videoId?: string
  startTime?: number
  endTime?: number
  redditPath?: string
  pubmedId?: string
}

const YT_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/
const YT_TIME_REGEX = /[?&]t=(\d+)/
const INSTA_REGEX = /instagram\.com\/(reel|p)\/([\w-]+)/
const ARXIV_REGEX = /arxiv\.org\/(?:abs|pdf)\/([\d.]+)/
const REDDIT_REGEX = /reddit\.com\/(r\/\w+\/comments\/\w+[^\s]*)/
const PUBMED_REGEX = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/
const URL_REGEX = /https?:\/\/[^\s]+/
const TIME_RANGE_REGEX = /(?:from\s+)?(\d{1,2}:\d{2})\s*(?:to|-)\s*(\d{1,2}:\d{2})/i

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number)
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2]
}

export function detectSource(content: string): DetectedSource {
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

  const urlMatch = content.match(URL_REGEX)
  if (urlMatch) {
    return { type: 'article', url: urlMatch[0] }
  }

  return { type: 'journal', url: null }
}
