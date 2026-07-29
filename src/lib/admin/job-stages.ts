// Phase 40 -- DUP-03 (D-07/D-08): the ONE plain-language stage vocabulary for
// every job-progress surface (document parse, AI-prompt draft, video parse,
// video-generation pipeline).
//
// D-07 is the constraint: ONE plain-language vocabulary, mapped over
// untouched internal keys. Nothing in this module renames a DB value --
// `parse_jobs.current_stage` / `video_generation_jobs.current_stage` keep
// every existing internal key verbatim; this module only maps them onto
// worker-plain words at render time.

export type PlainStageKey = 'upload' | 'read' | 'draft' | 'check' | 'render' | 'ready'

// The single ordered worker-plain vocabulary (Phase 30 UX-07 plain-language
// register: what the admin is waiting for, not what the code is doing).
// `render` appears only in the video-generation set.
export const PLAIN_STAGES: ReadonlyArray<{ key: PlainStageKey; label: string }> = [
  { key: 'upload', label: 'Uploading' },
  { key: 'read', label: 'Reading your document' },
  { key: 'draft', label: 'Building the draft' },
  { key: 'check', label: 'Checking' },
  { key: 'render', label: 'Making the video' },
  { key: 'ready', label: 'Ready' },
]

// Every internal DB stage value in use today (parse_jobs.current_stage /
// video_generation_jobs.current_stage), mapped onto a plain key. These
// internal keys are NOT renamed -- they still get written to the DB verbatim.
export const STAGE_TO_PLAIN: Record<string, PlainStageKey> = {
  uploading: 'upload',
  extracting_audio: 'read',
  transcribing: 'read',
  prompting: 'read',
  parsing: 'read',
  structuring: 'draft',
  drafting: 'draft',
  generating: 'render',
  verifying: 'check',
  review: 'check',
  ready: 'ready',
}

// Ordered plain-key subset each pipeline walks, keyed the same way
// ParseJobStatus keys today (parse_jobs.input_type) plus 'video_generation'.
export const STAGE_SETS: Record<string, ReadonlyArray<PlainStageKey>> = {
  video_file: ['upload', 'read', 'draft', 'check'],
  youtube_url: ['upload', 'read', 'draft', 'check'],
  ai_prompt: ['read', 'draft', 'check'],
  // Plain document parse (parse_jobs.input_type === 'upload') -- closes the
  // gap where a plain document parse rendered no stepper at all.
  upload: ['upload', 'read', 'draft', 'check'],
  // D-08's new set, replacing PipelineStepper's uploading/parsing/review/generating/ready.
  video_generation: ['upload', 'read', 'check', 'render', 'ready'],
}

// Maps an internal stage through STAGE_TO_PLAIN then PLAIN_STAGES. Returns
// null for an unknown key so an unmapped future stage degrades to no label
// rather than crashing.
export function plainLabel(internalStage: string | null): string | null {
  if (!internalStage) return null
  const plainKey = STAGE_TO_PLAIN[internalStage]
  if (!plainKey) return null
  return PLAIN_STAGES.find((s) => s.key === plainKey)?.label ?? null
}

// ─── Pipeline snapshot + stage derivation (moved verbatim from
// PipelineProgressClient, D-08) ────────────────────────────────────────────

export type SopRow = {
  id: string
  title: string | null
  status: string
  source_file_name: string
  pipeline_run_id: string | null
}

export type ParseJobRow = {
  id: string
  status: string
  current_stage: string | null
  error_message: string | null
}

export type VideoJobRow = {
  id: string
  status: string
  video_url: string | null
  error_message: string | null
  format: string
  sop_version: number
  current_stage: string | null
}

export type Snapshot = {
  sop: SopRow | null
  parseJob: ParseJobRow | null
  videoJob: VideoJobRow | null
}

// Body moved verbatim from PipelineProgressClient's deriveStage, with
// return values translated through STAGE_TO_PLAIN (parsing->read,
// review->check, generating->render). The failure branches keep their
// meaning: a failed parseJob errors at 'read', a failed videoJob errors at
// 'render'.
export function derivePipelineStage(s: Snapshot): { plainKey: PlainStageKey; errorAt: PlainStageKey | null } {
  if (s.parseJob?.status === 'failed') {
    return { plainKey: 'read', errorAt: 'read' }
  }
  if (s.videoJob?.status === 'failed') {
    return { plainKey: 'render', errorAt: 'render' }
  }
  if (!s.sop || s.sop.status === 'uploading') {
    return { plainKey: 'upload', errorAt: null }
  }
  if (
    s.sop.status === 'parsing' ||
    s.parseJob?.status === 'queued' ||
    s.parseJob?.status === 'processing'
  ) {
    return { plainKey: 'read', errorAt: null }
  }
  if (s.sop.status === 'draft') {
    return { plainKey: 'check', errorAt: null }
  }
  if (s.videoJob?.status === 'ready') {
    return { plainKey: 'ready', errorAt: null }
  }
  return { plainKey: 'render', errorAt: null }
}

// ─── Grace/stale-watchdog predicate (D-08 three-timer model) ───────────────
// ponytail: pure predicate extracted so the grace-timer/stale-watchdog logic
// has a unit-testable seam without rendering a component.
export function shouldStartPolling(lastUpdateMs: number, nowMs: number, thresholdMs: number): boolean {
  return nowMs - lastUpdateMs >= thresholdMs
}
