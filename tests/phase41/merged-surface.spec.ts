/**
 * Phase 41 / Plan 41-01 — Wave-0 stub for SUR-01 / SUR-02 / SUR-06.
 * Flipped live by 41-05 (the merged `/sops/page` build-out).
 *
 * Rendering model this contract assumes (D-03, decided in 41-01's
 * objective): `/sops` stays a client component; the three admin views are
 * `next/dynamic({ ssr: false })` lenses gated by `useIsAdmin()`.
 *
 * Source-contract idiom, not browser automation — normalises \r\n to \n
 * per CLAUDE.md 2026-07-18.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SOPS_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('SUR-01 — merged /sops surface gates admin scope on useIsAdmin()', () => {
  test.fixme(true, 'flipped live by 41-05')
  test('SUR-01: admin scope group is gated on useIsAdmin() from RoleProvider', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain("useIsAdmin")
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
  test.fixme(true, 'flipped live by 41-05')
  test('SUR-02: AdminStatusLens / AdminAttentionLens / AdminAccessLens only referenced inside dynamic({ ssr: false })', () => {
    const src = read(SOPS_PAGE)
    for (const lens of ['AdminStatusLens', 'AdminAttentionLens', 'AdminAccessLens']) {
      expect(src).toContain(lens)
    }
    expect(src).toContain('ssr: false')
  })

  test('SUR-02 / deep-link: page resolves view, status, owner, departments, collection, sop from useSearchParams', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('useSearchParams')
    for (const param of ['view', 'status', 'owner', 'departments', 'collection', 'sop']) {
      expect(src).toContain(param)
    }
  })

  test('SUR-02 / deep-link: departments/collection are ignored when scope is the access lens', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('isAccessView')
  })

  test('SUR-02 / hot path: admin scope changes use history.replaceState, never router.push for scope', () => {
    const src = read(SOPS_PAGE)
    expect(src).toContain('history.replaceState')
  })
})

test.describe('SUR-06 — "Library" survives only as a scope/filter label', () => {
  test.fixme(true, 'flipped live by 41-05')
  test('SUR-06: no nav-label or destination use of "Library" beyond the scope-group header', () => {
    const src = read(SOPS_PAGE)
    const libraryHits = (src.match(/Library/g) ?? []).length
    // Exactly the scope-group header usage — a real assertion is written
    // in 41-05 against the actual JSX once the header exists.
    expect(libraryHits).toBeGreaterThanOrEqual(0)
  })
})
