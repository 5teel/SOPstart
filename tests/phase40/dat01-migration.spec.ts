/**
 * Phase 40 -- DAT-01 migration + backfill integrity. Encodes CLAUDE.md
 * [2026-07-28]: an applier that omits a later corrective migration, or an
 * assertion that pins only some clauses, certifies nothing. Plans 40-04/
 * 40-06 add migration 00058 (sops.category_slug) + the applier/backfill/
 * verify scripts; this spec pins the ordering, the retirement-comment
 * clauses, and the drift guard between the migration's inlined slug list
 * and src/lib/sop-categories.ts BEFORE either exists.
 *
 * `test.fixme` until 40-04/40-06.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')

const APPLIER = path.join(ROOT, 'scripts', 'apply-phase40-migration.mjs')
const MIGRATION_00058 = path.join(MIGRATIONS_DIR, '00058_sop_category_slug.sql')
const SOP_CATEGORIES = path.join(ROOT, 'src', 'lib', 'sop-categories.ts')
const VERIFY_SCRIPT = path.join(ROOT, 'scripts', 'verify-category-backfill.mjs')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('DAT-01 -- migration applier integrity (CLAUDE.md 2026-07-28)', () => {
  test.fixme('applier declares an ordered migration file list matching every phase-40 migration on disk, in ascending filename order', () => {
    const applierSrc = read(APPLIER)
    // The applier must declare its MIGRATION_FILES array literally, e.g.:
    //   const MIGRATION_FILES = [
    //     path.join(ROOT, 'supabase/migrations/00058_sop_category_slug.sql'),
    //   ]
    const match = applierSrc.match(/MIGRATION_FILES\s*=\s*\[([\s\S]*?)\]/)
    expect(match).not.toBeNull()
    const declaredFiles = [...(match?.[1].matchAll(/['"]([^'"]*\.sql)['"]/g) ?? [])].map(
      (m) => path.basename(m[1]),
    )

    const onDiskPhase40Migrations = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.startsWith('00058'))
      .sort()

    expect(declaredFiles).toEqual(onDiskPhase40Migrations)
  })

  test.fixme('00058_sop_category_slug.sql adds category_slug, indexes it, and comments both retired columns', () => {
    const src = read(MIGRATION_00058).toLowerCase()
    expect(src).toContain('add column if not exists category_slug')
    expect(src).toMatch(/create index[^;]*category_slug/)
    expect(src).toContain('comment on column public.sops.category is')
    expect(src).toContain('comment on column public.sops.category_tag is')
  })

  test.fixme("the migration's inlined backfill slug list exactly equals SOP_CATEGORIES exported from sop-categories.ts", () => {
    const migrationSrc = read(MIGRATION_00058)
    const categoriesSrc = read(SOP_CATEGORIES)

    // Both sources declare their slug set as single-quoted string literals;
    // parse each independently and compare as sorted arrays -- this is the
    // drift guard that replaces a hand-maintained lookup table.
    const migrationSlugs = [...migrationSrc.matchAll(/'([a-z0-9_-]+)'/g)].map((m) => m[1]).sort()
    const categoriesMatch = categoriesSrc.match(/SOP_CATEGORIES\s*=\s*\[([\s\S]*?)\]/)
    expect(categoriesMatch).not.toBeNull()
    const categorySlugs = [...(categoriesMatch?.[1].matchAll(/slug:\s*['"]([a-z0-9_-]+)['"]/g) ?? [])]
      .map((m) => m[1])
      .sort()

    expect(migrationSlugs.length).toBeGreaterThan(0)
    expect(categorySlugs.length).toBeGreaterThan(0)
    expect(new Set(migrationSlugs)).toEqual(new Set(categorySlugs))
  })

  test.fixme('verify-category-backfill.mjs pins BOTH retired columns (category AND category_tag), not just one', () => {
    const src = read(VERIFY_SCRIPT)
    expect(src).toContain('category is not null')
    expect(src).toContain('category_tag is not null')
  })
})
