import { YoutubeTranscript } from 'youtube-transcript'
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
    const rawSegments = await YoutubeTranscript.fetchTranscript(videoId)

    // youtube-transcript returns: { text, duration, offset } where offset is in ms
    const segments: TranscriptSegment[] = rawSegments.map((seg) => ({
      start: seg.offset / 1000,                              // ms -> seconds
      end: (seg.offset + seg.duration) / 1000,               // ms -> seconds
      text: seg.text.trim(),
    }))

    return { segments, videoId }
  } catch {
    // Research Pitfall 2: youtube-transcript throws for private, age-restricted,
    // and caption-disabled videos. Return the same user-friendly message regardless.
    return {
      noCaption: true,
      message: 'No captions found for this video. Download the video and upload as MP4 for audio transcription.',
    }
  }
}
