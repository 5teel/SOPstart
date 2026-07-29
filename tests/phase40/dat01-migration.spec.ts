/**
 * Phase 40 -- DAT-01 migration + backfill integrity. Encodes CLAUDE.md
 * [2026-07-28]: an applier that omits a later corrective migration, or an
 * assertion that pins only some clauses, certifies nothing. Plans 40-04/
 * 40-06 add migration 00058 (sops.category_slug) + the applier/backfill/
 * verify scripts; this spec pins the ordering, the retirement-comment
 * clauses, and the drift guard between the migration's inlined slug list
 * and src/lib/sop-categories.ts.
 *
 * The runtime proof (live production counts) is scripts/verify-category-backfill.mjs,
 * run by a human in the plan's Task 2 checkpoint -- SC-5 explicitly requires
 * a production query and CI has no production credentials. These are
 * source-contract assertions cross-checked against the migration SQL itself.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')

const APPLIER = path.join(ROOT, 'scripts', 'apply-phase40-migration.mjs')
const BACKFILL = path.join(ROOT, 'scripts', 'backfill-sop-category.mjs')
const MIGRATION_00058 = path.join(MIGRATIONS_DIR, '00058_sop_category_slug.sql')
const MIGRATION_00059 = path.join(MIGRATIONS_DIR, '00059_sop_videos_storage_scope.sql')
const SOP_CATEGORIES = path.join(ROOT, 'src', 'lib', 'sop-categories.ts')
const VERIFY_SCRIPT = path.join(ROOT, 'scripts', 'verify-category-backfill.mjs')

// Every phase-40 migration on disk. A filter narrower than this set (e.g.
// the original `f.startsWith('00058')`) silently exempts a later corrective
// migration from the ordering guard below — the exact regression class
// this file's own header cites (CLAUDE.md 2026-07-28: apply-phase37's
// fallback applied only its OWN migration and re-dropped a later one while
// its assertions stayed green). Extend this array, never narrow the filter.
const PHASE40_MIGRATION_PREFIXES = ['00058', '00059']

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
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(full)
    }
  }
}

test.describe('DAT-01 -- migration applier integrity (CLAUDE.md 2026-07-28)', () => {
  test('applier declares an ordered MIGRATIONS array matching every phase-40 migration on disk, in ascending filename order', () => {
    const applierSrc = read(APPLIER)
    // The applier must declare its MIGRATIONS array literally, e.g.:
    //   const MIGRATIONS = ['00058_sop_category_slug.sql']
    const match = applierSrc.match(/const MIGRATIONS\s*=\s*\[([\s\S]*?)\]/)
    expect(match).not.toBeNull()
    const declaredFiles = [...(match?.[1].matchAll(/['"]([^'"]*\.sql)['"]/g) ?? [])].map((m) => path.basename(m[1]))

    const onDiskPhase40Migrations = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => PHASE40_MIGRATION_PREFIXES.some((prefix) => f.startsWith(prefix)))
      .sort()

    // Index-by-index, not set equality -- apply order is load-bearing
    // (CLAUDE.md 2026-07-28): a set-equal/sorted comparison would mask a
    // corrective migration being applied out of order.
    expect(declaredFiles).toEqual(onDiskPhase40Migrations)
  })

  test("the applier's fallback path applies EVERY entry in MIGRATIONS, not just the first (2026-07-28 regression class)", () => {
    const applierSrc = stripComments(read(APPLIER))
    // The fallback must iterate MIGRATION_FILES/MIGRATIONS (a for-of / .map
    // over the full array), never hard-code a single file path in the
    // Management API fallback branch.
    expect(applierSrc).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+MIGRATION_FILES\s*\)/)
  })

  test('00058_sop_category_slug.sql adds category_slug, indexes it, comments both retired columns, and adds no table/drop/security-definer', () => {
    const rawSrc = read(MIGRATION_00058)
    // Strip SQL line comments before checking for forbidden clauses -- the
    // migration's own header PROSE explains what it deliberately does NOT
    // add (e.g. "No ... SECURITY DEFINER function is added"), which must not
    // be misread as the clause being present.
    const sqlOnly = rawSrc
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    const src = sqlOnly.toLowerCase()
    expect(src).toContain('add column if not exists category_slug')
    expect(src).toMatch(/create index[^;]*category_slug/)
    expect(src).toContain('comment on column public.sops.category is')
    expect(src).toContain('comment on column public.sops.category_tag is')
    // Two "where" clauses guarding the backfill on category_slug is null --
    // one per pass-1 update (category_tag match, category match) -- so a
    // re-run never overwrites an already-resolved row.
    const whereCategorySlugNullCount = (src.match(/where[\s\S]{0,200}?category_slug is null/g) ?? []).length
    expect(whereCategorySlugNullCount).toBeGreaterThanOrEqual(2)
    // Migration clause pinning: this migration must stay purely additive.
    expect(src).not.toContain('drop column')
    expect(src).not.toContain('create table')
    expect(src).not.toContain('security definer')
  })

  test('00059_sop_videos_storage_scope.sql drops the old permissive policy and scopes INSERT/UPDATE to org + admin role, adding no table/drop-column/security-definer', () => {
    const rawSrc = read(MIGRATION_00059)
    const sqlOnly = rawSrc
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    const src = sqlOnly.toLowerCase()
    expect(src).toContain('drop policy if exists "authenticated users can upload to sop-videos"')
    expect(src).toContain('storage.foldername')
    expect(src).toContain('current_organisation_id')
    expect(src).toContain('current_user_role')
    expect(src).toMatch(/for insert/)
    expect(src).toMatch(/for update/)
    expect(src).not.toContain('drop column')
    expect(src).not.toContain('create table')
    expect(src).not.toContain('security definer')
  })

  test("the migration's inlined backfill slug list exactly equals SOP_CATEGORIES exported from sop-categories.ts", () => {
    const migrationSrc = read(MIGRATION_00058)
    const categoriesSrc = read(SOP_CATEGORIES)

    // Both sources declare their slug set as single-quoted string literals
    // inside a `values (...)` / array-of-objects block; parse each
    // independently and compare as sorted arrays -- this is the drift guard
    // that replaces a hand-maintained lookup table.
    const vocabMatch = migrationSrc.match(/values\s*\(([\s\S]*?)\)\n(?:update|\))/)
    expect(vocabMatch).not.toBeNull()
    // The migration inlines the SAME 15-entry vocab twice (once per backfill
    // pass -- category_tag match, category match); dedupe before comparing.
    const migrationSlugs = [
      ...new Set(
        [...migrationSrc.matchAll(/\(\s*'([a-z0-9_-]+)'\s*,\s*'[^']*'\s*\)/g)].map((m) => m[1])
      ),
    ].sort()

    const categoriesMatch = categoriesSrc.match(/SOP_CATEGORIES\s*=\s*\[([\s\S]*?)\]\s*as const/)
    expect(categoriesMatch).not.toBeNull()
    const categorySlugs = [...(categoriesMatch?.[1].matchAll(/slug:\s*['"]([a-z0-9_-]+)['"]/g) ?? [])]
      .map((m) => m[1])
      .sort()

    expect(migrationSlugs.length).toBeGreaterThan(0)
    expect(categorySlugs.length).toBeGreaterThan(0)
    expect(migrationSlugs).toEqual(categorySlugs)
  })

  test('scripts/backfill-sop-category.mjs is dry-run-default, null-clobber-safe, and guards step 4', () => {
    const src = stripComments(read(BACKFILL))
    // Dry-run default + explicit --apply guard.
    expect(src).toContain("process.argv.includes('--apply')")
    // No unconditional `category_slug: null` write anywhere.
    expect(src).not.toMatch(/category_slug:\s*null(?!\s*[,)]?\s*:)/)
    // Conditional-spread write payload (the 2026-07-05 null-clobber rule).
    expect(src).toMatch(/\.\.\.\(w\.slug \? \{ category_slug: w\.slug \} : \{\}\)/)
    // Step-4 guards: refuses when the audit file is absent, and refuses on
    // a partial pass-2 status.
    expect(src).toMatch(/!fs\.existsSync\(AUDIT_PATH\)/)
    expect(src).toMatch(/runStatus === 'partial'/)
    // Every settings-table write carries an organisation_id filter in
    // addition to the category key.
    expect(src).toMatch(/\.eq\(['"]organisation_id['"],\s*row\.organisation_id\)/)
    // Model id is a named constant with an env override, not a bare literal.
    expect(src).toContain("process.env.CATEGORY_MAP_MODEL ||")
  })

  test('scripts/verify-category-backfill.mjs pins BOTH retired columns (category AND category_tag), not just one', () => {
    const src = read(VERIFY_SCRIPT)
    expect(src).toContain('category is not null')
    expect(src).toContain('category_tag is not null')
    // Exit code 1 if either of the first two counts is non-zero.
    expect(src).toMatch(/categoryNotNull > 0 \|\| categoryTagNotNull > 0/)
    expect(src).toMatch(/process\.exit\(1\)/)
  })

  test('no code path under src/ writes category: or category_tag: into an insert/update/upsert targeting sops', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    const violations: string[] = []
    for (const file of files) {
      const src = stripComments(read(file))
      const chainRe = /\.from\(['"]sops['"]\)[\s\S]{0,400}?\.(insert|update|upsert)\(([\s\S]{0,600}?)\)/g
      let m: RegExpExecArray | null
      while ((m = chainRe.exec(src))) {
        const payload = m[2]
        if (/\bcategory:/.test(payload) || /\bcategory_tag:/.test(payload)) {
          violations.push(file)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
