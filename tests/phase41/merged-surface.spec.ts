/**
 * Phase 41 Plan 05 — LIVE source-contract spec for the merged `/sops` surface
 * (src/app/(protected)/sops/page.tsx).
 *
 * Phase 54 rewrite: the admin scope model, deep-link resolution and Miller-
 * row JSX that used to live in AdminSopSurface.tsx are gone — replaced by
 * AdminLibraryTable.tsx (its own next/dynamic({ ssr: false }) module, gated
 * on isAdmin && viewport === 'desktop') and WorkerSimpleList.tsx (the
 * worker/below-1024 admin fallback, no Miller frame). The SUR-01/02/06 +
 * deep-link CONTRACTS this spec proves are unchanged in spirit; the
 * assertions below are repointed to their new home (CLAUDE.md 2026-07-13 —
 * repoint stale guards in the same commit as the refactor).
 *
 * Assertions run against COMMENT-STRIPPED source. Normalises \r\n to \n per
 * CLAUDE.md 2026-07-18.
 *
 * Registration: playwright.config.ts `phase41` project
 *   testDir: '.', testMatch: /tests\/phase41\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --project=phase41 -g "SUR-01"` (and -g
 * "SUR-02", -g "SUR-06", -g "deep-link") all select at least one live test.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SOPS_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx')
const ADMIN_ROWS = path.join(ROOT, 'src', 'lib', 'sop-list', 'admin-rows.ts')
const NEXT_CONFIG = path.join(ROOT, 'next.config.ts')
const MIDDLEWARE = path.join(ROOT, 'src', 'lib', 'supabase', 'middleware.ts')
// Phase 53-02: the worker per-SOP list derivation lives here now.
const WORKER_SOPS_HOOK = path.join(ROOT, 'src', 'hooks', 'useWorkerSops.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

/** Recursively lists .ts/.tsx files under a src-relative dir, path separators normalised to '/'. */
function walk(dir: string, out: string[] = []): string[] {
  const full = path.join(ROOT, dir)
  if (!fs.existsSync(full)) return out
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(rel, out)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(rel)
    }
  }
  return out
}

/** Strips // line comments and block comments so a comment quoting a token
 * cannot satisfy an assertion about the actual code. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

test.describe('SUR-01 — merged /sops surface gates the admin table on useIsAdmin() && desktop viewport', () => {
  test('SUR-01: admin table is gated on useIsAdmin() from RoleProvider', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('useIsAdmin')
    expect(src).toContain("@/components/providers/RoleProvider")
  })

  test('SUR-01: AdminLibraryTable is mounted only inside an isAdmin && viewport === "desktop" conditional', () => {
    const code = stripComments(read(SOPS_PAGE))
    // Mutation-proof: removing the gate immediately before the element fails
    // this regex even though `isAdmin` still appears elsewhere in the file.
    expect(code).toMatch(/isAdmin\s*&&\s*viewport\s*===\s*'desktop'\s*\?\s*\(\s*<AdminLibraryTable/)
  })

  test('SUR-01: AdminLibraryTable is loaded only via dynamic(), never a static value import', () => {
    const code = stripComments(read(SOPS_PAGE))
    expect(code).toContain("import('@/components/admin/AdminLibraryTable')")
    const staticValueImport = /import\s+(?!type\b)\{[^}]*AdminLibraryTable[^}]*\}\s+from\s+['"]@\/components\/admin\/AdminLibraryTable['"]/
    expect(staticValueImport.test(code)).toBe(false)
  })

  test('SUR-01: worker data layer is untouched', () => {
    const src = read(SOPS_PAGE)
    for (const token of [
      'useAssignedSops',
      'useSopSync',
      'DepartmentBottomSheet',
      'selfAddSop',
      'selfRemoveSop',
      'requestRemoveAssignment',
      'useWorkerSops(',
    ]) {
      expect(src).toContain(token)
    }
    // Phase 53-02: getUserSopAssignments and refresherDueDate moved into
    // src/hooks/useWorkerSops.ts -- asserted below, not here.
    const hookSrc = read(WORKER_SOPS_HOOK)
    expect(hookSrc).toContain('getUserSopAssignments')
    expect(hookSrc).toContain('refresherDueDate')
  })

  test('SUR-01: the worker list is derived in exactly one place', () => {
    const files = walk('src')
    const owners = files.filter((f) => stripComments(read(path.join(ROOT, f))).includes("queryKey: ['worker-last-completions']"))
    expect(owners).toEqual(['src/hooks/useWorkerSops.ts'])
    expect(read(WORKER_SOPS_HOOK)).toContain(".eq('worker_id'")
    const pageCode = stripComments(read(SOPS_PAGE))
    for (const key of ["queryKey: ['worker-last-completions']", "queryKey: ['sop-refresher-intervals']", "queryKey: ['library-sops']"]) {
      expect(pageCode).not.toContain(key)
    }
    expect(pageCode).not.toContain('getUserSopAssignments')
  })
})

test.describe('SUR-02 — the admin table is code-split, deep-linkable, and uses client-side nav state', () => {
  test('SUR-02: page.tsx has exactly 4 next/dynamic({ ssr: false }) bindings (WorkerSimpleList + AdminLibraryTable + PlantHome + PhoneHome)', () => {
    const code = stripComments(read(SOPS_PAGE))
    const dynamicCalls = code.match(/dynamic\(/g) ?? []
    expect(dynamicCalls.length).toBe(4)
    const ssrFalseCount = (code.match(/\{\s*ssr:\s*false\b[^}]*\}/g) ?? []).length
    expect(ssrFalseCount).toBe(4)
  })

  test('SUR-02: every dynamic( import target in page.tsx is in the allowed set', () => {
    const code = stripComments(read(SOPS_PAGE))
    const targets = [...code.matchAll(/import\('([^']+)'\)/g)].map((m) => m[1])
    const allowed = new Set([
      '@/components/sop/WorkerSimpleList',
      '@/components/admin/AdminLibraryTable',
      '@/components/sop/plant/PlantHome',
      '@/components/sop/plant/PhoneHome',
    ])
    for (const t of targets) {
      expect(allowed.has(t), `unexpected dynamic import target: ${t}`).toBe(true)
    }
    expect(targets.length).toBeGreaterThanOrEqual(3)
  })

  test('SUR-02: page.tsx has no @/components/sop/lenses/ import (the retired admin lenses)', () => {
    const code = stripComments(read(SOPS_PAGE))
    expect(code).not.toContain('@/components/sop/lenses/')
  })

  test('SUR-02 / deep-link: resolveLibraryNav resolves view, status, owner, departments, collection, sop', () => {
    const src = read(ADMIN_ROWS)
    expect(src).toContain('export function resolveLibraryNav')
    for (const param of ['view', 'status', 'owner', 'departments', 'collection', 'sop']) {
      expect(src).toContain(`'${param}'`)
    }
  })

  test("SUR-02 / deep-link: view=access resolution returns before departments/collection are read (SC-4)", () => {
    const code = stripComments(read(ADMIN_ROWS))
    const fnStart = code.indexOf('export function resolveLibraryNav')
    const fnBody = code.slice(fnStart, code.indexOf('export function libraryNavToUrl'))
    const accessIdx = fnBody.indexOf("=== 'access'")
    const statusIdx = fnBody.indexOf("params.get('status')")
    expect(accessIdx).toBeGreaterThan(-1)
    expect(statusIdx).toBeGreaterThan(accessIdx)
    const accessBranch = fnBody.slice(accessIdx, statusIdx)
    expect(accessBranch).not.toContain('departments')
    expect(accessBranch).not.toContain('collection')
    expect(accessBranch).toContain("view: 'access'")
  })

  test("SUR-02 / deep-link: view=attention resolves to the 'governance' sentinel", () => {
    const src = read(ADMIN_ROWS)
    expect(src).toContain("if (params.get('view') === 'attention') return 'governance'")
  })

  test('SUR-02 / hot path: page.tsx uses history.replaceState, never router.push or <Link> for scope changes', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('history.replaceState')
    expect(src).not.toContain('router.push')
    expect(src).not.toContain("next/link")
  })

  test('SUR-02: no window.location read anywhere in page.tsx (hydration-safe seed, CLAUDE.md 2026-06-08)', () => {
    expect(stripComments(read(SOPS_PAGE))).not.toContain('window.location')
  })
})

test.describe('SUR-01/02 — the admin table renders before the worker empty state', () => {
  test('an admin at desktop width never reaches the worker <SopsSection> branch', () => {
    const code = stripComments(read(SOPS_PAGE))
    const adminBranchIndex = code.indexOf("isAdmin && viewport === 'desktop' ?")
    const sectionIndex = code.indexOf('<SopsSection')
    expect(adminBranchIndex).toBeGreaterThan(-1)
    expect(sectionIndex).toBeGreaterThan(-1)
    expect(adminBranchIndex).toBeLessThan(sectionIndex)
  })
})

test.describe('SUR-06 — "Library" survives only as a scope/filter label', () => {
  test('SUR-06: the string literal \'Library\' does not appear in page.tsx at all (no admin scope column left to header)', () => {
    const src = read(SOPS_PAGE)
    const hits = src.match(/'Library'/g) ?? []
    expect(hits.length).toBe(0)
  })
})

test.describe('legacy /admin/sops deep links — next.config.ts redirect + middleware (Phase 43 D-01)', () => {
  test('the legacy URL is a static next.config.ts redirect to /sops, and the middleware forwards ?view=attention on to /governance', () => {
    const config = stripComments(read(NEXT_CONFIG))
    expect(config).toContain("source: '/admin/sops',")
    expect(config).toContain("destination: '/sops',")
    const middleware = stripComments(read(MIDDLEWARE))
    expect(middleware).toContain(
      "path === '/sops' && request.nextUrl.searchParams.get('view') === 'attention'",
    )
    expect(middleware).toContain("new URL('/governance', request.url)")
  })
})
