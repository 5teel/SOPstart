/**
 * Phase 40 (Plan 40-01) -- LIVE from wave 1 onward: a guard on the frozen
 * parse -> AI-review -> verify -> publish spine.
 *
 * CLAUDE.md [2026-07-13]: a relocated/edited guard whose spec still greps
 * the OLD file is a guard that stopped guarding (this exact class of bug hit
 * Phase 29's chain-gate extraction). Plan 40-05 edits publish-core.ts (cadence
 * read) later in this phase and must not touch the gate itself -- this spec
 * pins both the gate body AND the route's call site so any accidental edit
 * to assertPublishGates fails loudly, before 40-05 lands.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const PUBLISH_CORE = path.join(ROOT, 'src', 'lib', 'governance', 'publish-core.ts')
const PUBLISH_ROUTE = path.join(ROOT, 'src', 'app', 'api', 'sops', '[sopId]', 'publish', 'route.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('Frozen publish spine (spine-freeze, LIVE)', () => {
  test('publish-core.ts exports assertPublishGates', () => {
    const src = read(PUBLISH_CORE)
    expect(src).toContain('export async function assertPublishGates(')
  })

  test('assertPublishGates body still contains the unverified_blocks gate and status: 400', () => {
    const src = read(PUBLISH_CORE)
    const start = src.indexOf('export async function assertPublishGates(')
    expect(start).toBeGreaterThan(-1)
    // Body runs from the function declaration to the next top-level export.
    const end = src.indexOf('\nexport ', start + 1)
    const body = end > -1 ? src.slice(start, end) : src.slice(start)
    expect(body).toContain('unverified_blocks')
    expect(body).toContain('status: 400')
  })

  test('publish route.ts calls assertPublishGates(', () => {
    const src = read(PUBLISH_ROUTE)
    expect(src).toContain('assertPublishGates(')
  })
})
