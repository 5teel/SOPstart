/**
 * CAP-02 -- guard-exists-AND-is-called source contract for `requireSopEditAccess`.
 *
 * A file-level grep proves a token is somewhere in a file; it does NOT prove
 * the guard is actually wired at the call site a write function needs it at
 * (CLAUDE.md 2026-06-05 "dead feature" class -- a passing grep on an unused
 * import is a false green). This spec slices each target function's body
 * from the codebase and asserts the guard call lives INSIDE that slice, not
 * merely somewhere in the file.
 *
 * Positive set (guard must be called): the 9 content-write call sites RESEARCH
 * identified across sections.ts, sop-section-blocks.ts, and the legacy PATCH
 * route. Negative set (guard must NOT leak in, admin guard must stay): the 4
 * publish/verify-adjacent functions in sop-section-blocks.ts that CAP-02 must
 * not widen into (RESEARCH Pitfall 4 -- "edit" is not "admin rights").
 *
 * All tests here are `test.fixme` -- `requireSopEditAccess` does not exist
 * until Plan 46-03 adds it and swaps in the call sites. Plan 46-03's final
 * task removes the fixme markers.
 *
 * Registration: playwright.config.ts `phase46` project
 *   testDir: '.', testMatch: /tests\/phase46\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase46`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const GUARDS = path.join(ROOT, 'src', 'lib', 'auth', 'guards.ts')
const SECTIONS = path.join(ROOT, 'src', 'actions', 'sections.ts')
const BLOCKS = path.join(ROOT, 'src', 'actions', 'sop-section-blocks.ts')
const ROUTE = path.join(ROOT, 'src', 'app', 'api', 'sops', '[sopId]', 'sections', '[sectionId]', 'route.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
}

/**
 * Slices `source` from the first `export async function <exportedName>`
 * anchor to the next top-level `\nexport ` after it (or EOF). Throws a
 * descriptive error if the anchor is missing -- a renamed/removed function
 * must turn this spec RED, never silently pass an empty slice
 * (CLAUDE.md 2026-07-13: source-contract guards must be repointed when the
 * code they assert on moves).
 */
function fnBody(source: string, exportedName: string): string {
  const anchor = `export async function ${exportedName}`
  const start = source.indexOf(anchor)
  if (start === -1) {
    throw new Error(
      `fnBody: anchor "${anchor}" not found -- the function was renamed, removed, or the file no longer exports it as an async function`
    )
  }
  const nextExportIdx = source.indexOf('\nexport ', start + anchor.length)
  return nextExportIdx === -1 ? source.slice(start) : source.slice(start, nextExportIdx)
}

test.describe('CAP-02 -- requireSopEditAccess call-site wiring (source-contract)', () => {
  // activated by plan 46-03
  test('fnBody throws when the export anchor is absent (renamed/removed function turns this spec RED)', () => {
    expect(() => fnBody('export async function otherThing() {}', 'missingFn')).toThrow('fnBody: anchor')
  })

  // --- Positive wiring: sections.ts (4 call sites) ---
  // activated by plan 46-03
  test('sections.ts: createSection, reorderSections, updateSectionLayout, updateSectionTitle all call requireSopEditAccess(', () => {
    const src = read(SECTIONS)
    for (const fn of ['createSection', 'reorderSections', 'updateSectionLayout', 'updateSectionTitle']) {
      expect(fnBody(src, fn), `${fn} should call requireSopEditAccess(`).toContain('requireSopEditAccess(')
    }
  })

  // --- Positive wiring: sop-section-blocks.ts (4 call sites) ---
  // activated by plan 46-03
  test('sop-section-blocks.ts: addBlockToSection, removeBlockFromSection, setPinMode, reorderSectionBlocks all call requireSopEditAccess(', () => {
    const src = read(BLOCKS)
    for (const fn of ['addBlockToSection', 'removeBlockFromSection', 'setPinMode', 'reorderSectionBlocks']) {
      expect(fnBody(src, fn), `${fn} should call requireSopEditAccess(`).toContain('requireSopEditAccess(')
    }
  })

  // --- Positive wiring: legacy PATCH route (1 call site) ---
  // activated by plan 46-03
  test('the legacy sections/[sectionId] PATCH route calls requireSopEditAccess( before any write', () => {
    const src = read(ROUTE)
    expect(fnBody(src, 'PATCH')).toContain('requireSopEditAccess(')
  })

  // --- Negative / scope-containment: CAP-02 must not leak past "edit" ---
  // activated by plan 46-03 -- RESEARCH Pitfall 4
  test('verifyBlock, unverifyBlock, acceptBlockUpdate, declineBlockUpdate stay admin-only -- no requireSopEditAccess leak', () => {
    const src = read(BLOCKS)
    for (const fn of ['verifyBlock', 'unverifyBlock', 'acceptBlockUpdate', 'declineBlockUpdate']) {
      const body = fnBody(src, fn)
      expect(body, `${fn} must NOT call requireSopEditAccess(`).not.toContain('requireSopEditAccess(')
      expect(body, `${fn} must still call requireAdmin(`).toContain('requireAdmin(')
    }
  })

  // --- Guard-shape assertions on guards.ts ---
  // activated by plan 46-03
  test('guards.ts exports requireSopEditAccess and retains requireAdminContext unchanged', () => {
    const src = read(GUARDS)
    expect(src).toContain('export async function requireSopEditAccess')
    expect(src).toContain('export async function requireAdminContext')
  })

  // activated by plan 46-03 -- CLAUDE.md 2026-06-15/26/07-28: org-scope
  // sourced from the session, never trusted from the fetched row.
  // Repointed by the A1 resolution (Simon, 2026-08-25): sign-off authority =
  // approval-chain approvers, not sops.owner_user_id -- the guard body must
  // key the chain lookup on the SOP's category_slug and match steps via the
  // shared stepMatchesCaller helper (no forked matching logic).
  test('requireSopEditAccess self-enforces org-scope and grants via approval-chain step match (A1: approvers, not owner)', () => {
    const src = read(GUARDS)
    const body = fnBody(src, 'requireSopEditAccess')
    expect(body).toContain(".eq('organisation_id', organisationId)")
    expect(body).toContain('createAdminClient(')
    expect(body).toContain('category_slug')
    expect(body).toContain("from('approval_chains')")
    expect(body).toContain('stepMatchesCaller(')
    // The owner arm is GONE -- an owner_user_id read reappearing in this
    // guard body means the A1 flip regressed.
    expect(body).not.toContain('owner_user_id')
  })

  // --- Trust-boundary containment (repointed by the CR-01 fix): the parser's
  // service-role path is a different trust boundary, but it must NOT be a
  // wire-reachable flag on the server action (that was a network-reachable
  // auth bypass — every 'use server' export is a POST endpoint). It lives in
  // a plain core module with no action endpoint ID, and the exported server
  // action ALWAYS runs the guard. ---
  test('addBlockToSection has NO wire-reachable serviceRole bypass — guard always runs; the parser path lives in the non-server core module', () => {
    const src = read(BLOCKS)
    // The wire flag is gone from the action module entirely.
    expect(src, 'sop-section-blocks.ts must not carry a serviceRole wire flag').not.toContain('serviceRole: z')
    expect(src).not.toContain('data.serviceRole')
    // The guard runs unconditionally inside the action body.
    const body = fnBody(src, 'addBlockToSection')
    expect(body).toContain('requireSopEditAccess(')
    // The service path is a plain module (not 'use server' — no endpoint ID)
    // and performs no auth-flag branching.
    const core = read(path.join(ROOT, 'src', 'lib', 'builder', 'section-blocks-core.ts'))
    // A 'use server' DIRECTIVE must be the module's first statement -- check
    // that position, not token absence (the core's comments legitimately
    // mention the literal when explaining why it is NOT a server module).
    expect(
      /^\s*['"]use server['"]/.test(core),
      'core module must not open with a use server directive'
    ).toBe(false)
    expect(core).toContain('export async function addBlockToSectionAsService')
    // The parser imports the core entry point, not the guarded action.
    const parser = read(path.join(ROOT, 'src', 'lib', 'parsers', 'parsed-sop-to-layout-data.ts'))
    expect(parser).toContain('addBlockToSectionAsService')
  })
})
