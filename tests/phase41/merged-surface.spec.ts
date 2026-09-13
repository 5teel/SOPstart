/**
 * Phase 41 Plan 05 — LIVE source-contract spec for the merged `/sops` surface
 * (src/app/(protected)/sops/page.tsx). Flipped from the 41-01 Wave-0 stubs
 * (test.fixme removed) now that the scope model, deep-link resolution,
 * replaceState URL plumbing (Task 1) and the admin Miller scope group /
 * status-lens render region (Task 2) are live.
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
  '@/components/sop/lenses/AdminStatusLens',
  '@/components/sop/lenses/AdminAttentionLens',
  '@/components/sop/lenses/AdminAccessLens',
]

test.describe('SUR-01 — merged /sops surface gates admin scope on useIsAdmin()', () => {
  test('SUR-01: admin scope group is gated on useIsAdmin() from RoleProvider', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('useIsAdmin')
    expect(src).toContain("@/components/providers/RoleProvider")
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
  test('SUR-02: exactly 4 next/dynamic({ ssr: false }) bindings (worker browser + 3 admin lenses)', () => {
    const code = stripComments(read(SOPS_PAGE))
    const dynamicCalls = code.match(/dynamic\(/g) ?? []
    expect(dynamicCalls.length).toBe(4)
    const ssrFalseCount = (code.match(/\{\s*ssr:\s*false\s*\}/g) ?? []).length
    expect(ssrFalseCount).toBe(4)
  })

  test('SUR-02: each admin lens module is imported ONLY inside a dynamic( import(...) call — no static import', () => {
    const code = stripComments(read(SOPS_PAGE))
    for (const mod of LENS_MODULES) {
      // A static import would read `import ... from '<mod>'`. The only
      // permitted appearance of the module specifier is inside `import('<mod>')`
      // as the argument to next/dynamic's loader.
      const staticImport = new RegExp(`import\\s+[^(][^;]*from\\s+['"]${mod.replace(/[/]/g, '\\/')}['"]`)
      expect(staticImport.test(code)).toBe(false)
      expect(code).toContain(`import('${mod}')`)
    }
  })

  test('SUR-02 / deep-link: page resolves view, status, owner, departments, collection, sop from useSearchParams', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('useSearchParams')
    for (const param of ['view', 'status', 'owner', 'departments', 'collection', 'sop']) {
      expect(src).toContain(`'${param}'`)
    }
  })

  test("SUR-02 / deep-link: view=access resolution drops departments/collection (SC-4, RESEARCH Pitfall 5)", () => {
    const code = stripComments(read(SOPS_PAGE))
    const accessBranch = code.slice(
      code.indexOf("view === 'access'"),
      code.indexOf("const status = params.get('status')")
    )
    expect(accessBranch).not.toContain('departments')
    expect(accessBranch).not.toContain('collection')
    expect(accessBranch).toContain("scope: 'admin-access'")
  })

  test('SUR-02 / deep-link: a non-admin resolution drops every admin param in the very first branch', () => {
    const code = stripComments(read(SOPS_PAGE))
    const fnStart = code.indexOf('function resolveInitialScope(')
    const fnBody = code.slice(fnStart, fnStart + 400)
    expect(fnBody).toContain('if (!isAdmin)')
    expect(fnBody).toContain("return { scope: 'all', ownerOnly: false }")
  })

  test('SUR-02 / hot path: scope changes use history.replaceState, never router.push or <Link>', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('history.replaceState')
    expect(src).not.toContain('router.push')
    expect(src).not.toContain("next/link")
  })

  test('SUR-02: no window.location read anywhere in the file (hydration-safe seed, CLAUDE.md 2026-06-08)', () => {
    const code = stripComments(read(SOPS_PAGE))
    expect(code).not.toContain('window.location')
  })
})

test.describe('SUR-01/02 — the admin-status branch renders before the worker empty state', () => {
  test('an admin with zero assigned SOPs sees the library, not "No SOPs yet" (positional guard)', () => {
    const code = stripComments(read(SOPS_PAGE))
    const adminBranchIndex = code.indexOf('isAdminStatusScope(scope) ?')
    const emptyStateIndex = code.indexOf('No SOPs yet')
    expect(adminBranchIndex).toBeGreaterThan(-1)
    expect(emptyStateIndex).toBeGreaterThan(-1)
    expect(adminBranchIndex).toBeLessThan(emptyStateIndex)
  })
})

test.describe('SUR-06 — "Library" survives only as a scope/filter label', () => {
  test('SUR-06: the string literal \'Library\' appears exactly once — the worker scope-group header, never a nav label or destination', () => {
    const src = read(SOPS_PAGE)
    const hits = src.match(/'Library'/g) ?? []
    expect(hits.length).toBe(1)
    expect(src).toContain("group === 'yours' ? 'Your SOPs' : 'Library'")
  })

  test('SUR-06: the new admin scope-column header reads "Admin", not "Library"', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('MillerColumnHeader>Admin<')
  })
})

test.describe('redirect shim — legacy /admin/sops deep links all resolve on /sops', () => {
  test('view=attention, view=access, status=draft|published|failed, owner=me, and bare departments/collection all map to an admin scope', () => {
    const code = stripComments(read(SOPS_PAGE))
    expect(code).toContain("view === 'attention'")
    expect(code).toContain("scope: 'admin-attention'")
    expect(code).toContain("view === 'access'")
    expect(code).toContain("scope: 'admin-access'")
    expect(code).toContain("status === 'draft' || status === 'published' || status === 'failed'")
    expect(code).toContain("params.get('owner') === 'me'")
    expect(code).toContain("scope: 'admin-all', ownerOnly: true")
  })
})
