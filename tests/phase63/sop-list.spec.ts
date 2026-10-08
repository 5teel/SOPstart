/**
 * Phase 63 -- the SOP list data hooks and components. Requirement HOME-02;
 * threats T-63-11..15. Owner: 63-05. Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { matchesTitle, sanitizeSearch } from '../../src/lib/library/search'

const src = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
/** Comments stripped, so a comment describing a banned pattern cannot trip a guard (CLAUDE.md 2026-09-28). */
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test.describe('sop list', () => {
  test('sanitizeSearch removes PostgREST filter characters, caps length, rejects short', () => {
    expect(sanitizeSearch('a,b(c)d*e%f\\g"h')).toBe('a b c d e f g h')
    expect(sanitizeSearch('x}),or=(id.eq.1')).not.toMatch(/[,()}]/)
    expect(sanitizeSearch('  forklift  ')).toBe('forklift')
    expect(sanitizeSearch('a')).toBeNull()
    expect(sanitizeSearch(' (( ')).toBeNull()
    expect(sanitizeSearch('x'.repeat(200))).toHaveLength(60)
  })

  test('matchesTitle reads title, area and type, case-insensitively', () => {
    const row = { title: 'Mirror Cleaning', areaName: 'Forming', type: 'Machine' }
    expect(matchesTitle(row, 'mirror')).toBe(true)
    expect(matchesTitle(row, 'FORMING')).toBe(true)
    expect(matchesTitle(row, 'machine')).toBe(true)
    expect(matchesTitle(row, 'welding')).toBe(false)
  })

  test('no list hook imports a server action', () => {
    for (const f of ['src/hooks/useLibrary.ts', 'src/hooks/useSopSearch.ts', 'src/hooks/useRecentSops.ts']) {
      expect(code(f), f).not.toContain('@/actions')
    }
  })

  test('useLibrary does not call useWorkerSops and reuses its query function', () => {
    const s = code('src/hooks/useLibrary.ts')
    expect(s).not.toContain('useWorkerSops(')
    expect(s).toContain('libraryQueryFn')
    expect(code('src/hooks/useWorkerSops.ts')).toMatch(/export async function libraryQueryFn|export const libraryQueryFn/)
  })

  test("a person's own completions and walks are filtered on worker_id", () => {
    const s = code('src/hooks/useLibrary.ts')
    expect(s).toMatch(/from\('sop_completions'\)[\s\S]*?\.eq\('worker_id', userId\)/)
    expect(s).toMatch(/from\('sop_walks'\)[\s\S]*?\.eq\('worker_id', userId\)/)
  })

  test("every junction read is bounded by the visible ids", () => {
    const s = code('src/hooks/useLibrary.ts')
    for (const t of ['sop_departments', 'sop_machines']) {
      expect(s, t).toMatch(new RegExp(`from\\('${t}'\\)[^\\n]*\\.in\\('sop_id', ids\\)`))
    }
  })

  test('Recent reads localStorage through useSyncExternalStore, never at module scope', () => {
    const s = code('src/hooks/useRecentSops.ts')
    expect(s).toContain('useSyncExternalStore')
    expect(s).toMatch(/useSyncExternalStore\(subscribe, \(\) => read\(key\), \(\) => ''\)/)
    // Every localStorage touch sits inside a function body (indented), none at column 0.
    expect(s).not.toMatch(/^[^\s/*].*localStorage/m)
  })

  test('SopList reaches RequestComposer only through dynamic(), pre-filled with the search words', () => {
    const s = code('src/components/home/SopList.tsx')
    expect(s).not.toMatch(/from '@\/components\/requests\/RequestComposer'/)
    expect(s).toMatch(/dynamic\(\s*\(\) => import\('@\/components\/requests\/RequestComposer'\)/)
    expect(s).toContain('initialNote={q}')
    expect(code('src/components/requests/RequestComposer.tsx')).toMatch(/useState\(initialNote\)/)
  })

  test('Write it renders only for a SOP admin and opens the blank flow with the title', () => {
    const s = code('src/components/home/SopList.tsx')
    expect(s).toMatch(/\{canWrite && \(\s*<Link/)
    expect(s).toContain('/admin/sops/new/blank?title=${encodeURIComponent(q)}')
    expect(code('src/app/(protected)/admin/sops/new/blank/page.tsx')).toMatch(/title\.trim\(\)\.slice\(0, 200\)/)
    expect(code('src/app/(protected)/admin/sops/new/blank/WizardClient.tsx')).toContain('title: initialTitle')
  })

  test('the empty-search copy, both labels and the list structure are present', () => {
    const s = src('src/components/home/SopList.tsx')
    for (const t of ['No SOP for', 'Ask for one', 'Write it', 'Recent', 'Most used', 'All SOPs', 'Search SOPs, steps and tools', 'Search all SOPs, steps and tools']) {
      expect(s, t).toContain(t)
    }
    expect(s).toContain('aria-pressed')
    expect(s).toContain('data-testid="area-group"')
    expect(s).toContain('data-testid="area-filter"')
  })

  test('the list carries no retired to-do vocabulary, no hex and no arbitrary size', () => {
    for (const f of ['src/components/home/SopList.tsx', 'src/components/home/SopRow.tsx']) {
      const s = code(f)
      expect(s, f).not.toMatch(/\b(overdue|due|Next for you)\b/i)
      expect(s, f).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
      expect(s, f).not.toMatch(/-\[[0-9.]+(px|rem)?\]/)
    }
  })
})
