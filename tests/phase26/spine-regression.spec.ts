/**
 * Phase 26 Plan 26-14 -- R8 frozen-contract spine regression (cut down in Phase 58-16).
 *
 * What survived the retirement of the block model: the cases that guard behaviour the
 * focus screen still has.
 *
 *   (a) Publish gate  -- server still 400s `unverified_steps` on unticked steps (D-16).
 *   (c) No bulk-verify -- the D-21-07 lock holds: no bulk-verify affordance in src/.
 *   (d) Append-only   -- worker completion records are inserted, never mutated.
 *
 * The meta-survival case ((b), junctionId and block_provenance through the content
 * reducers) and the convert-time provenance case went with the block machinery.
 * Source-contract tripwires only. Runs under the `phase26` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

test.describe('R8 — frozen spine regression (post-block-model retirement)', () => {
  // (a) Publish gate — the server verify gate is the safety keystone.
  // Phase 29 factored the gate out of the route into assertPublishGates()
  // (publish-core.ts) so the chain-gate divert could reuse it. Assert the gate
  // WHERE IT LIVES, and that the route still CALLS it — wiring, not presence.
  test('publish route still rejects unticked steps with 400 unverified_steps', () => {
    const core = read('src/lib/governance/publish-core.ts')
    expect(core, 'gate must emit the unverified_steps error').toContain("error: 'unverified_steps'")
    expect(core, 'gate must reject with a 400').toMatch(/unverified_steps',\s*status:\s*400/)

    const route = read('src/app/api/sops/[sopId]/publish/route.ts')
    expect(route, 'publish route must call the shared gate').toContain('assertPublishGates(')
  })

  // (c) No bulk-verify affordance — the 2.5-min-at-50-blocks friction IS the
  //     safety feature (D-21-07). Re-assert the lock at the phase-close gate.
  test('no bulk-verify affordance leaked into src/', () => {
    const BANNED = ['approve all', 'verify all', 'select all', 'bulk verify', 'skip remaining']
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === '.next') continue
          walk(full)
        } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
          const rel = path.relative(ROOT, full).replace(/\\/g, '/')
          for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
            const t = line.trim()
            if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
            for (const p of BANNED) if (t.toLowerCase().includes(p)) hits.push(`${rel}: ${p}`)
          }
        }
      }
    }
    walk(path.join(ROOT, 'src'))
    expect(hits).toEqual([])
  })

  // (d) Append-only worker records — completions are inserted, sign-off chain has
  //     no UPDATE/DELETE (legal evidence). Tripwire on the action source.
  test('worker completion records remain append-only', () => {
    const src = read('src/actions/completions.ts')
    expect(src, 'sop_completions must be written via insert').toMatch(
      /from\('sop_completions'\)\s*\.insert\(/,
    )
    expect(src, 'sign-off chain is documented append-only').toContain('append-only')
  })
})
