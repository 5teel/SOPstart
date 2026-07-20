/**
 * Gap 2 (CR-02, dead assigned-first picker for supervisors) — source
 * contract wiring proof.
 *
 * `listWorkerSopsForPicker` read `sop_assignments` with the SESSION
 * client, whose RLS (00007 workers_can_view_own_assignments) only exposes
 * rows visible to the CALLER, never the observed worker — so for a
 * supervisor recording on behalf of a worker (the phase's primary
 * persona), `assignedIds` was always empty and the D-06 "assigned-first"
 * ordering silently never fired. Fixed by role-gating the action and
 * reading `sop_assignments` via the admin client with explicit org
 * self-scoping on both queries, keyed to the OBSERVED worker's role.
 *
 * This is a source-contract wiring test, not a runtime probe: the fix
 * lives entirely inside a 'use server' action unreachable from a
 * Node-context Playwright spec without a real browser session (unlike
 * the RLS-only Gap 1 fix). Per CLAUDE.md 2026-06-05, asserting mere
 * token PRESENCE is insufficient — these assertions target the extracted
 * function body only, checking real wiring (which client, which id).
 *
 * Registration: playwright.config.ts `phase34` project
 *   testDir: '.', testMatch: /tests\/phase34\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase34`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OBSERVATIONS_ACTION = path.join(ROOT, 'src', 'actions', 'observations.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

function extractFunctionBody(src: string, exportSignature: string): string {
  const start = src.indexOf(exportSignature)
  if (start === -1) throw new Error(`${exportSignature} not found`)
  const nextExport = src.indexOf('\nexport ', start + 1)
  return nextExport === -1 ? src.slice(start) : src.slice(start, nextExport)
}

test.describe('CR-02 Gap 2 — listWorkerSopsForPicker wiring source contract', () => {
  test('role-gated to recorder roles', () => {
    const src = read(OBSERVATIONS_ACTION)
    const fnBody = extractFunctionBody(src, 'export async function listWorkerSopsForPicker')
    expect(fnBody).toContain('RECORDER_ROLES.includes(role)')
  })

  test('exactly two sop_assignments reads, both via the admin client (not the session client)', () => {
    const src = read(OBSERVATIONS_ACTION)
    const fnBody = extractFunctionBody(src, 'export async function listWorkerSopsForPicker')

    const fromCalls = [...fnBody.matchAll(/(\w+)\s*\n?\s*\.from\('sop_assignments'\)/g)]
    expect(fromCalls).toHaveLength(2)
    for (const match of fromCalls) {
      expect(match[1]).toBe('admin')
    }
  })

  test('both sop_assignments reads are org-scoped via .eq(\'organisation_id\', organisationId)', () => {
    const src = read(OBSERVATIONS_ACTION)
    const fnBody = extractFunctionBody(src, 'export async function listWorkerSopsForPicker')

    const fromIndexes = [...fnBody.matchAll(/\.from\('sop_assignments'\)/g)].map((m) => m.index ?? -1)
    expect(fromIndexes).toHaveLength(2)
    for (const idx of fromIndexes) {
      const window = fnBody.slice(idx, idx + 120)
      expect(window).toContain(".eq('organisation_id', organisationId)")
    }
  })

  test('role-assignment query keys off the OBSERVED worker (workerMember.role), never the caller (role)', () => {
    const src = read(OBSERVATIONS_ACTION)
    const fnBody = extractFunctionBody(src, 'export async function listWorkerSopsForPicker')

    expect(fnBody).toContain(".eq('role', workerMember.role)")
    expect(fnBody).not.toContain(".eq('role', role)")
  })
})
