import { extractContent } from '../src/lib/extractors'
import { detectSource } from '../src/lib/sources'

const TEST_URLS = [
  // The user's specific video from the screenshot
  'https://www.youtube.com/watch?v=0jG-iDjDsR0&list=WL&index=5',
  // A known well-captioned video as control
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
]

async function main() {
  for (const url of TEST_URLS) {
    console.log('\n' + '='.repeat(80))
    console.log('Testing:', url)
    console.log('='.repeat(80))

    const source = detectSource(url)
    console.log('Detected source:', JSON.stringify(source, null, 2))

    if (source.type !== 'youtube') {
      console.log('Not detected as youtube, skipping')
      continue
    }

    const t0 = Date.now()
    const { enrichedContent, metadata } = await extractContent(url, source.type, {
      videoId: source.videoId,
      url: source.url,
      startTime: source.startTime,
      endTime: source.endTime,
    })
    const elapsed = Date.now() - t0

    console.log(`\nExtraction took ${elapsed}ms`)
    console.log('\nMetadata:', JSON.stringify(metadata, null, 2))
    console.log('\n--- Enriched content (first 800 chars) ---')
    console.log(enrichedContent.slice(0, 800))
    console.log(`\n... (total length: ${enrichedContent.length})`)

    if (typeof metadata.transcriptLength === 'number' && metadata.transcriptLength > 100) {
      console.log(`\n✓ SUCCESS: transcript fetched (${metadata.transcriptLength} chars, ${metadata.transcriptSegments} segments)`)
    } else if (metadata.transcriptUnavailable) {
      console.log('\n✗ FAIL: transcript unavailable')
    } else {
      console.log('\n? Unclear result — check enriched content above')
    }
  }
}

main().catch(err => {
  console.error('Test crashed:', err)
  process.exit(1)
})
