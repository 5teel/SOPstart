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

test.describe('Notification bell (60-16)', () => {
  test('the bell holds no router', () => {
    expect(bell()).not.toMatch(/useRouter|next\/navigation/)
  })

  test('the bell shows a dot, never a number (63 R5)', () => {
    const b = bell()
    expect(b).toContain('n > 0 && <span data-testid="shell-bell-dot"')
    expect(b).toContain('data-testid="shell-bell"')
    expect(b).not.toContain('99+')
    expect(b).not.toContain('{n}')
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

  test('NotificationBell mounts in the home as a lazy seam and opens My record at Notifications', () => {
    const rel = 'src/components/home/HomeShell.tsx'
    const s = read(rel)
    expect(s, rel).toContain('<NotificationBell')
    // the bell is a lazy seam (bundle fallback, 60-16): the home route could not carry it statically
    expect(s, rel).toContain("import('@/components/shell/NotificationBell')")
    expect(s, rel).not.toMatch(/from '@\/components\/shell\/NotificationBell'/)
    expect(s, rel).toContain("requestOverviewSection('notifications')")
    expect(s, rel).toContain("s: 'record'")
  })
})
