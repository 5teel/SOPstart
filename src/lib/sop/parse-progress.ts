/**
 * Phase 58 -- what the "still parsing" view says (WRK-03, D-19).
 *
 * Plain module. A pure function of input type, job status, current stage and
 * elapsed time. Stage words come from the one vocabulary in
 * src/lib/admin/job-stages.ts. No page counts, and never a countdown: the time
 * is a rounded rough guess that bottoms out at "Less than a minute left".
 *
 * parse_jobs.input_type values: upload | scan | url (a document), video_file |
 * youtube_url (a video), ai_prompt.
 */
import { STAGE_TO_PLAIN, type PlainStageKey } from '@/lib/admin/job-stages'

export interface ParseProgress {
  state: 'queued' | 'running' | 'done' | 'failed'
  stage: PlainStageKey | null
  detail: string | null
  eta: string | null
}

const VIDEO = ['video_file', 'youtube_url']

// Rough whole-job estimates in seconds (planner heuristics, D-19).
const ESTIMATE_S = (inputType: string) => (VIDEO.includes(inputType) ? 120 : inputType === 'ai_prompt' ? 30 : 60)

const READ_DETAIL = (inputType: string) =>
  VIDEO.includes(inputType) ? 'Transcribing the video' : inputType === 'ai_prompt' ? 'Writing a first draft' : 'Reading the document'

const STAGE_DETAIL: Record<PlainStageKey, string | null> = {
  upload: 'Uploading',
  read: null, // per input type
  draft: 'Building the draft',
  check: 'Checking the steps',
  ready: 'Done',
}

function eta(inputType: string, elapsedMs: number): string {
  const left = ESTIMATE_S(inputType) - elapsedMs / 1000
  if (left <= 30) return 'Less than a minute left'
  if (left <= 60) return 'About a minute left'
  return 'About 2 minutes left' // the longest estimate is 120 s, so this is the top rung
}

export function parseProgress(input: {
  inputType: string
  status: string
  currentStage: string | null
  elapsedMs: number
}): ParseProgress {
  const { inputType, status, currentStage, elapsedMs } = input
  if (status === 'queued') return { state: 'queued', stage: null, detail: 'Waiting its turn…', eta: null }
  if (status === 'completed') return { state: 'done', stage: 'ready', detail: 'Done', eta: null }
  if (status === 'failed') return { state: 'failed', stage: null, detail: null, eta: null }

  // Running. A document parse writes no stage yet, so infer the first one.
  const stage = (currentStage && STAGE_TO_PLAIN[currentStage]) || 'read'
  return { state: 'running', stage, detail: STAGE_DETAIL[stage] ?? READ_DETAIL(inputType), eta: eta(inputType, elapsedMs) }
}
