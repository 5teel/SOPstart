/**
 * Phase 40 -- gap closure 40-12 (40-REVIEW.md CR-02, folds in WR-03).
 *
 * `/api/sops/parse`, `/api/sops/transcribe` and `/api/sops/restructure` took
 * `sopId` from the request body and operated exclusively through
 * `createAdminClient()` (RLS bypass) with no auth, role or org check -- a
 * destructive cross-tenant write/spend reachable by any authenticated user,
 * worker role included. This spec pins the fix POSITIONALLY (guard must sit
 * before the first destructive admin-client call, not just be present
 * somewhere in the file -- CLAUDE.md [2026-06-05]/[2026-07-13] source-contract
 * learning: presence-only greps let a guard get moved below the code it was
 * meant to protect and never notice) and census every file under
 * `src/app/api/sops/` reaching for the RLS-bypassing admin client, so a NEW
 * route doing the same thing fails until it is classified.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40 | grep route-auth-org-scope`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const SOPS_API_DIR = path.join(SRC_DIR, 'app', 'api', 'sops')

const PARSE_ROUTE = path.join(SOPS_API_DIR, 'parse', 'route.ts')
const TRANSCRIBE_ROUTE = path.join(SOPS_API_DIR, 'transcribe', 'route.ts')
const RESTRUCTURE_ROUTE = path.join(SOPS_API_DIR, 'restructure', 'route.ts')
const AI_PROMPT_ROUTE = path.join(SOPS_API_DIR, 'ai-prompt', 'route.ts')

// Reused verbatim from dat01-category-column.spec.ts (CLAUDE.md [2026-07-18]:
// worktree checkouts CRLF-normalize files; specs asserting `\n`-joined source
// literals must normalize before matching).
function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

function stripComments(src: string): string {
  return src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n')
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, out)
    } else if (entry.isFile() && entry.name === 'route.ts') {
      out.push(full)
    }
  }
}

// Only search inside the POST handler body -- some files (transcribe/route.ts)
// define a helper (`updateStage`) BEFORE `POST` whose own body legitimately
// contains `.update(`; a whole-file indexOf would find that helper's literal
// text and falsely appear to precede the guard. The guard, and every
// destructive call it protects, all live inside POST.
function indexInPost(src: string, needle: string): number {
  const postIdx = src.indexOf('export async function POST')
  expect(postIdx, 'expected an exported POST handler').toBeGreaterThan(-1)
  const idx = src.indexOf(needle, postIdx)
  return idx
}

test.describe('40-12 -- session + org guard on sopId-keyed admin-client routes', () => {
  test('guard presence: parse/transcribe/restructure each check session, admin role and session-org', () => {
    for (const file of [PARSE_ROUTE, TRANSCRIBE_ROUTE, RESTRUCTURE_ROUTE]) {
      const src = stripComments(read(file))
      expect(src, `${file} missing getSessionContext()`).toContain('getSessionContext(')
      expect(src, `${file} missing 'admin' in role check`).toContain("'admin'")
      expect(src, `${file} missing 'safety_manager' in role check`).toContain("'safety_manager'")
      expect(src, `${file} missing session-org comparison`).toContain('!== organisationId')

      // CLAUDE.md [2026-07-28] CR-01: the org check must never compare two
      // values BOTH derived from the fetched row (e.g. `sopOrg.organisation_id
      // !== sop.organisation_id`) -- the right-hand side must be the plain
      // session `organisationId`, which carries no dotted property access.
      const selfComparison = /\w+\.organisation_id\s*!==\s*\w+\.\w+/
      expect(
        selfComparison.test(src),
        `${file} compares two row-derived values instead of the session organisationId`,
      ).toBe(false)
    }
  })

  test('positional: guard runs before every destructive admin-client call', () => {
    const parseSrc = read(PARSE_ROUTE)
    const parseGuardIdx = indexInPost(parseSrc, '!== organisationId')
    const parseImagesDeleteIdx = indexInPost(parseSrc, ".from('sop_images')")
    const parseSectionsDeleteIdx = indexInPost(parseSrc, ".from('sop_sections')")
    expect(parseGuardIdx, 'parse/route.ts guard not found in POST').toBeGreaterThan(-1)
    expect(
      parseGuardIdx < parseImagesDeleteIdx,
      `parse/route.ts: sop_images delete (index ${parseImagesDeleteIdx}) precedes the guard (index ${parseGuardIdx})`,
    ).toBe(true)
    expect(
      parseGuardIdx < parseSectionsDeleteIdx,
      `parse/route.ts: sop_sections delete (index ${parseSectionsDeleteIdx}) precedes the guard (index ${parseGuardIdx})`,
    ).toBe(true)

    for (const [name, file] of [
      ['transcribe/route.ts', TRANSCRIBE_ROUTE],
      ['restructure/route.ts', RESTRUCTURE_ROUTE],
    ] as const) {
      const src = read(file)
      const guardIdx = indexInPost(src, '!== organisationId')
      const firstUpdateIdx = indexInPost(src, '.update(')
      expect(guardIdx, `${name} guard not found in POST`).toBeGreaterThan(-1)
      expect(
        guardIdx < firstUpdateIdx,
        `${name}: first .update( call (index ${firstUpdateIdx}) precedes the guard (index ${guardIdx})`,
      ).toBe(true)
    }
  })

  test('ai-prompt/route.ts validates department fields through Zod, not a raw body read', () => {
    const src = stripComments(read(AI_PROMPT_ROUTE))
    expect(src).not.toContain('Array.isArray(body.departmentIds)')
    expect(src).toContain('z.array(z.string().uuid())')
    expect(src).toContain('safeParse(body)')
  })

  test('admin-client route census: every src/app/api/sops/**/route.ts using createAdminClient is classified', () => {
    // Pinned inventory + auth mechanism per route, as of this plan. A NEW
    // route.ts reaching for createAdminClient fails this test until it is
    // added here with a classification -- the tripwire this plan promises.
    const ADMIN_CLIENT_ROUTES: { file: string; auth: string }[] = [
      { file: 'ai-prompt/route.ts', auth: 'session+org' },
      { file: 'youtube/route.ts', auth: 'session+org' },
      { file: 'generate-video/route.ts', auth: 'session+org' },
      { file: 'generate-video/callback/route.ts', auth: 'machine-secret' },
      { file: 'generate-video/finalize/route.ts', auth: 'machine-secret' },
      { file: 'parse/route.ts', auth: 'session+org' },
      { file: 'transcribe/route.ts', auth: 'session+org' },
      { file: 'restructure/route.ts', auth: 'session+org' },
      { file: 'pipeline/[pipelineId]/snapshot/route.ts', auth: 'session+org' },
      { file: 'recover-renders/route.ts', auth: 'session+org' },
      { file: '[sopId]/ai-reviewer/route.ts', auth: 'session+org' },
      {
        file: '[sopId]/route.ts',
        auth: 'session-client-write, admin used only for storage cleanup of an RLS-verified row',
      },
    ]
    expect(
      ADMIN_CLIENT_ROUTES.every((r) => typeof r.auth === 'string' && r.auth.length > 0),
      'every ADMIN_CLIENT_ROUTES entry must carry a non-empty auth-mechanism string',
    ).toBe(true)

    const allRouteFiles: string[] = []
    walk(SOPS_API_DIR, allRouteFiles)
    const actual = allRouteFiles
      .filter((f) => read(f).includes('createAdminClient'))
      .map((f) => path.relative(SOPS_API_DIR, f).split(path.sep).join('/'))
      .sort()

    const expected = ADMIN_CLIENT_ROUTES.map((r) => r.file).sort()

    expect(
      actual,
      'a route.ts under src/app/api/sops/ now uses createAdminClient but is not classified in ADMIN_CLIENT_ROUTES -- ' +
        'add an entry naming its auth mechanism before this test can pass',
    ).toEqual(expected)
  })
})
