/**
 * Phase 56 / Plan 56-01 -- publish gate pin (SOP-01 / T-56-14).
 *
 * The sha256 of assertPublishGates' body. Any change to the gate body is a
 * phase-failing change; repoint PUBLISH_GATE_SHA256 only with a signed-off
 * decision (CLAUDE.md 2026-07-13: a safety gate edited without the guard
 * noticing is a gate that stopped gating).
 *
 * Re-pin history:
 *   - Phase 56 (43cd12ec...): the block-keyed gate, hashed before any Phase 56 edit.
 *   - D-16 (58-CONTEXT, 2026-10-05): the gate re-keyed from blocks to focus steps;
 *     the section-sign-off check and the ai_prompt / no-source bypass dropped. Now
 *     three counts for every SOP: at least one step, every step ticked, no open AI
 *     finding. This is the one signed-off re-pin.
 *
 * Registration: playwright.config.ts `phase56` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const PUBLISH_GATE_SHA256 = '78120e600bbd91d805a6317a7f98d37e5aa498f27a1ffb4a6519d5e52c962d33'
const src = fs
  .readFileSync(path.join(process.cwd(), 'src/lib/governance/publish-core.ts'), 'utf-8')
  .replace(/\r\n/g, '\n')

function bodyOf(decl: string): string {
  const start = src.indexOf(decl)
  expect(start, `${decl} not found`).toBeGreaterThan(-1)
  const end = src.indexOf('\nexport ', start + 1)
  return end === -1 ? src.slice(start) : src.slice(start, end)
}

test.describe('publish gate pin (LIVE)', () => {
  test('assertPublishGates body is byte-identical to the pinned hash', () => {
    const body = bodyOf('export async function assertPublishGates(')
    expect(createHash('sha256').update(body).digest('hex')).toBe(PUBLISH_GATE_SHA256)
  })

  test('performPublish runs the gate before anything that writes', () => {
    const body = bodyOf('export async function performPublish(')
    const gate = body.indexOf('assertPublishGates(')
    expect(gate).toBeGreaterThan(-1)
    const firstWrite = body.search(/\.(insert|update|upsert|delete)\(/)
    expect(firstWrite).toBeGreaterThan(gate)
  })
})
