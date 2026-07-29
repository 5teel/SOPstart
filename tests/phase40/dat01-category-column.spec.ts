/**
 * Phase 40 -- DAT-01 (D-01): one category column. Today `sops.category` is
 * a free-text column with a legacy `category_tag` also lingering on some
 * read paths. Plans 40-04/40-05 add `sops.category_slug` (backfilled,
 * canonical) and repoint every SOP-creating route + read surface onto it.
 * `blocks.category_tags` (plural, array column) is a DIFFERENT column and
 * must be excluded from the category_tag sweep below.
 *
 * `test.fixme` until 40-04/40-05.
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

const SOP_CATEGORIES = path.join(SRC_DIR, 'lib', 'sop-categories.ts')
const SOP_COLLECTIONS = path.join(SRC_DIR, 'lib', 'org-model', 'sop-collections.ts')
const GOVERNANCE_ACTIONS = path.join(SRC_DIR, 'actions', 'governance.ts')
const SOPS_ACTIONS = path.join(SRC_DIR, 'actions', 'sops.ts')
const PUBLISH_ROUTE = path.join(SRC_DIR, 'app', 'api', 'sops', '[sopId]', 'publish', 'route.ts')

const SOP_CREATING_ROUTES = [
  path.join(SRC_DIR, 'app', 'api', 'sops', 'parse', 'route.ts'),
  path.join(SRC_DIR, 'app', 'api', 'sops', 'restructure', 'route.ts'),
  path.join(SRC_DIR, 'app', 'api', 'sops', 'transcribe', 'route.ts'),
  path.join(SRC_DIR, 'app', 'api', 'sops', 'youtube', 'route.ts'),
  path.join(SRC_DIR, 'app', 'api', 'sops', 'ai-prompt', 'route.ts'),
]

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

// A `category_tag` hit that is actually the DIFFERENT `category_tags` (plural,
// blocks array column) is not a violation -- scope the sweep to exclude it.
function hasCategoryTagColumnRef(src: string): boolean {
  const re = /category_tag(?!s)/g
  return re.test(src)
}

// A bare `category` reference on a `.from('sops')...select(...)` chain is a
// DAT-01 violation; the SAME word on `sop_review_cadences`/`approval_chains`
// selects is intentional (those tables keep their `category` column name and
// type by design -- only the VALUES stored in it migrate, per plan 40-06's
// backfill). Scope the check to selects chained off `.from('sops')` only.
function hasBareCategoryOnSopsSelect(src: string): boolean {
  const re = /\.from\(['"]sops['"]\)[\s\S]{0,300}?\.select\(['"]([^'"]*)['"]\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (/\bcategory\b(?!_slug)/.test(m[1])) return true
  }
  return false
}

test.describe('DAT-01 -- one category column (sops.category_slug)', () => {
  // Still test.fixme: `BuilderClient.tsx`'s `initialSop.category_tag` feeds
  // `sopCategory` into `match-blocks.ts`/`BlockPicker.tsx` -- the BLOCK
  // LIBRARY's Phase 13 category-tag taxonomy (`area-forming`,
  // `area-machine-repair`, ...), a DIFFERENT vocabulary from the new
  // SOP_CATEGORIES slugs this plan introduces. Renaming that read to
  // `category_slug` would silently break block soft-filtering (wrong
  // vocabulary), not fix a bug -- out of scope for every 40-0x plan's
  // files_modified list (confirmed: not owned by 40-06/07/08/09 either).
  // Left as a documented gap; see 40-05-SUMMARY.md Known Stubs.
  test.fixme('zero occurrences of category_tag as a sops column read/write anywhere under src/ (excludes blocks.category_tags)', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    const hits = files.filter((f) => hasCategoryTagColumnRef(stripComments(read(f))))
    expect(hits).toEqual([])
  })

  test('zero write-side occurrences of "category:" in the five SOP-creating routes and sops.ts', () => {
    for (const file of [...SOP_CREATING_ROUTES, SOPS_ACTIONS]) {
      const src = stripComments(read(file))
      expect(src).not.toContain('category:')
    }
  })

  test('sop-categories.ts exports SOP_CATEGORIES, categoryLabel, isValidCategorySlug', () => {
    const src = read(SOP_CATEGORIES)
    expect(src).toContain('export const SOP_CATEGORIES')
    expect(src).toContain('export function categoryLabel')
    expect(src).toContain('export function isValidCategorySlug')
  })

  test('sop-collections.ts and governance.ts select category_slug, not category', () => {
    for (const file of [SOP_COLLECTIONS, GOVERNANCE_ACTIONS]) {
      const src = stripComments(read(file))
      expect(src).toContain('category_slug')
      expect(hasBareCategoryOnSopsSelect(src)).toBe(false)
    }
  })

  // CLAUDE.md [2026-07-28]: an assertion must pin every security-relevant
  // clause of the object it verifies -- the repoint from `category` to
  // `category_slug` must not have dropped the org-scope filter on either of
  // the two hidden category-keyed settings tables (T-40-05-02).
  test('the two category-keyed settings tables still carry an organisation_id filter after the repoint', () => {
    const governanceSrc = stripComments(read(GOVERNANCE_ACTIONS))
    expect(governanceSrc).toContain("from('sop_review_cadences')")
    expect(governanceSrc).toMatch(/sop_review_cadences[\s\S]{0,400}?\.eq\(['"]organisation_id['"]/)

    const publishRouteSrc = stripComments(read(PUBLISH_ROUTE))
    expect(publishRouteSrc).toContain("from('approval_chains')")
    expect(publishRouteSrc).toMatch(/approval_chains[\s\S]{0,400}?\.eq\(['"]organisation_id['"]/)
  })
})
