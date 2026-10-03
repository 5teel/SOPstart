/**
 * Phase 56 / Plan 56-01 -- publish gate pin (SOP-01 / T-56-14).
 *
 * The sha256 of assertPublishGates' body was taken BEFORE any Phase 56 edit to
 * publish-core.ts. Any change to the gate body is a phase-failing change;
 * repoint PUBLISH_GATE_SHA256 only with a signed-off decision (CLAUDE.md
 * 2026-07-13: a safety gate edited without the guard noticing is a gate that
 * stopped gating).
 *
 * Registration: playwright.config.ts `phase56` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const PUBLISH_GATE_SHA256 = '43cd12ec266ec2508c710c8e7faac869b3ae7a128a947940fce29ce5a0935849'
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
