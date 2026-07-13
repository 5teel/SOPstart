/**
 * Phase 26 Plan 26-14 — R8 frozen-contract spine regression.
 *
 * The convert-golden-path spec proves layout_data/junction/provenance are
 * byte-equivalent to the pre-phase baseline (R6). This spec sweeps the REST of
 * the frozen spine (R8) — the four invariants the full-bespoke swap (D-01) must
 * NOT have touched:
 *
 *   (a) Publish gate  — server still 400s `unverified_blocks` on unverified blocks.
 *   (b) Meta survival — a converted block round-tripped through the bespoke
 *                       content-ops editor keeps `props.junctionId` +
 *                       `block_provenance` (behavioural, not grep).
 *   (c) No bulk-verify — the D-21-07 lock holds: no bulk-verify affordance in src/.
 *   (d) Append-only   — worker completion records are inserted, never mutated.
 *
 * (a)/(c)/(d) are source-contract tripwires; (b) exercises the real pure
 * reducers (content-ops is React-free, imported via the relative path the
 * phase26 project requires — no `@/` alias). Runs under the `phase26` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  updateBlockProps,
  reorderBlocks,
  duplicateBlock,
  type LayoutItem,
} from '../../src/lib/builder/content-ops'
import { buildGoldenSnapshot } from '../../scripts/capture-convert-golden'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

test.describe('R8 — frozen spine regression (post-bespoke swap)', () => {
  // (a) Publish gate — the server verify gate is the safety keystone.
  // Phase 29 factored the gate out of the route into assertPublishGates()
  // (publish-core.ts) so the chain-gate divert could reuse it. Assert the gate
  // WHERE IT LIVES, and that the route still CALLS it — wiring, not presence.
  test('publish route still rejects unverified blocks with 400 unverified_blocks', () => {
    const core = read('src/lib/governance/publish-core.ts')
    expect(core, 'gate must emit the unverified_blocks error').toContain("error: 'unverified_blocks'")
    expect(core, 'gate must reject with a 400').toMatch(/unverified_blocks',\s*status:\s*400/)

    const route = read('src/app/api/sops/[sopId]/publish/route.ts')
    expect(route, 'publish route must call the shared gate').toContain('assertPublishGates(')
  })

  // (b) Meta survival — the WHOLE point of D-01/R7: bespoke edit ops must never
  //     drop junctionId / block_provenance. Exercise the real reducers.
  test('converted block keeps junctionId + block_provenance through edit ops', () => {
    const item: LayoutItem = {
      type: 'HazardCardBlock',
      props: {
        id: 'blk-1',
        title: 'Alkaline burn',
        severity: 'critical',
        junctionId: 'jct-abc',
        block_provenance: { region: { paragraph_id: 'p-1' }, parser_run_id: 'r1' },
      },
    }
    let content: LayoutItem[] = [item, { type: 'TextBlock', props: { id: 'blk-2' } }]

    // Edit a field (Pattern-A/B commit path) → spread-merge must preserve meta.
    content = updateBlockProps(content, 'blk-1', { title: 'Alkaline burn — tank 3' })
    // Reorder (dnd reflow) → same object identity, meta intact.
    content = reorderBlocks(content, 0, 1)
    const edited = content.find((c) => c.props.id === 'blk-1')!
    expect(edited.props.title).toBe('Alkaline burn — tank 3')
    expect(edited.props.junctionId).toBe('jct-abc')
    expect(edited.props.block_provenance).toEqual({
      region: { paragraph_id: 'p-1' },
      parser_run_id: 'r1',
    })

    // Duplicate → clone gets a fresh id + junctionId carried on props (materialize
    // re-stamps a new junction on save); block_provenance is deep-copied, not shared.
    const dup = duplicateBlock(content, 'blk-1')
    const clone = dup.filter((c) => c.type === 'HazardCardBlock').find((c) => c.props.id !== 'blk-1')!
    expect(clone.props.id).not.toBe('blk-1')
    expect(clone.props.block_provenance).toEqual(edited.props.block_provenance)
    expect(clone.props.block_provenance).not.toBe(edited.props.block_provenance)
  })

  // Convert-time provenance: every junction the converter emits is provenanced &
  // unverified — the row shape the publish gate later counts against.
  test('every converted junction is pinned, unverified, and provenanced', () => {
    const junctions = buildGoldenSnapshot().sections.flatMap((s) => s.junctions)
    expect(junctions.length).toBeGreaterThan(0)
    for (const j of junctions) {
      expect(j.pin_mode).toBe('pinned')
      expect(j.verified).toBe(false)
      expect(j.block_provenance).not.toBeNull()
    }
  })

  // (c) No bulk-verify affordance — the 2.5-min-at-50-blocks friction IS the
  //     safety feature (D-21-07). Re-assert the lock at the phase-close gate.
  test('no bulk-verify affordance leaked into src/', () => {
    const BANNED = ['approve all', 'verify all', 'select all', 'bulk verify', 'skip remaining']
    const ALLOW = new Set([
      'src/components/admin/verify-checklist/VerifyChecklistGate.tsx',
      'src/components/admin/verify-checklist/__tests__/VerifyChecklistGate.test.tsx',
    ])
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === '.next') continue
          walk(full)
        } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
          const rel = path.relative(ROOT, full).replace(/\\/g, '/')
          if (ALLOW.has(rel)) continue
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
