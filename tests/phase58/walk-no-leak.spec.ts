/**
 * Phase 58 -- FOC-04 (CLAUDE.md 2026-10-03): second-walk state does not leak.
 * Source-contract guards over the walk hook and the focus components; the
 * second-walk behaviour itself is proved by the deployed eval (58-18).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
const stripComments = (src: string) =>
  src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*\/|\*)/.test(l))
    .join('\n')

const HOOK = stripComments(read('src/hooks/useWalk.ts'))
const FOCUS_DIR = path.join(ROOT, 'src', 'components', 'focus')
const focusFiles = () =>
  fs
    .readdirSync(FOCUS_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({ f, code: stripComments(read(`src/components/focus/${f}`)) }))

test.describe('FOC-04 walk no-leak', () => {
  test('walk state is useState, reset when the SOP or the server walk id changes, with no store or persisted cache', () => {
    expect(HOOK).toContain('useState<WalkState | null>(initialWalk)')
    expect(HOOK).toContain('const seed = `${sopId}:${initialWalk?.id')
    expect(HOOK).toMatch(/if \(seed !== seenSeed\) \{[\s\S]*setWalk\(initialWalk\)[\s\S]*setPreviews\(\{\}\)/)
    expect(HOOK).not.toMatch(/from '@\/stores\//)
    expect(HOOK).not.toMatch(/localStorage|sessionStorage|persist|indexedDB|completionStore/)
  })

  test('photos go through useStepPhotos keyed to the walk id, and thumbnails are keyed by walk id', () => {
    expect(HOOK).toContain('useStepPhotos(walk?.id)')
    expect(HOOK).toContain('`${walk.id}:${id}`')
    expect(HOOK).toContain('photoApi.addPhoto(walk.id,')
  })

  test('every write goes through the server walk; state moves only from the walk it returns', () => {
    for (const call of ['startWalk(', 'recordWalkStep(', 'startOverWalk(']) expect(HOOK, call).toContain(call)
    expect(HOOK).toMatch(/action: 'complete'/)
    expect(HOOK).toMatch(/action: 'photo'/)
    // complete() and photo() advance only after a successful server walk.
    expect(HOOK).toMatch(/setWalk\(res\.walk\)\s*\n\s*afterWrite\(res\.walk, id\)/)
  })

  test('the step is synced to the URL with history.replaceState, never router.push', () => {
    expect(HOOK).toContain('window.history.replaceState')
    expect(HOOK).not.toMatch(/router\.push\(['"`]\?step/)
    // The only router call is the Start-over handler moving to another version; no effect navigates.
    expect(HOOK.match(/router\.(push|replace)\(/g)?.length).toBe(1)
    expect(HOOK).not.toMatch(/useEffect/)
  })

  test('no focus file imports the old stores or pushes a step into the URL', () => {
    for (const { f, code } of focusFiles()) {
      expect(code, f).not.toMatch(/completionStore|stores\/walkthrough/)
      expect(code, f).not.toMatch(/router\.push\(['"`]\?step/)
    }
    expect(HOOK).not.toContain('completionStore')
  })

  test('review sends from the walk row, and the labels come only from primaryLabel (one classifier)', () => {
    expect(read('src/components/focus/ReviewAndSend.tsx')).toContain('submitCompletion({ walkId')
    for (const { f, code } of focusFiles()) {
      expect(code, f).not.toMatch(/I understand — continue|I'm wearing it — continue/)
    }
    expect(read('src/components/focus/WalkStep.tsx')).toContain('primaryLabel(step.kind, isLast)')
  })

  test('the photo copy avoids the literal the Phase 55 photo-scan sweep forbids', () => {
    for (const { f, code } of focusFiles()) expect(code, f).not.toContain(['Take', 'a photo'].join(' '))
  })
})
