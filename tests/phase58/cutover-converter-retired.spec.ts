/**
 * Phase 58 -- cutover (D-23): the converter is retired after its final run.
 * Filled by: 58-14.
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ticksToCarry, type FocusStepDraft } from '@/lib/sop/convert'
import type { Section } from '@/lib/sop/sections'

const ROOT = path.resolve(__dirname, '..', '..')
const SCRIPT = 'scripts/convert-sops-to-steps.ts'
const SRC = fs.readFileSync(path.join(ROOT, SCRIPT), 'utf-8').replace(/\r\n/g, '\n')

test.describe('cutover converter retired', () => {
  test('--apply exits 1 and prints "converter retired in Phase 58" (D-23), with an empty environment', () => {
    for (const extra of [['--all'], []]) {
      const r = spawnSync('npx', ['tsx', SCRIPT, '--apply', ...extra], {
        cwd: ROOT, shell: true, encoding: 'utf8', env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' } as unknown as NodeJS.ProcessEnv, timeout: 120_000,
      })
      expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(1)
      expect(r.stderr).toContain('converter retired in Phase 58')
    }
  })

  test('the refusal comes before any env read or client creation', () => {
    const refuse = SRC.indexOf('converter retired in Phase 58 —')
    expect(refuse).toBeGreaterThan(-1)
    expect(SRC.indexOf("process.exit(1)", refuse)).toBeGreaterThan(refuse)
    expect(refuse).toBeLessThan(SRC.indexOf('createClient('))
    expect(refuse).toBeLessThan(SRC.indexOf("fs.readFileSync(f, 'utf8')"))
    expect(refuse).toBeLessThan(SRC.indexOf('main()'))
  })

  test('--missing converts only SOPs with zero focus steps (D-23)', () => {
    expect(SRC).toContain("const MISSING = args.includes('--missing')")
    expect(SRC).toContain("MISSING ? (ex.length ? 'has steps' : null)")
    // A SOP with steps is never written: the write loop skips native, and the missing path issues no delete.
    expect(SRC).toContain("if (state === 'native' || state === 'in_flight') { action.set(sop.id, state); continue }")
    expect(SRC).not.toMatch(/\.delete\(/)
    expect(SRC).not.toMatch(/\.from\('sop_(sections|steps)'\)\s*\.(insert|update|upsert|delete)/)
  })

  test('native new: and edit: keys are never touched (D-23)', () => {
    expect(SRC).toContain('/^(new|edit):/')
    expect(SRC).toContain("'native keys'")
    expect(SRC).toContain("'ticked in the editor'")
    expect(SRC).toContain("'edited since the last run'")
  })

  test('ticksToCarry puts a verified junction on the step it produced and its warning hazard, nothing else', () => {
    const section = {
      id: 'sec1',
      layout_data: { content: [
        { type: 'StepBlock', props: { id: 'a', junctionId: 'j1' } },
        { type: 'StepBlock', props: { id: 'b', junctionId: 'j2' } },
        { type: 'StepBlock', props: { id: 'a', junctionId: 'j3' } }, // duplicate id -> key 'a#2'
      ] },
    } as unknown as Section
    const d = (sourceKey: string): FocusStepDraft => ({
      sectionId: 'sec1', kind: 'step', text: 't', tip: null, photoRequired: false, imagePaths: [], requiredTools: null, timeEstimateMinutes: null, sortOrder: 0, sourceKey,
    })
    const steps = [d('a:w'), d('a'), d('b'), d('a#2')]
    const got = ticksToCarry([section], steps, new Map([['j1', { by: 'u1', at: 't1' }], ['j3', { by: 'u1', at: 't3' }]]))
    expect(got.map((g) => g.sourceKey).sort()).toEqual(['a', 'a#2', 'a:w'])
    expect(ticksToCarry([section], steps, new Map())).toEqual([])
  })
})
