---
phase: 06-video-transcription-upload-and-url
plan: "04"
subsystem: admin-review-ui
tags: [video, review, transcript, adversarial-flags, publish-gate]
dependency_graph:
  requires: ["06-01", "06-02"]
  provides: ["video-review-panel", "adversarial-flag-banner", "missing-section-warning-banner"]
  affects: ["admin/sops/[sopId]/review"]
tech_stack:
  added: []
  patterns:
    - YouTube IFrame API lazy load via useEffect + onYouTubeIframeAPIReady global callback
    - Transcript-to-video sync via HTML5 video.currentTime / YT.Player.seekTo
    - Publish gate via derived boolean flags combining multiple conditions
key_files:
  created:
    - src/components/admin/VideoReviewPanel.tsx
    - src/components/admin/AdversarialFlagBanner.tsx
    - src/components/admin/MissingSectionWarningBanner.tsx
  modified:
    - src/components/admin/OriginalDocViewer.tsx
    - src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx
    - src/app/(protected)/admin/sops/[sopId]/review/page.tsx
decisions:
  - key: youtube-iframe-api-lazy-init
    summary: YouTube IFrame API script loaded lazily on iframe onLoad to avoid loading it for non-YouTube SOPs
  - key: publish-gate-derived-state
    summary: Publish button disabled condition computed as derived boolean combining allApproved, unresolvedCriticalFlags, hasMissingSectionFlags+acknowledged
metrics:
  duration: "3m"
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 06 Plan 04: Video Review UI Summary

Video review UI with transcript panel + video player, adversarial flag banner, and missing section warning wired into the admin review page.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | VideoReviewPanel, AdversarialFlagBanner, MissingSectionWarningBanner | e29c1a7 | 3 new |
| 2 | Wire video review components into ReviewClient and review page | 5ebfbd8 | 3 modified |

## What Was Built

### VideoReviewPanel (`src/components/admin/VideoReviewPanel.tsx`)

Replaces OriginalDocViewer in the review left pane for video-sourced SOPs. Contains:
- HTML5 `<video>` player for uploaded video files (presignedUrl)
- YouTube `<iframe>` embed for YouTube-sourced SOPs (youtubeVideoId) with lazy IFrame API init
- Scrollable transcript list with timestamp display (`w-[48px]`, `tabular-nums`)
- Click-to-seek: clicking a transcript line seeks video to that timestamp
- Auto-scroll transcript to follow video playback; manual scroll disables auto-scroll for 5s
- Active line highlighted with `bg-steel-800 border-l-2 border-brand-yellow`
- Empty state: "No transcript available for this video."
- Read-only note: "Read only — edit the structured SOP on the right."

### AdversarialFlagBanner (`src/components/admin/AdversarialFlagBanner.tsx`)

Amber expandable banner for AI verification discrepancies:
- Shows only when adversarial flags exist (filters out missing-section flags)
- Expand/collapse with `aria-expanded` accessibility
- Per-flag `Confirm #N` buttons to mark flags as resolved (green state)
- `Dismiss all` button to hide banner entirely
- Counts unresolved critical flags and reports via `onUnresolvedCountChange` callback

### MissingSectionWarningBanner (`src/components/admin/MissingSectionWarningBanner.tsx`)

Warn-but-allow banner for missing Hazards/PPE sections:
- Renders only for flags where section_title is Hazards/PPE and original_text is '(not found in transcript)'
- Combined text "No hazards or PPE section" when both missing
- Acknowledge checkbox (`id="missing-section-ack"`, `aria-required="true"`) gates publish

### OriginalDocViewer (extended)

Added `video` case before existing pdf/image/default branches — delegates to VideoReviewPanel with new optional props `transcriptSegments` and `youtubeVideoId`.

### ReviewClient (extended)

- New props: `transcriptSegments`, `verificationFlags`, `youtubeVideoId`
- AdversarialFlagBanner + MissingSectionWarningBanner rendered above "PARSED OUTPUT" header
- Publish button disabled when: `!allApproved || unresolvedCriticalFlags > 0 || (hasMissingSectionFlags && !missingSectionAcknowledged) || actionPending || published`
- Tooltip on disabled publish button explains specific blocker

### review/page.tsx (extended)

- Extracts `transcript_segments`, `verification_flags`, `youtube_url` from latest parse job
- Converts YouTube URL to video ID via `extractYouTubeId` from validators
- Video file uploads use `sop-videos` bucket for presigned URL; non-video SOPs use `sop-documents`
- Passes all video props to ReviewClient

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one minor improvement.

**1. [Rule 2 - Missing Feature] Added per-flag dismiss + global "Dismiss all" button to AdversarialFlagBanner**

- **Found during:** Task 1
- **Issue:** Plan acceptance criteria mentioned "Dismiss button sets dismissed state (renders nothing when dismissed)" but the code example only showed per-flag confirm buttons. Added both per-flag confirm AND a global dismiss button.
- **Fix:** Added `dismissed` state and "Dismiss all" button in the expanded flag list footer.
- **Files modified:** src/components/admin/AdversarialFlagBanner.tsx

## Known Stubs

None — all data is wired from real parse job fields (`transcript_segments`, `verification_flags`). Components render empty/null states correctly when data is absent.

## Self-Check: PASSED

Files exist:
- src/components/admin/VideoReviewPanel.tsx — FOUND
- src/components/admin/AdversarialFlagBanner.tsx — FOUND
- src/components/admin/MissingSectionWarningBanner.tsx — FOUND

Commits exist:
- e29c1a7 — FOUND
- 5ebfbd8 — FOUND

Build: PASSED (npm run build exits 0)
