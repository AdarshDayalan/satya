const BLOCKED_SIGNALS = [
  'recaptcha', 'captcha', 'checking your browser', 'just a moment',
  'cloudflare', 'access denied', 'enable javascript', '<script',
  '<noscript', 'g-recaptcha', 'cf-browser-verification',
]

export function cleanContent(text: string): string {
  if (!text) return ''
  const lower = text.toLowerCase()
  const isJunk = BLOCKED_SIGNALS.some(s => lower.includes(s))
  if (isJunk) {
    const cleaned = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned.length < 100 || BLOCKED_SIGNALS.some(s => cleaned.toLowerCase().includes(s))) {
      return '*Content could not be extracted — site requires a browser to load.*'
    }
    return cleaned
  }
  if (text.includes('<span') || text.includes('<div') || text.includes('<script')) {
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  return text
}
