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

test.describe('DAT-01 -- one category column (sops.category_slug)', () => {
  test.fixme('zero occurrences of category_tag as a sops column read/write anywhere under src/ (excludes blocks.category_tags)', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    const hits = files.filter((f) => hasCategoryTagColumnRef(stripComments(read(f))))
    expect(hits).toEqual([])
  })

  test.fixme('zero write-side occurrences of "category:" in the five SOP-creating routes and sops.ts', () => {
    for (const file of [...SOP_CREATING_ROUTES, SOPS_ACTIONS]) {
      const src = stripComments(read(file))
      expect(src).not.toContain('category:')
    }
  })

  test.fixme('sop-categories.ts exports SOP_CATEGORIES, categoryLabel, isValidCategorySlug', () => {
    const src = read(SOP_CATEGORIES)
    expect(src).toContain('export const SOP_CATEGORIES')
    expect(src).toContain('export function categoryLabel')
    expect(src).toContain('export function isValidCategorySlug')
  })

  test.fixme('sop-collections.ts and governance.ts select category_slug, not category', () => {
    for (const file of [SOP_COLLECTIONS, GOVERNANCE_ACTIONS]) {
      const src = stripComments(read(file))
      expect(src).toContain('category_slug')
      expect(src).not.toMatch(/\.select\(['"][^'"]*\bcategory\b(?!_slug)/)
    }
  })
})
