/**
 * Phase 40 gap closure -- CR-04 / WR-02: `reparseSop` used to delete
 * `sop_sections` and reset the SOP to `status: 'parsing'` BEFORE checking
 * whether the source file still exists in storage -- so a missing file
 * (incomplete upload, storage cleanup, or an AI-prompt SOP's synthetic
 * source path) destroyed the SOP's sections and stranded it in `parsing`
 * with no recovery. Plan 40-13 reorders every precondition (auth, role,
 * org, SOP exists, source file exists) before the first destructive call.
 *
 * This is a POSITIONAL assertion, not a presence grep (CLAUDE.md
 * [2026-06-05]): a grep for `createSignedUrl(` would have passed on the
 * buggy code too, since the call existed -- just too late. Ordering is
 * the actual guarantee.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40 | grep reparse-precondition`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SOPS_ACTIONS = path.join(ROOT, 'src', 'actions', 'sops.ts')
const PARSE_JOB_STATUS = path.join(ROOT, 'src', 'components', 'admin', 'ParseJobStatus.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

function reparseSopSlice(): string {
  const src = read(SOPS_ACTIONS)
  const start = src.indexOf('export async function reparseSop')
  expect(start).toBeGreaterThan(-1)
  const nextFnRelative = src.slice(start + 1).indexOf('export async function')
  const end = nextFnRelative === -1 ? src.length : start + 1 + nextFnRelative
  return src.slice(start, end)
}

test.describe('40-13 -- safe re-parse preconditions', () => {
  test('createSignedUrl precedes both destructive calls in reparseSop', () => {
    const slice = reparseSopSlice()
    const signedUrlIdx = slice.indexOf('createSignedUrl(')
    const deleteIdx = slice.indexOf(".from('sop_sections')")
    const statusIdx = slice.indexOf("status: 'parsing'")

    expect(signedUrlIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(-1)
    expect(statusIdx).toBeGreaterThan(-1)

    expect(signedUrlIdx, 'createSignedUrl check must run before sop_sections delete').toBeLessThan(deleteIdx)
    expect(signedUrlIdx, 'createSignedUrl check must run before status reset to parsing').toBeLessThan(statusIdx)
  })

  test('reparseSop guards role and org before any destructive call', () => {
    const slice = reparseSopSlice()
    expect(slice).toContain("'safety_manager'")
    expect(slice).toContain("'admin'")
    // Org comparison must be against the SESSION organisationId, not a value
    // derived from the fetched row's own org (CLAUDE.md [2026-07-28]).
    expect(slice).toContain('sop.organisation_id !== organisationId')

    const roleCheckIdx = slice.indexOf("'safety_manager'")
    const deleteIdx = slice.indexOf(".from('sop_sections')")
    expect(roleCheckIdx).toBeLessThan(deleteIdx)
  })

  test('the source file existence error message is unchanged', () => {
    const slice = reparseSopSlice()
    expect(slice).toContain('Source file not found')
  })

  test('ParseJobStatus does not route re-parse retries to the ai-prompt endpoint', () => {
    const src = read(PARSE_JOB_STATUS)
    expect(src).not.toContain('/api/sops/ai-prompt')
  })

  test('the retry affordance is gated off for ai_prompt drafts', () => {
    const src = read(PARSE_JOB_STATUS)
    expect(src).toContain("inputType !== 'ai_prompt'")
    // The gate must actually wrap the "Try again" button, not merely exist
    // as a dead constant (CLAUDE.md [2026-06-05] dead-affordance class).
    expect(src).toMatch(/canRetry &&[\s\S]{0,80}onClick=\{handleReparse\}/)
  })

  test('the retry fetch handler inspects the response instead of swallowing it', () => {
    const src = read(PARSE_JOB_STATUS)
    // Scoped to handleReparse only -- handleRestructure's fire-and-forget
    // .catch(console.error) is out of scope for this gap-closure pass.
    const handleReparseStart = src.indexOf('const handleReparse')
    const handleReparseEnd = src.indexOf('const handleRestructure')
    const body = src.slice(handleReparseStart, handleReparseEnd)

    expect(body).not.toMatch(/\.catch\(console\.error\)/)
    expect(body).toContain('res.ok')
    // Both a non-2xx branch and a network-error catch must restore 'failed'.
    const failedOccurrences = body.match(/setStatus\('failed'\)/g) ?? []
    expect(failedOccurrences.length).toBeGreaterThanOrEqual(2)
  })
})
