/**
 * Screen-recording-style Shotstack timeline builder.
 * Single scrolling HTML clip covering the full SOP content, synced with per-section audio.
 * Per D-03: section-level scroll pacing, same visual styling as slideshow.
 *
 * IMPORTANT: Does NOT stitch audio buffers. Uses per-section audio clips on a separate
 * Shotstack track (same approach as render-slides.ts). Naive Buffer.concat of MP3 files
 * produces invalid MP3 — use Shotstack's multi-clip audio track instead.
 */

import type { SectionWithAudio } from './types'
import type { ShotstackEdit } from './types'

/** Brand colours matching the SafeStart dark theme */
const BG_COLOR = '#111827'   // steel-900
const TITLE_COLOR = '#f59e0b' // brand-yellow
const TEXT_COLOR = '#f3f4f6'  // steel-100

interface SectionTimeBoundary {
  section: SectionWithAudio
  startPercent: number // 0-100 — % of total duration when scroll should reach this section
}

/**
 * Build the keyframe animation percentage for a given time offset.
 * Clamps to avoid exceeding 100%.
 */
function toPercent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((value / total) * 10000) / 100)
}

/**
 * Generate the full scrolling HTML document for all SOP sections.
 * Uses a CSS @keyframes animation that scrolls the content vertically,
 * with keyframe stops computed from each section's cumulative time boundary.
 */
function buildScrollHtml(sections: SectionWithAudio[], totalDuration: number): string {
  // Compute cumulative time boundaries for each section
  let cumulative = 0
  const boundaries: SectionTimeBoundary[] = sections.map((section) => {
    const boundary = { section, startPercent: toPercent(cumulative, totalDuration) }
    cumulative += section.audioDuration
    return boundary
  })

  // Build the CSS keyframe stops — scroll to each section's top position at the right time
  // Each section is ~200px title + content area; scroll container wraps all sections
  // translateY moves content up progressively
  const sectionHeightApprox = 720 // assume each section is approximately 720px tall
  const keyframeStops = boundaries
    .map(({ startPercent }, index) => {
      const translateY = -(index * sectionHeightApprox)
      return `  ${startPercent}% { transform: translateY(${translateY}px); }`
    })
    .join('\n')

  // Also pin the final position at 100%
  const finalTranslate = -((sections.length - 1) * sectionHeightApprox)
  const finalStop = `  100% { transform: translateY(${finalTranslate}px); }`

  // Build section HTML blocks
  const sectionsHtml = sections
    .map(
      (s) => `
    <div class="section">
      <h2>${s.title}</h2>
      <div class="content">${s.contentHtml}</div>
    </div>`,
    )
    .join('')

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
    overflow: hidden;
  }
  .scroll-wrapper {
    width: 1280px;
    animation: scroll ${totalDuration}s linear forwards;
  }
  @keyframes scroll {
${keyframeStops}
${finalStop}
  }
  .section {
    width: 1280px;
    min-height: 720px;
    padding: 48px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  h2 {
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
  <div class="scroll-wrapper">
    ${sectionsHtml}
  </div>
</body>
</html>`
}

/**
 * Build a Shotstack screen-recording-style (scrolling) edit.
 *
 * Track 1 (video): single HTML clip with CSS scroll animation covering full SOP content.
 * Track 2 (audio): one audio clip per section with sequential start offsets.
 *
 * No audio stitching — each section's audio clip plays sequentially via Shotstack
 * multi-clip audio track. This avoids invalid MP3 file concatenation (Research Pitfall 2).
 *
 * @param sectionsWithAudio  Array of SectionWithAudio — one per SOP section
 * @returns                  Complete ShotstackEdit object ready for submitShotstackRender
 */
export function buildScrollEdit(sectionsWithAudio: SectionWithAudio[]): ShotstackEdit {
  const totalDuration = sectionsWithAudio.reduce((sum, s) => sum + s.audioDuration, 0)

  const scrollHtml = buildScrollHtml(sectionsWithAudio, totalDuration)

  // Single video clip covering the full SOP
  const videoClip = {
    asset: {
      type: 'html' as const,
      html: scrollHtml,
      width: 1280,
      height: 720,
    },
    start: 0,
    length: totalDuration,
  }

  // Per-section audio clips with sequential start offsets (same pattern as render-slides.ts)
  let audioStart = 0
  const audioClips = sectionsWithAudio.map((section) => {
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
        { clips: [videoClip] },
        { clips: audioClips },
      ],
    },
    output: { format: 'mp4', resolution: 'mobile', quality: 'low', fps: 12 },
  }
}
