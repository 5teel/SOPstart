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

// ------------------------------------------------------------------------
// Plan 40-11 -- table-write census (CLAUDE.md [2026-07-29]: a sweep keyed on
// a planner-enumerated feature list misses the sibling function nobody
// listed -- cloneSopAsDraft/restoreVersionAsNew were exactly that miss).
//
// This census is keyed on the DATA: every `.from('sops')....insert(|.update(
// |.upsert(` under src/. A write whose payload contains `category_slug`
// passes automatically. Any other write must have a matching entry below
// naming why it's exempt -- a new, unclassified write site fails the suite
// instead of silently shipping a categoryless SOP.
// ------------------------------------------------------------------------

interface CategoryExemptEntry {
  /** Path relative to repo root, forward slashes. */
  file: string
  /** Sorted, comma-joined top-level payload keys -- the write's fingerprint. */
  keys: string
  reason: string
}

// Each entry is keyed on (file, keys) -- multiple physical call sites with the
// identical fingerprint in the same file share one entry (e.g. the four
// `source_file_path`-only finalize writes across the upload-session creators).
const CATEGORY_EXEMPT: CategoryExemptEntry[] = [
  { file: 'src/actions/approvals.ts', keys: 'approval_state', reason: 'Approval-chain state stamp; not a category-bearing write.' },
  { file: 'src/actions/departments.ts', keys: 'organisation_id', reason: 'Repairs a SOP row’s organisation_id; not a category-bearing write.' },
  { file: 'src/actions/departments.ts', keys: 'all_departments', reason: 'Toggles the all-departments grant flag; not a category-bearing write.' },
  { file: 'src/actions/flow-graph.ts', keys: 'flow_graph', reason: 'Persists the builder flow-graph JSON only; not a category-bearing write.' },
  { file: 'src/actions/governance.ts', keys: 'owner_user_id,updated_at', reason: 'SOP-owner reassignment; not a category-bearing write.' },
  { file: 'src/actions/governance.ts', keys: 'refresher_interval_months,updated_at', reason: 'Per-SOP refresher-interval override; category is set via a separate action, not this one.' },
  { file: 'src/actions/governance.ts', keys: 'last_reviewed_at,last_reviewed_by,review_due_at,updated_at', reason: 'Manual "confirm current" review-clock stamp; category_slug is read (not written) to resolve the cadence.' },
  { file: 'src/actions/grants.ts', keys: 'all_departments,all_departments_pre_override', reason: 'Grant-system all-departments override bookkeeping; not a category-bearing write.' },
  { file: 'src/actions/sop-section-blocks.ts', keys: 'status', reason: 'Resets SOP status to draft after a block edit invalidates verification; not a category-bearing write.' },
  { file: 'src/actions/sops.ts', keys: 'organisation_id,source_file_name,source_file_path,source_file_type,status', reason: 'createUploadSession -- pre-parse shell insert; /api/sops/parse’s post-parse UPDATE sets category_slug once the document is classified.' },
  { file: 'src/actions/sops.ts', keys: 'source_file_path', reason: 'Finalises the uploaded file path after a presigned PUT/TUS upload; not a category-bearing write (4 call sites across the upload-session creators).' },
  { file: 'src/actions/sops.ts', keys: 'status', reason: 'Status-only transition; not a category-bearing write.' },
  { file: 'src/actions/sops.ts', keys: 'is_ocr,organisation_id,source_file_name,source_file_path,source_file_type,status,title,uploaded_by,version', reason: 'createVideoUploadSession -- pre-parse shell insert; the transcribe route’s post-parse UPDATE sets category_slug once the transcript is classified.' },
  { file: 'src/actions/sops.ts', keys: 'overall_confidence,parse_notes,status,title,updated_at', reason: 'reparseSop/restructureSop reset status to re-trigger parsing; category_slug is left untouched so the existing value survives unchanged.' },
  { file: 'src/actions/sops.ts', keys: 'title,updated_at', reason: 'Title-only rename; not a category-bearing write.' },
  { file: 'src/actions/sops.ts', keys: 'organisation_id,pipeline_run_id,source_file_name,source_file_path,source_file_type,status,uploaded_by', reason: 'createVideoSopPipelineSession -- pre-parse shell insert; the pipeline’s post-parse UPDATE sets category_slug once classified.' },
  { file: 'src/actions/versioning.ts', keys: 'source_file_path', reason: 'Finalises the new-version/clone file path after upload; category was already carried into the insert above (2 call sites: uploadNewVersion, cloneSopAsDraft).' },
  { file: 'src/actions/versioning.ts', keys: 'superseded_by', reason: 'Marks the OLD SOP as superseded when a new version/clone publishes; the new row already carries its own category via its own insert (2 call sites).' },
  { file: 'src/actions/versioning.ts', keys: 'status', reason: 'Flips the sentinel status uploading -> draft once cloneSopAsDraft’s copy completes; category was already carried into the insert.' },
  { file: 'src/app/api/sops/parse/route.ts', keys: 'parse_notes,status', reason: 'Parse-failure early exit; category is only set on the success-path post-parse UPDATE.' },
  { file: 'src/app/api/sops/restructure/route.ts', keys: 'status', reason: 'Status-only transition; not a category-bearing write.' },
  { file: 'src/app/api/sops/restructure/route.ts', keys: 'parse_notes,status', reason: 'Restructure-failure early exit; category is only set on the success-path post-parse UPDATE.' },
  { file: 'src/app/api/sops/transcribe/route.ts', keys: 'status', reason: 'Status-only transition (recording/transcribing progress, 2 call sites); not a category-bearing write.' },
  { file: 'src/app/api/sops/transcribe/route.ts', keys: 'parse_notes,status', reason: 'Transcription-failure early exit; category is only set on the success-path post-parse UPDATE.' },
  { file: 'src/app/api/sops/youtube/route.ts', keys: 'is_ocr,organisation_id,source_file_name,source_file_path,source_file_type,status,title,uploaded_by,version', reason: 'Pre-parse shell insert for a YouTube-sourced SOP; this file’s own post-parse UPDATE sets category_slug once the transcript is classified.' },
  { file: 'src/app/api/sops/[sopId]/publish/route.ts', keys: 'approval_snapshot,approval_state', reason: 'Approval-chain state stamp on publish; not a category-bearing write.' },
  { file: 'src/lib/governance/publish-core.ts', keys: '', reason: 'performPublish’s status/published_at/updated_at(+approval_state) transition, built as a typed variable payload rather than an inline object literal; not a category-bearing write.' },
  { file: 'src/lib/governance/publish-core.ts', keys: 'last_reviewed_at,review_due_at', reason: 'Review-clock reset on publish; category_slug is read (not written) to resolve the cadence.' },
]

// A changed count means a new sops write path was added or removed and MUST
// be classified against CATEGORY_EXEMPT above (or shown to already carry
// category_slug) -- update this constant deliberately, never to silence a
// failing run.
// 2026-08-04: 45 -> 46. The new site is setSopCategory in src/actions/sops.ts,
// which backs the inline category editor in the Miller detail pane (sketch 005
// variant C). It WRITES category_slug — that is its entire purpose — so it
// needs no exemption; the count moved only because a sops write path was
// genuinely added, which is exactly what this tripwire exists to surface.
const EXPECTED_SOPS_WRITE_SITE_COUNT = 46

// Extracts the substring between a `(` at `openIdx` and its matching `)`,
// tracking paren depth so nested calls/objects don't truncate the payload.
function extractBalancedParens(src: string, openIdx: number): string {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') {
      depth--
      if (depth === 0) return src.slice(openIdx + 1, i)
    }
  }
  return src.slice(openIdx + 1)
}

function findSopsWrites(src: string): Array<{ op: string; keys: string }> {
  const re = /\.from\(['"]sops['"]\)\s*\.(insert|update|upsert)\(/g
  const out: Array<{ op: string; keys: string }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const openIdx = m.index + m[0].length - 1
    const payload = extractBalancedParens(src, openIdx)
    const keys = [...new Set([...payload.matchAll(/(?:[{,]|^)\s*\n?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:(?!:)/g)].map((k) => k[1]))]
      .sort()
      .join(',')
    out.push({ op: m[1], keys })
  }
  return out
}

test.describe('DAT-01 -- sops-table write census (Plan 40-11)', () => {
  test('every sops-table write under src/ either carries category_slug or is a justified CATEGORY_EXEMPT entry', () => {
    const files: string[] = []
    walk(SRC_DIR, files)
    let totalWrites = 0
    const violations: string[] = []
    for (const file of files) {
      const src = stripComments(read(file))
      const rel = path.relative(ROOT, file).split(path.sep).join('/')
      for (const w of findSopsWrites(src)) {
        totalWrites++
        if (w.keys.split(',').includes('category_slug')) continue
        const exempt = CATEGORY_EXEMPT.some((e) => e.file === rel && e.keys === w.keys)
        if (!exempt) {
          violations.push(`${rel} [.${w.op}(...)] keys=(${w.keys || '<none -- variable payload, inspect manually'}) -- add category_slug to the payload or add a justified CATEGORY_EXEMPT entry`)
        }
      }
    }
    expect(violations).toEqual([])
    expect(totalWrites).toBe(EXPECTED_SOPS_WRITE_SITE_COUNT)
  })

  test('every CATEGORY_EXEMPT entry carries a non-empty reason', () => {
    for (const entry of CATEGORY_EXEMPT) {
      expect(entry.reason.length).toBeGreaterThan(0)
    }
  })
})
