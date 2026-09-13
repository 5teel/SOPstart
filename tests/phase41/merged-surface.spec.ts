/**
 * Phase 41 Plan 05 — LIVE source-contract spec for the merged `/sops` surface
 * (src/app/(protected)/sops/page.tsx) plus its lazy admin module
 * (src/components/sop/AdminSopSurface.tsx).
 *
 * Bundle-regression fix (deviation from 41-05): 41-05 originally put the
 * admin scope model, deep-link resolution and Miller-row JSX directly in
 * page.tsx, which cost the always-loaded worker bundle +4/+5KB past the
 * SC-5/D-08 ±2KB gate. That code now lives in AdminSopSurface.tsx, loaded
 * from page.tsx via ONE `dynamic({ ssr: false })` call gated on
 * `useIsAdmin()`. Assertions below are repointed to their new home; the
 * SUR-01/02/06 + deep-link CONTRACTS this spec proves are unchanged, only
 * which file each lives in.
 *
 * Assertions run against COMMENT-STRIPPED source so an explanatory comment
 * that merely quotes a token (e.g. this file's own SB-LINE-06 note, which is
 * deliberately worded to avoid naming forbidden symbols — see
 * tests/lint/no-static-admin-lens-import.spec.ts) cannot satisfy a check
 * about the actual code. Normalises \r\n to \n per CLAUDE.md 2026-07-18.
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
const ADMIN_SURFACE = path.join(ROOT, 'src', 'components', 'sop', 'AdminSopSurface.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
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

const LENS_MODULES = [
  './lenses/AdminStatusLens',
  './lenses/AdminAttentionLens',
  './lenses/AdminAccessLens',
]

test.describe('SUR-01 — merged /sops surface gates admin scope on useIsAdmin()', () => {
  test('SUR-01: admin scope group is gated on useIsAdmin() from RoleProvider', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('useIsAdmin')
    expect(src).toContain("@/components/providers/RoleProvider")
  })

  test('SUR-01: the admin module is mounted only inside an isAdmin conditional', () => {
    const code = stripComments(read(SOPS_PAGE))
    // Mutation-proof: removing the `isAdmin ? (` gate immediately before the
    // element (e.g. always rendering it, or gating on something else) fails
    // this regex even though `isAdmin` still appears elsewhere in the file.
    expect(code).toMatch(/isAdmin\s*\?\s*\(\s*<AdminSopSurface/)
  })

  test('SUR-01: AdminSopSurface is loaded only via dynamic(), never a static value import', () => {
    const code = stripComments(read(SOPS_PAGE))
    expect(code).toContain("import('@/components/sop/AdminSopSurface')")
    // `import type { X } from '.../AdminSopSurface'` is fine (erased, 0
    // bytes); a static VALUE import of the component itself is the
    // regression this guards — it would pull the whole admin module (and
    // therefore the lenses it dynamic-imports) back into the always-loaded
    // worker chunk.
    const staticValueImport = /import\s+(?!type\b)\{[^}]*AdminSopSurface[^}]*\}\s+from\s+['"]@\/components\/sop\/AdminSopSurface['"]/
    expect(staticValueImport.test(code)).toBe(false)
  })

  test('SUR-01: worker data layer is untouched', () => {
    const src = read(SOPS_PAGE)
    for (const token of [
      'useAssignedSops',
      'useSopSync',
      'SopSearchInput',
      'DepartmentBottomSheet',
      'selfAddSop',
      'selfRemoveSop',
      'requestRemoveAssignment',
      'getUserSopAssignments',
      'refresherDueDate',
    ]) {
      expect(src).toContain(token)
    }
  })
})

test.describe('SUR-02 — admin lenses are code-split, deep-linkable, and use client-side scope state', () => {
  test('SUR-02: page.tsx has exactly 2 next/dynamic({ ssr: false }) bindings (worker browser + the admin module)', () => {
    const code = stripComments(read(SOPS_PAGE))
    const dynamicCalls = code.match(/dynamic\(/g) ?? []
    expect(dynamicCalls.length).toBe(2)
    const ssrFalseCount = (code.match(/\{\s*ssr:\s*false\s*\}/g) ?? []).length
    expect(ssrFalseCount).toBe(2)
  })

  test('SUR-02: AdminSopSurface.tsx has exactly 3 next/dynamic({ ssr: false }) bindings (the three lenses)', () => {
    const code = stripComments(read(ADMIN_SURFACE))
    const dynamicCalls = code.match(/dynamic\(/g) ?? []
    expect(dynamicCalls.length).toBe(3)
    const ssrFalseCount = (code.match(/\{\s*ssr:\s*false\s*\}/g) ?? []).length
    expect(ssrFalseCount).toBe(3)
  })

  test('SUR-02: page.tsx does not reference any admin lens module at all (moved to AdminSopSurface.tsx)', () => {
    const code = stripComments(read(SOPS_PAGE))
    for (const mod of ['AdminStatusLens', 'AdminAttentionLens', 'AdminAccessLens']) {
      expect(code).not.toContain(mod)
    }
  })

  test('SUR-02: each admin lens module is imported ONLY inside a dynamic( import(...) call in AdminSopSurface.tsx — no static import', () => {
    const code = stripComments(read(ADMIN_SURFACE))
    for (const mod of LENS_MODULES) {
      const staticImport = new RegExp(`import\\s+[^(][^;]*from\\s+['"]${mod.replace(/[/.]/g, '\\$&')}['"]`)
      expect(staticImport.test(code)).toBe(false)
      expect(code).toContain(`import('${mod}')`)
    }
  })

  test('SUR-02 / deep-link: AdminSopSurface resolves view, status, owner, departments, collection, sop from useSearchParams', () => {
    const src = read(ADMIN_SURFACE)
    expect(src).toContain('useSearchParams')
    for (const param of ['view', 'status', 'owner', 'departments', 'collection', 'sop']) {
      expect(src).toContain(`'${param}'`)
    }
  })

  test("SUR-02 / deep-link: view=access resolution drops departments/collection (SC-4, RESEARCH Pitfall 5)", () => {
    const code = stripComments(read(ADMIN_SURFACE))
    const accessBranch = code.slice(
      code.indexOf("view === 'access'"),
      code.indexOf("const status = params.get('status')")
    )
    expect(accessBranch).not.toContain('departments')
    expect(accessBranch).not.toContain('collection')
    expect(accessBranch).toContain("scope: 'admin-access'")
  })

  test('SUR-02 / deep-link: a non-admin session never mounts AdminSopSurface, so no admin param is ever resolved for it', () => {
    // Structural guarantee replacing the old runtime `if (!isAdmin)` branch:
    // resolveAdminScope has no isAdmin parameter at all — the module is only
    // ever fetched (see the isAdmin-gate test above) for an admin session,
    // which is a stronger guarantee than a branch inside always-shipped code.
    const code = stripComments(read(ADMIN_SURFACE))
    const fnStart = code.indexOf('function resolveAdminScope(')
    expect(fnStart).toBeGreaterThan(-1)
    const fnSignatureLine = code.slice(fnStart, code.indexOf('{', fnStart))
    expect(fnSignatureLine).not.toContain('isAdmin')
  })

  test('SUR-02 / hot path: scope changes use history.replaceState, never router.push or <Link>', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('history.replaceState')
    expect(src).not.toContain('router.push')
    expect(src).not.toContain("next/link")
    const adminSrc = read(ADMIN_SURFACE)
    expect(adminSrc).toContain('history.replaceState')
    expect(adminSrc).not.toContain('router.push')
    expect(adminSrc).not.toContain('next/link')
  })

  test('SUR-02: no window.location read anywhere in either file (hydration-safe seed, CLAUDE.md 2026-06-08)', () => {
    expect(stripComments(read(SOPS_PAGE))).not.toContain('window.location')
    expect(stripComments(read(ADMIN_SURFACE))).not.toContain('window.location')
  })
})

test.describe('SUR-01/02 — the admin-status branch renders before the worker empty state', () => {
  test('an admin with zero assigned SOPs sees the library, not "No SOPs yet" (positional guard)', () => {
    const code = stripComments(read(SOPS_PAGE))
    const adminBranchIndex = code.indexOf('admin.inFrameElement ?')
    const emptyStateIndex = code.indexOf('No SOPs yet')
    expect(adminBranchIndex).toBeGreaterThan(-1)
    expect(emptyStateIndex).toBeGreaterThan(-1)
    expect(adminBranchIndex).toBeLessThan(emptyStateIndex)
  })
})

test.describe('SUR-06 — "Library" survives only as a scope/filter label', () => {
  test('SUR-06: the string literal \'Library\' appears exactly once in page.tsx — the worker scope-group header, never a nav label or destination', () => {
    const src = read(SOPS_PAGE)
    const hits = src.match(/'Library'/g) ?? []
    expect(hits.length).toBe(1)
    expect(src).toContain("group === 'yours' ? 'Your SOPs' : 'Library'")
  })

  test('SUR-06: the admin scope-column header reads "Admin", not "Library" (now rendered by AdminSopSurface.tsx)', () => {
    const src = read(ADMIN_SURFACE)
    expect(src).toContain('MillerColumnHeader>Admin<')
    expect(src).not.toContain("'Library'")
  })
})

test.describe('redirect shim — legacy /admin/sops deep links all resolve on /sops', () => {
  test('view=attention, view=access, status=draft|published|failed, owner=me, and bare departments/collection all map to an admin scope', () => {
    const code = stripComments(read(ADMIN_SURFACE))
    expect(code).toContain("view === 'attention'")
    expect(code).toContain("scope: 'admin-attention'")
    expect(code).toContain("view === 'access'")
    expect(code).toContain("scope: 'admin-access'")
    expect(code).toContain("status === 'draft' || status === 'published' || status === 'failed'")
    expect(code).toContain("params.get('owner') === 'me'")
    expect(code).toContain("scope: 'admin-all', ownerOnly: true")
  })
})
