import { extractYouTubeId } from '@/lib/validators/sop'
import type { TranscriptSegment } from '@/types/sop'

export interface YouTubeTranscriptResult {
  segments: TranscriptSegment[]
  videoId: string
}

export interface YouTubeTranscriptError {
  noCaption: true
  message: string
}

/**
 * Fetch YouTube captions via the Innertube API.
 * No library dependency — directly scrapes the video page for caption tracks
 * then fetches the timedtext XML.
 */
export async function fetchYouTubeTranscript(
  url: string
): Promise<YouTubeTranscriptResult | YouTubeTranscriptError> {
  const videoId = extractYouTubeId(url)
  if (!videoId) {
    return {
      noCaption: true,
      message: "That doesn't look like a YouTube URL. Check the link and try again.",
    }
  }

  try {
    // Step 1: Fetch video page HTML to extract caption track URLs
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!pageRes.ok) {
      console.error(`[YouTube] Page fetch failed: ${pageRes.status}`)
      return { noCaption: true, message: 'Failed to access YouTube video. The video may be private or region-restricted.' }
    }

    const html = await pageRes.text()

    // Step 2: Extract captionTracks from ytInitialPlayerResponse
    const playerMatch = html.match(/"captionTracks":\s*(\[.*?\])/)
    if (!playerMatch) {
      console.error('[YouTube] No captionTracks found in page HTML')
      return {
        noCaption: true,
        message: 'No captions found for this video. The creator may have disabled captions. Download the video and upload as MP4 for audio transcription.',
      }
    }

    let captionTracks: Array<{ baseUrl: string; languageCode: string; name?: { simpleText?: string } }>
    try {
      captionTracks = JSON.parse(playerMatch[1])
    } catch {
      console.error('[YouTube] Failed to parse captionTracks JSON')
      return { noCaption: true, message: 'Failed to parse caption data from YouTube.' }
    }

    if (!captionTracks.length) {
      return {
        noCaption: true,
        message: 'No captions found for this video. Download the video and upload as MP4 for audio transcription.',
      }
    }

    // Step 3: Pick best caption track — prefer English, fall back to first
    const englishTrack = captionTracks.find((t) =>
      t.languageCode === 'en' || t.languageCode.startsWith('en-')
    )
    const track = englishTrack ?? captionTracks[0]
    const captionUrl = track.baseUrl

    console.log(`[YouTube] Found ${captionTracks.length} caption tracks, using: ${track.languageCode}`)

    // Step 4: Fetch the timedtext XML
    const captionRes = await fetch(captionUrl)
    if (!captionRes.ok) {
      console.error(`[YouTube] Caption fetch failed: ${captionRes.status}`)
      return { noCaption: true, message: 'Failed to download captions from YouTube.' }
    }

    const xml = await captionRes.text()

    // Step 5: Parse XML into segments
    // Format: <text start="1.23" dur="4.56">caption text</text>
    const segmentRegex = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g
    const segments: TranscriptSegment[] = []
    let match: RegExpExecArray | null

    while ((match = segmentRegex.exec(xml)) !== null) {
      const start = parseFloat(match[1])
      const dur = parseFloat(match[2])
      const text = decodeXmlEntities(match[3].trim())

      if (text) {
        segments.push({
          start,
          end: start + dur,
          text,
        })
      }
    }

    if (segments.length === 0) {
      return {
        noCaption: true,
        message: 'Captions were found but contained no text. Download the video and upload as MP4 for audio transcription.',
      }
    }

    console.log(`[YouTube] Parsed ${segments.length} caption segments`)
    return { segments, videoId }
  } catch (err) {
    console.error('[YouTube] Transcript fetch error:', err)
    return {
      noCaption: true,
      message: 'Failed to fetch captions. The video may be private, age-restricted, or region-locked.',
    }
  }
}

/** Decode common XML/HTML entities in caption text */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\n/g, ' ')
}
