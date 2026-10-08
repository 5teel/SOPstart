/**
 * Phase 60 -- the notification and request panels (60-15). Requirements: NTF-01, RQS-01, RQS-03.
 * Decisions: D-13, A-06, A-07. Source-contract guards over the home panels and overview-focus.ts
 * (63-19: the overview that composed them is gone; the panels sit in My record);
 * the screen itself is judged by the deployed eval (60-16 mounts it).
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// 63-19: the site overview is gone; the two panels it composed are asserted where they live (My record).
const NOTIF = strip(read('src/components/home/panels/NotificationsPanel.tsx'))
const REQS = strip(read('src/components/home/panels/MyRequestsPanel.tsx'))
const SCROLL = strip(read('src/components/home/panels/useSectionScroll.ts'))
const SRC = [NOTIF, REQS, SCROLL].join('\n')
const FOCUS = strip(read('src/lib/shell/overview-focus.ts'))

/** Bodies of every useEffect callback, by brace matching from the opening call. */
function effectBodies(src: string): string[] {
  const out: string[] = []
  let at = src.indexOf('useEffect(')
  while (at !== -1) {
    let depth = 0
    let i = src.indexOf('{', at)
    const start = i
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      if (src[i] === '}' && --depth === 0) break
    }
    out.push(src.slice(start, i + 1))
    at = src.indexOf('useEffect(', i)
  }
  return out
}

test.describe('Overview (60-15)', () => {
  test('each panel carries its test id and hides itself when it has nothing to show', () => {
    expect(NOTIF).toContain('data-testid="overview-notifications"')
    expect(REQS).toContain('data-testid="overview-requests"')
    expect(NOTIF).toMatch(/if \(unread\.length === 0 && read\.length === 0\) return null/)
    expect(REQS).toMatch(/if \(!anyRequests \|\| !groups\) return dialogEl\(\)/)
  })

  test('notifications use the browser client; no server action; mark-read writes read_at only', () => {
    expect(NOTIF).toContain("from '@/lib/supabase/client'")
    expect(NOTIF).toContain(".from('notifications')")
    expect(NOTIF).not.toMatch(/from '@\/actions\//)
    expect(NOTIF).not.toMatch(/from '@\/lib\/supabase\/(server|admin)'/)
    expect(NOTIF).toContain('Nothing unread.')
    expect(NOTIF).not.toMatch(/NOTIFICATIONS\s*·/) // R5: no number in the heading
    const updates = NOTIF.match(/\.update\(\{[^}]*\}/g) ?? []
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatch(/^\.update\(\{ read_at: /)
    expect(NOTIF).toMatch(/\.is\('read_at', null\)/) // the unread filter lives in the queryFn
    // WR-07: the browser client resolves { error }; a denied or timed-out mark-read undims the row
    const open = NOTIF.slice(NOTIF.indexOf('async function open('), NOTIF.indexOf("if (isSafePlace(n.place) && n.place.startsWith('/sops/'))"))
    expect(open).toContain('const { error } = await Promise.race([')
    expect(open).toContain('failed = !!error')
    expect(open).toMatch(/if \(failed\)\s+setDimmed\(\(s\) => \{\s+const next = new Set\(s\)\s+next\.delete\(n\.id\)/)
    expect(NOTIF).toContain('.limit(50)')
    expect(NOTIF).toContain('refetchOnWindowFocus: true')
    expect(NOTIF).not.toContain('refetchInterval')
  })

  test('opening a notification checks the place first; router push only in the click path, never an effect', () => {
    expect(NOTIF).toContain('isSafePlace(n.place)')
    expect(NOTIF).toContain("n.place.startsWith('/sops/')")
    expect(NOTIF).toContain('onOpenAddress(')
    expect(SRC).not.toMatch(/router\.replace/)
    expect(NOTIF.match(/router\.push\(/g)).toHaveLength(1)
    expect(NOTIF).toMatch(/onClick=\{\(\) => void open\(n\)\}/)
    for (const body of effectBodies(SRC)) {
      expect(body).not.toMatch(/router\./)
      expect(body).not.toMatch(/\bselect\(/)
      expect(body).not.toMatch(/onOpenAddress\(/)
    }
    expect(SCROLL).toContain('takeOverviewSection(section)')
  })

  test('no stylesheet import and no shell cache key in the panels', () => {
    expect(SRC).not.toMatch(/import\s+['"][^'"]*\.css['"]/)
    expect(SRC).not.toMatch(/SHELL_KEY/)
  })

  test('withdraw, decline and stop asking are the right actions; the last two go through the reason dialog', () => {
    expect(SRC).toContain("from '@/actions/requests'")
    expect(SRC).toMatch(/withdrawRequest\(\{ requestId: r\.id \}\)/)
    expect(SRC).toMatch(/declineAsk\(\{ requestId: d\.req\.id, note \}\)/)
    expect(SRC).toMatch(/stopAsking\(\{ requestId: d\.req\.id, note \}\)/)
    expect(SRC).toContain('data-testid="request-withdraw"')
    expect(SRC).toContain('data-testid="ask-decline"')
    expect(SRC).toContain("'ask-row'")
    expect(SRC).toContain("from '@/components/office/ReasonDialog'")
    expect(SRC).toMatch(/<ReasonDialog[\s\S]*onConfirm=\{\(note\) => void answer\(dialog, note\)\}/)
    expect(SRC).toContain('Declined')
    expect(SRC).toContain('Stopped asking')
    expect(SRC).toContain('logged in the decision ledger')
    expect(SRC).toContain("Withdrawn.")
    // Withdraw has no dialog and no ledger suffix.
    expect(SRC).not.toMatch(/Withdrawn\. ?·/)
  })

  test("the person's assignments refresh after a decline and for unread asked rows", () => {
    expect(SRC.match(/\['user-sop-assignments'\]/g)!.length).toBeGreaterThanOrEqual(3)
    expect(NOTIF).toMatch(/n\.kind === 'asked'/)
    expect(NOTIF).toMatch(/askedIds === askedSeen\.current/) // once per new set of ids
  })

  test('the editor and composer arrive lazily; the groups come from the shared model', () => {
    expect(REQS).toMatch(/dynamic\(\s*\(\) => import\('@\/components\/requests\/RequestComposer'\)/)
    expect(SRC).not.toMatch(/^import (?!type )[^\n]*from '@\/components\/requests\/(RequestComposer|ObjectiveEditor)'/m)
    expect(REQS).toContain('groupMyRequests(')
    expect(REQS).toContain('Ask for a new SOP')
  })

  test('overview-focus is plain, stores one pending section, and only dispatches an event', () => {
    expect(FOCUS).not.toMatch(/^['"]use (client|server)['"]/m)
    expect(FOCUS).toContain('export function requestOverviewSection')
    expect(FOCUS).toContain('export function takeOverviewSection')
    expect(FOCUS).toContain('export const OVERVIEW_SECTION_EVENT')
    expect(FOCUS).not.toMatch(/router|navigate|location\./)
  })
})
