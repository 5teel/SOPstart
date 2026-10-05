/**
 * Phase 58 -- WRK-04, SOP-04 (D-16 re-key the gate and re-pin its hash with the
 * decision recorded; D-18 notify on lineage publish).
 * Filled by: 58-05.
 *
 * The gate's behaviour is proved by scripts/verify-gate-check.tsx (real route,
 * run from tests/phase26/verify-gate.spec.ts); these are the source contracts
 * around it. Comment-stripped so a comment that quotes a literal cannot satisfy
 * or trip an assertion (CLAUDE.md 2026-09-28).
 *
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const readRaw = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n')
const read = (p: string) => strip(readRaw(p))

const CORE = 'src/lib/governance/publish-core.ts'
const core = read(CORE)

function bodyOf(src: string, decl: string): string {
  const start = src.indexOf(decl)
  expect(start, `${decl} not found`).toBeGreaterThan(-1)
  const end = src.indexOf('\nexport ', start + 1)
  return end === -1 ? src.slice(start) : src.slice(start, end)
}

const gate = bodyOf(core, 'export async function assertPublishGates(')

test.describe('WRK-04/SOP-04 publish gate', () => {
  test('the gate is re-keyed onto focus steps and the pin spec is re-pinned in the same commit with the decision recorded (D-16)', () => {
    expect(gate).toContain("from('sop_focus_steps')")
    expect(gate).toContain("from('sop_ai_findings')")
    expect(gate).toContain(".is('verified_by_admin_id', null)")
    expect(gate).toContain(".is('cleared_at', null)")
    for (const code of ['no_steps', 'unverified_steps', 'open_findings']) {
      expect(gate, code).toContain(`error: '${code}'`)
    }
    // No bypass of any kind, and no section sign-off any more.
    expect(gate).not.toContain('ai_prompt')
    expect(gate).not.toContain('source_file_path')
    expect(gate).not.toContain('sop_section_blocks')
    expect(gate).not.toContain('approved')
    // The decision is recorded where the hash lives.
    expect(readRaw('tests/phase56/publish-gate-pin.spec.ts')).toContain('D-16')
  })

  test('performPublish still runs the gate before its first write, and the gate writes nothing', () => {
    const publish = bodyOf(core, 'export async function performPublish(')
    const gateAt = publish.indexOf('assertPublishGates(')
    expect(gateAt).toBeGreaterThan(-1)
    expect(publish.search(/\.(insert|update|upsert|delete)\(/)).toBeGreaterThan(gateAt)
    expect(gate).not.toMatch(/\.(insert|update|upsert|delete)\(/)
    expect(gate).not.toContain('recordDecision')
    expect(read('src/app/api/sops/[sopId]/publish/route.ts')).toContain('assertPublishGates(')
  })

  test('getPublishGateStatus agrees with assertPublishGates for the same SOP', () => {
    const status = read('src/actions/publish-gate.ts')
    expect(status).toContain("'use server'")
    expect(status).toContain('export async function getPublishGateStatus')
    expect(status).toContain("from('sop_focus_steps')")
    expect(status).toContain("from('sop_ai_findings')")
    expect(status).toContain(".is('verified_by_admin_id', null)")
    expect(status).toContain(".is('cleared_at', null)")
    expect(status).not.toContain('ai_prompt')
    // Bottom-bar copy (UI-SPEC).
    expect(status).toContain('Add at least one step')
    expect(status).toContain('still to check')
    // The old builder's chip answers from the same function.
    const old = read('src/actions/sop-section-blocks.ts')
    expect(bodyOf(old, 'export async function getPublishGateStatus(')).toContain('getStepGateStatus(')
  })

  test.fixme('notifyAssignedWorkers runs when a lineage publish supersedes a version (D-18) (58-05)', () => {})
})
