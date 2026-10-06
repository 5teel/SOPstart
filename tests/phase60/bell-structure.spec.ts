/**
 * Phase 60 -- Notification bell (60-16). Requirements: NTF-01, SHL-03. Decisions: D-09, A-06.
 * Source-contract cases; the deployed eval proves the behaviour.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')
const bell = () => read('src/components/shell/NotificationBell.tsx')
const frame = () => read('src/components/shell/ShellFrame.tsx')

test.describe('Notification bell (60-16)', () => {
  test('ShellFrame takes a renderBell slot beside search, absent while editing, and holds no router', () => {
    const f = frame()
    expect(f).toContain('renderBell?(select: (p: Place) => void): ReactNode')
    expect(f).toContain('{!editing && renderBell?.(select)}')
    // the slot sits in the same row as the search label
    expect(f).toMatch(/<div className="flex items-center pr-2">\s*<label[\s\S]*<\/label>\s*\{!editing && renderBell/)
    expect(f).toContain('placeholder="Search…"')
    expect(f).not.toMatch(/useRouter|next\/navigation/)
    expect(bell()).not.toMatch(/useRouter|next\/navigation/)
  })

  test('the count is hidden at zero and caps at 99+', () => {
    const b = bell()
    expect(b).toContain('n > 0 && (')
    expect(b).toContain("n > 99 ? '99+' : n")
    expect(b).toContain('data-testid="shell-bell"')
    expect(b).toContain('data-testid="shell-bell-count"')
  })

  test('reads use the browser Supabase client under RLS, never a server action or a timer (A-06)', () => {
    const b = bell()
    expect(b).toContain("from '@/lib/supabase/client'")
    expect(b).toContain(".from('notifications')")
    expect(b).not.toMatch(/@\/actions\//)
    expect(b).not.toContain('refetchInterval')
    expect(b).toContain('refetchOnWindowFocus: true')
    expect(b).toContain('.limit(100)')
  })

  test('a new asked notification refreshes the assignments query once', () => {
    const b = bell()
    expect(b).toContain("r.kind === 'asked'")
    expect(b).toContain("queryKey: ['user-sop-assignments']")
  })

  test('the bell is a click that only opens the overview (no router, no server action)', () => {
    const b = bell()
    expect(b).toContain('onClick={onOpen}')
  })

  test('NotificationBell mounts in both shells and opens the overview at Notifications', () => {
    for (const rel of ['src/components/shell/WorkerShell.tsx', 'src/components/shell/AdminShell.tsx']) {
      const s = read(rel)
      expect(s, rel).toContain('<NotificationBell')
      expect(s, rel).toContain("requestOverviewSection('notifications')")
      expect(s, rel).toContain("select({ kind: 'overview' })")
      expect(s, rel).toContain('renderBell=')
      expect(s, rel).toContain("import('@/components/shell/SiteOverview')")
      expect(s, rel).not.toMatch(/from '@\/components\/shell\/SiteOverview'/)
    }
  })

  test('the worker Office card points at the overview instead of promising a later update', () => {
    const r = read('src/components/shell/RoomBodies.tsx')
    expect(r).toContain('Your requests are on the site overview.')
    expect(r).toContain('Go to my requests')
    expect(r).not.toContain('Your requests will show here')
    const w = read('src/components/shell/WorkerShell.tsx')
    expect(w).toContain("requestOverviewSection('requests')")
  })
})
