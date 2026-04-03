# Phase 6: Video Transcription (Upload and URL) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 06-video-transcription-upload-and-url
**Areas discussed:** Transcript review UX, YouTube/Vimeo URL scope, Processing feedback, Transcription accuracy

---

## Transcript Review UX

### Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side panels | Left: scrollable transcript with timestamps. Right: structured SOP sections. Click transcript line to highlight SOP section. | ✓ |
| Tabbed view | Tab 1: Structured SOP. Tab 2: Full transcript. Admin switches between. | |
| Inline transcript | Each SOP section shows collapsed transcript excerpt it was derived from. | |

**User's choice:** Side-by-side panels
**Notes:** Consistent with existing review UI pattern (original doc alongside structured SOP).

### Transcript Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Edit structured SOP only | Transcript is read-only reference. Admin edits structured sections. | ✓ |
| Edit both | Admin can edit transcript AND structured sections. | |
| Edit transcript, auto-restructure | Admin corrects transcript, clicks Re-structure. | |

**User's choice:** Edit structured SOP only
**Notes:** Consistent with existing document-parsed SOP review flow.

### Video Playback

| Option | Description | Selected |
|--------|-------------|----------|
| Video player with timestamp sync | Embedded player above transcript. Click transcript line to jump to timestamp. | ✓ |
| No video playback | Transcript only. Admin reviews text without re-watching. | |
| Audio-only player | Lightweight waveform player with timestamp scrubbing. | |

**User's choice:** Video player with timestamp sync

### High-Risk Token Flagging

| Option | Description | Selected |
|--------|-------------|----------|
| Inline highlight with confirm | Amber highlights in transcript and SOP. Admin clicks each to confirm. | |
| Summary list at top | Banner with clickable list of high-risk terms. | |
| You decide | Claude picks approach. | |

**User's choice:** Other — Adversarial AI verification pass
**Notes:** Instead of keyword-based flagging, run a second AI model (different from GPT-4o) with an adversarial objective to cross-check transcript vs structured SOP. Flag discrepancies for admin confirmation. Semantic error detection, not keyword matching.

---

## YouTube/Vimeo URL Scope

### Vimeo Inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| YouTube only for Phase 6 | Vimeo deferred. Different API, separate token, limited NZ demand. | ✓ |
| Both YouTube and Vimeo | Include both now. Doubles URL integration surface. | |
| Defer URL pathway entirely | Focus on file upload only. | |

**User's choice:** YouTube only for Phase 6

### No Captions Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Suggest file upload fallback | "No captions found — download and upload as MP4." | ✓ |
| Auto-transcribe audio via API | Fetch audio from YouTube and transcribe server-side. | |
| Reject with explanation | "No captions available" and stop. | |

**User's choice:** Initially selected auto-transcribe, but after discussing YouTube ToS risk, accepted fallback to file upload.
**Notes:** Server-side audio extraction from YouTube carries ToS/DMCA liability for SaaS product. Admin downloads video themselves and uploads as MP4 instead.

### Terms Acknowledgement

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, brief acknowledgement | Checkbox: "I confirm I have rights to use this content." | ✓ |
| No acknowledgement | Just paste and go. | |

**User's choice:** Yes, brief acknowledgement

---

## Processing Feedback

### Stage Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Named stages with progress | 4+ stages with labels, spinners, progress bars. Reuses ParseJobStatus pattern. | ✓ |
| Simple spinner with stage name | Just stage name and spinner. Minimal. | |
| Detailed progress with ETA | Percentage, elapsed time, estimated remaining per stage. | |

**User's choice:** Named stages with progress

### Error Recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Show failure stage + retry button | Display which stage failed. Retry re-attempts from failed stage. | ✓ |
| Auto-retry once, then fail | System retries automatically once before showing error. | |
| You decide | Claude picks error handling approach. | |

**User's choice:** Show failure stage + retry button

---

## Transcription Accuracy

### Domain Vocabulary

| Option | Description | Selected |
|--------|-------------|----------|
| Per-org vocabulary dictionary | Each org maintains custom term list. Builds over time. | |
| Global industry vocabulary | Ship default NZ industrial terms. No per-org customisation initially. | ✓ |
| No vocabulary prompting | Raw transcription. Rely on adversarial verification to catch errors. | |

**User's choice:** Global industry vocabulary
**Notes:** Per-org dictionaries can come later based on real-world usage.

### Adversarial Verification Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-run after structuring | Second model cross-checks automatically. Adds ~30s to pipeline. | ✓ |
| Manual trigger by admin | Admin clicks "Verify accuracy" button. Can skip. | |
| You decide | Claude picks implementation. | |

**User's choice:** Auto-run after structuring

### Missing Section Warning

| Option | Description | Selected |
|--------|-------------|----------|
| Warn but allow publish | Banner warning. Admin can acknowledge and publish. | ✓ |
| Block until acknowledged | Admin must tick confirmation checkbox. | |
| Hard block | Cannot publish without hazards/PPE. | |

**User's choice:** Warn but allow publish
**Notes:** Consistent with Phase 5 D-08 warn-but-allow approach.

---

## Claude's Discretion

- Transcription API choice
- Audio extraction approach (ffmpeg-static vs WASM)
- Adversarial verification model selection and prompt engineering
- YouTube caption API integration details
- Video player component choice
- parse_jobs stage extension for video pipeline
- Retry mechanism internals

## Deferred Ideas

- Vimeo URL support (separate phase)
- Per-organisation vocabulary dictionaries (after real-world usage)
- Automatic transcript correction (evaluate after seeing usage patterns)
