/**
 * Phase 40 -- DUP-03 (D-07/D-08): one shared job-progress component. Today
 * PipelineStepper.tsx and PipelineProgressClient.tsx both hand-roll
 * realtime + polling status logic. Plan 40-03 consolidates onto
 * ParseJobStatus.tsx as the single realtime/polling owner and
 * src/lib/admin/job-stages.ts as the single stage-key -> plain-language map.
 * D-07: map DB stage keys to plain language AT RENDER TIME -- never rename
 * the DB stage values themselves, so this spec also locks the internal
 * keys as an anti-rename guard.
 *
 * `test.fixme` until 40-03.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')

const PIPELINE_STEPPER = path.join(SRC_DIR, 'components', 'admin', 'PipelineStepper.tsx')
const PIPELINE_PROGRESS_CLIENT = path.join(
  SRC_DIR,
  'app',
  '(protected)',
  'admin',
  'sops',
  'pipeline',
  '[pipelineId]',
  'PipelineProgressClient.tsx',
)
const PARSE_JOB_STATUS = path.join(SRC_DIR, 'components', 'admin', 'ParseJobStatus.tsx')
const JOB_STAGES = path.join(SRC_DIR, 'lib', 'admin', 'job-stages.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

function stripComments(src: string): string {
  return src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n')
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, out)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(full)
    }
  }
}

test.describe('DUP-03 -- one shared job-progress component', () => {
  test.fixme('PipelineStepper.tsx does not exist', () => {
    expect(fs.existsSync(PIPELINE_STEPPER)).toBe(false)
  })

  test.fixme('PipelineProgressClient contains zero realtime/polling wiring of its own', () => {
    const src = stripComments(read(PIPELINE_PROGRESS_CLIENT))
    for (const token of ['postgres_changes', 'setInterval', 'REALTIME_GRACE_MS', 'REALTIME_STALE_MS', 'POLL_INTERVAL_MS']) {
      expect(src).not.toContain(token)
    }
  })

  test.fixme('exactly one file under src/ contains both REALTIME_GRACE_MS and REALTIME_STALE_MS, and it is ParseJobStatus.tsx', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    const owners = files.filter((f) => {
      const src = stripComments(read(f))
      return src.includes('REALTIME_GRACE_MS') && src.includes('REALTIME_STALE_MS')
    })
    expect(owners).toEqual([PARSE_JOB_STATUS])
  })

  test.fixme('job-stages.ts exports STAGE_SETS with a video_generation key and a plain-language map', () => {
    const src = read(JOB_STAGES)
    expect(src).toContain('export const STAGE_SETS')
    expect(src).toContain('video_generation')
    for (const label of [
      'Uploading',
      'Reading your document',
      'Building the draft',
      'Checking',
      'Making the video',
      'Ready',
    ]) {
      expect(src).toContain(label)
    }
  })

  test.fixme('D-07: DB stage keys are never renamed -- job-stages.ts still maps every internal key', () => {
    const src = read(JOB_STAGES)
    for (const key of [
      'extracting_audio',
      'transcribing',
      'structuring',
      'verifying',
      'prompting',
      'drafting',
    ]) {
      expect(src).toContain(key)
    }
  })
})
