/**
 * Phase 58 -- WRK-03 still-parsing copy (58-02 Task 2, D-19). Unit spec, static imports.
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import { parseProgress } from '@/lib/sop/parse-progress'

const run = (inputType: string, elapsedMs = 10_000, currentStage: string | null = null, status = 'processing') =>
  parseProgress({ inputType, status, currentStage, elapsedMs })

test.describe('parseProgress', () => {
  test('document: reading, about a minute', () => {
    for (const t of ['upload', 'scan', 'url']) {
      expect(run(t), t).toEqual({ state: 'running', stage: 'read', detail: 'Reading the document', eta: 'About a minute left' })
    }
  })

  test('video: transcribing, about 2 minutes', () => {
    for (const t of ['video_file', 'youtube_url']) {
      expect(run(t, 10_000, 'transcribing'), t).toMatchObject({ detail: 'Transcribing the video', eta: 'About 2 minutes left' })
    }
  })

  test('AI prompt: first draft, less than a minute', () => {
    expect(run('ai_prompt', 5_000, 'prompting')).toMatchObject({ stage: 'read', detail: 'Writing a first draft', eta: 'Less than a minute left' })
  })

  test('the stage comes from the plain vocabulary', () => {
    expect(run('upload', 10_000, 'structuring')).toMatchObject({ stage: 'draft', detail: 'Building the draft' })
    expect(run('upload', 10_000, 'verifying')).toMatchObject({ stage: 'check' })
  })

  test('time shrinks, rounds up, and bottoms out once the estimate is spent', () => {
    expect(run('video_file', 70_000).eta).toBe('About a minute left')
    expect(run('upload', 500_000).eta).toBe('Less than a minute left')
  })

  test('queued, done and failed', () => {
    expect(run('upload', 0, null, 'queued')).toEqual({ state: 'queued', stage: null, detail: 'Waiting its turn…', eta: null })
    expect(run('upload', 0, 'completed', 'completed')).toMatchObject({ state: 'done', eta: null })
    expect(run('upload', 0, 'failed', 'failed')).toMatchObject({ state: 'failed', eta: null })
  })

  test('no page counts anywhere', () => {
    expect(JSON.stringify(run('upload'))).not.toMatch(/page \d/i)
  })
})
