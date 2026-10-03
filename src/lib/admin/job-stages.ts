// Phase 40 -- DUP-03 (D-07/D-08): the ONE plain-language stage vocabulary for
// every job-progress surface (document parse, AI-prompt draft, video parse).
//
// D-07 is the constraint: ONE plain-language vocabulary, mapped over
// untouched internal keys. Nothing in this module renames a DB value --
// `parse_jobs.current_stage` keeps
// every existing internal key verbatim; this module only maps them onto
// worker-plain words at render time.

export type PlainStageKey = 'upload' | 'read' | 'draft' | 'check' | 'ready'

// The single ordered worker-plain vocabulary (Phase 30 UX-07 plain-language
// register: what the admin is waiting for, not what the code is doing).
export const PLAIN_STAGES: ReadonlyArray<{ key: PlainStageKey; label: string }> = [
  { key: 'upload', label: 'Uploading' },
  { key: 'read', label: 'Reading your document' },
  { key: 'draft', label: 'Building the draft' },
  { key: 'check', label: 'Checking' },
  { key: 'ready', label: 'Ready' },
]

// Every internal DB stage value in use today (parse_jobs.current_stage), mapped onto a plain key. These
// internal keys are NOT renamed -- they still get written to the DB verbatim.
export const STAGE_TO_PLAIN: Record<string, PlainStageKey> = {
  uploading: 'upload',
  extracting_audio: 'read',
  transcribing: 'read',
  prompting: 'read',
  parsing: 'read',
  structuring: 'draft',
  drafting: 'draft',
  verifying: 'check',
  review: 'check',
  ready: 'ready',
}

// Ordered plain-key subset each pipeline walks, keyed the same way
// ParseJobStatus keys today (parse_jobs.input_type).
export const STAGE_SETS: Record<string, ReadonlyArray<PlainStageKey>> = {
  video_file: ['upload', 'read', 'draft', 'check'],
  youtube_url: ['upload', 'read', 'draft', 'check'],
  ai_prompt: ['read', 'draft', 'check'],
  // Plain document parse (parse_jobs.input_type === 'upload') -- closes the
  // gap where a plain document parse rendered no stepper at all.
  upload: ['upload', 'read', 'draft', 'check'],
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

// ─── Grace/stale-watchdog predicate (D-08 three-timer model) ───────────────
// ponytail: pure predicate extracted so the grace-timer/stale-watchdog logic
// has a unit-testable seam without rendering a component.
export function shouldStartPolling(lastUpdateMs: number, nowMs: number, thresholdMs: number): boolean {
  return nowMs - lastUpdateMs >= thresholdMs
}
