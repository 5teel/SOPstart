/**
 * Narrated slideshow Shotstack timeline builder.
 * Generates one HTML slide per SOP section with matching TTS audio clips.
 * Per D-02: one slide per section (hazards, PPE, steps, emergency) — keeps videos concise.
 */

import type { SectionWithAudio } from './types'
import type { ShotstackEdit } from './types'

/** Brand colours matching the SafeStart dark theme */
const BG_COLOR = '#111827'   // steel-900
const TITLE_COLOR = '#f59e0b' // brand-yellow
const TEXT_COLOR = '#f3f4f6'  // steel-100

/**
 * Generate the inline HTML for a single slide.
 * contentHtml is already formatted (e.g. numbered steps as <ol>).
 */
function buildSlideHtml(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 720px;
    background: ${BG_COLOR};
    font-family: Arial, Helvetica, sans-serif;
    padding: 48px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  h1 {
    color: ${TITLE_COLOR};
    font-size: 36px;
    font-weight: 700;
    line-height: 1.2;
    flex-shrink: 0;
  }
  .content {
    color: ${TEXT_COLOR};
    font-size: 22px;
    line-height: 1.6;
    overflow: hidden;
    flex: 1;
  }
  .content ol, .content ul {
    padding-left: 28px;
  }
  .content li {
    margin-bottom: 8px;
  }
  .content p {
    margin-bottom: 12px;
  }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="content">${contentHtml}</div>
</body>
</html>`
}

/**
 * Build a Shotstack narrated slideshow edit.
 *
 * Track 1 (video): one HTML clip per section.
 * Track 2 (audio): one audio clip per section with matching start/length.
 *
 * @param sections  Array of SectionWithAudio — one per SOP section, sorted by sort_order
 * @returns         Complete ShotstackEdit object ready for submitShotstackRender
 */
export function buildSlideshowEdit(sections: SectionWithAudio[]): ShotstackEdit {
  let cumulativeStart = 0

  const videoClips = sections.map((section) => {
    const clip = {
      asset: {
        type: 'html' as const,
        html: buildSlideHtml(section.title, section.contentHtml),
        width: 1280,
        height: 720,
      },
      start: cumulativeStart,
      length: section.audioDuration,
    }
    cumulativeStart += section.audioDuration
    return clip
  })

  // Reset cursor for audio track
  let audioStart = 0
  const audioClips = sections.map((section) => {
    const clip = {
      asset: {
        type: 'audio' as const,
        src: section.audioStorageUrl,
      },
      start: audioStart,
      length: section.audioDuration,
    }
    audioStart += section.audioDuration
    return clip
  })

  return {
    timeline: {
      tracks: [
        { clips: videoClips },
        { clips: audioClips },
      ],
    },
    output: { format: 'mp4', resolution: 'sd' },
  }
}
