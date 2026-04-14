# Phase 9: Streamlined File → Video Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-06
**Phase:** 09-streamlined-file-video-pipeline
**Mode:** discuss
**Areas analyzed:** Entry point, Review gate, Video format selection timing, Progress surface, Failure handling

## Codebase Scout Findings

- `UploadDropzone` already accepts all needed MIME types and exposes a secondary-button slot (Scan, Record buttons) — new "Generate video SOP" button fits here.
- Existing parse pipeline: `POST /api/sops/parse` → async parse-job → `ParseJobStatus` stepper UI.
- Publish gate: `POST /api/sops/[sopId]/publish` server-side counts unapproved sections, returns 400. This is the existing QA gate.
- Video pipeline (Phase 8): `/admin/sops/[sopId]/video` → `VideoGeneratePanel` with upfront format selection, calls `/api/sops/generate-video`. `regenerateVideo` action provides failure-recovery retry.

## Gray Areas Presented

| # | Area | User Choice | Rationale |
|---|------|-------------|-----------|
| A | Entry point | A1 — New button on existing `UploadDropzone` | Lowest-friction, reuses existing MIME/TUS handling |
| B | Review gate | B1 — Full review still required, video auto-queues on publish | Preserves existing QA gate; respects Phase 8 TTS preview concern |
| C | Video format selection timing | C1 — Upfront at upload time | Fewest interruptions, single commit per pipeline run |
| D | Progress surface | D1 — Dedicated progress page with named stages | Matches Phase 6/8 stepper UX pattern |
| E | Failure handling | E1 — SOP stays published, admin retries from existing video panel | Reuses Phase 8-04 `regenerateVideo` recovery path |

## Corrections Made

None — user accepted all recommended options.

## Scope Creep Redirected

None — discussion stayed within phase boundary.

## Ideas Deferred to Later Phases

- Auto-publish variants (confidence-threshold skip, abbreviated review)
- Parallel generation of both video formats from one pipeline run
- Email notification on completion
- Video-source → transcribed SOP → generated video pipeline

