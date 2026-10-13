/**
 * Phase 58 -- FOC-04 (CLAUDE.md 2026-10-03), ADR-0012: a run's state does not leak.
 * Source-contract guards over the run hook and the SOP view; the behaviour itself is
 * proved by the deployed eval (start.eval RUN-*). Registration: playwright.config.ts `phase58`.
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

const HOOK = stripComments(read('src/hooks/useRun.ts'))
const VIEW = stripComments(read('src/components/home/ReadView.tsx'))
const SHELL = stripComments(read('src/components/home/HomeShell.tsx'))
const FOCUS_DIR = path.join(ROOT, 'src', 'components', 'focus')
const focusFiles = () =>
  fs
    .readdirSync(FOCUS_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({ f, code: stripComments(read(`src/components/focus/${f}`)) }))

test.describe('FOC-04 run no-leak (ADR-0012)', () => {
  test('run state is useState in the hook, and the view is keyed by SOP id so a second SOP starts clean', () => {
    expect(HOOK).toContain('useState<WalkState | null>(null)')
    expect(SHELL).toMatch(/<ReadView\s+key=\{openRow\.id\}/)
    expect(HOOK).not.toMatch(/from '@\/stores\//)
    expect(HOOK).not.toMatch(/localStorage|sessionStorage|persist|indexedDB|completionStore/)
    // Done after Send drops the run, so the next Start opens a fresh one.
    expect(HOOK).toMatch(/const finish = useCallback\(\(\) => \{[\s\S]*show\(null\)/)
  })

  test('photos go through useStepPhotos keyed to the run id', () => {
    expect(HOOK).toContain('useStepPhotos(walk?.id)')
    expect(HOOK).toContain('photoApi.addPhoto(walk.id,')
  })

  test('every write goes through the server run; a tick shows at once, writes queue in order and a failure falls back to the server', () => {
    for (const call of ['startWalk(', 'recordWalkStep(', 'startOverWalk(', 'submitCompletion({ walkId']) expect(HOOK, call).toContain(call)
    expect(HOOK).toMatch(/action: 'complete'/)
    expect(HOOK).toMatch(/action: 'photo'/)
    // ADR-0012 (amended): the tick is written through one queue; when it drains the rows follow the server's last answer.
    expect(HOOK).toContain('return enqueue(async () => {')
    expect(HOOK).toMatch(/if \(--pending\.current > 0\) return[\s\S]*setWalk\(saved\.current\)/)
    expect(HOOK).toContain("window.addEventListener('beforeunload', holdUnload)")
    // Photos, Send and Stop wait for every queued tick first.
    expect(HOOK.match(/await queue\.current/g)?.length).toBe(3)
    expect(HOOK).toContain("new Set(Object.keys(walk?.done ?? {}))")
  })

  test('reading writes nothing: no server action fires on opening, only from a press', () => {
    // The view's only effects are the merge prefetch and scrolling the next step into view.
    const effects = VIEW.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\)/g) ?? []
    expect(effects.length).toBe(2)
    for (const e of effects) expect(e).not.toMatch(/run\.(begin|startOver|tick|photo|send)\(/)
    expect(HOOK).not.toMatch(/useEffect/)
  })

  test('a stale-run refusal drops the local run; a locked step or missing photo is said in its own words', () => {
    for (const msg of ['Start the SOP again.', 'That step is not part of this SOP.']) expect(HOOK).toContain(`'${msg}':`)
    // lockstep (63-16): the keys equal the strings the server actions return, character for character
    const server = stripComments(read('src/actions/walk.ts')) + stripComments(read('src/actions/completions.ts'))
    for (const msg of ['Start the SOP again.', 'That step is not part of this SOP.', 'Finish the steps before this one first.', 'Add a photo to continue.'])
      expect(server).toContain(`'${msg}'`)
    expect(HOOK).toMatch(/if \(STALE\[msg\]\) \{[\s\S]*show\(null\)[\s\S]*setRunning\(false\)/)
    expect(HOOK).toContain("'Finish the steps before this one first.'")
    expect(HOOK).toContain("'Add a photo to continue.'")
  })

  test('no focus file or the view imports the old stores or pushes a step into the URL', () => {
    for (const { f, code } of [...focusFiles(), { f: 'ReadView.tsx', code: VIEW }]) {
      expect(code, f).not.toMatch(/completionStore|stores\/walkthrough/)
      expect(code, f).not.toMatch(/router\.push\(['"`]\?step/)
    }
  })

  test('tick names come only from tickLabel (one classifier)', () => {
    expect(VIEW).toContain('tickLabel(step.kind)')
    for (const { f, code } of [...focusFiles(), { f: 'ReadView.tsx', code: VIEW }]) {
      expect(code, f).not.toMatch(/'I understand the hazard'|"I'm wearing it"/)
    }
  })

  test('the photo copy avoids the literal the Phase 55 photo-scan sweep forbids', () => {
    for (const { f, code } of [...focusFiles(), { f: 'ReadView.tsx', code: VIEW }]) expect(code, f).not.toContain(['Take', 'a photo'].join(' '))
  })
})
