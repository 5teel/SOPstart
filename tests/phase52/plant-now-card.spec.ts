/**
 * Phase 52 -- HOM-03. Live source-contract tests for NowCard.
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'components', 'sop', 'plant', 'NowCard.tsx'), 'utf-8')

test.describe('NowCard', () => {
  test('Walk it opens the top queue item in browse state, from its machine or the Noticeboard (58-10, D-27)', () => {
    expect(SRC).toContain('data-testid="plant-now-walk"')
    expect(SRC).toContain("focusHref(now.sop.id, { from: now.machine?.id ?? 'noticeboard' })")
    expect(SRC).toMatch(/href=\{href as string\}\s+data-testid="plant-now-walk"/)
    expect(SRC).not.toContain('/walkthrough')
    expect(SRC).not.toContain('?tab=')
  })

  test('Show me links to the same browse address -- it no longer locates the machine on the map (D-21)', () => {
    expect(SRC).toMatch(/href=\{href as string\}\s+data-testid="plant-now-show"/)
    expect(SRC).not.toContain('onShowMe')
  })

  test('up to two more queue items render under "Then:"', () => {
    expect(SRC).toMatch(/items\.slice\(1,\s*3\)/)
    expect(SRC).toContain('Then:')
  })

  test('an empty queue shows "Nothing due — browse your machines" instead of the card contents', () => {
    expect(SRC).toContain('Nothing due — browse your machines')
    expect((SRC.match(/Nothing due — browse your machines/g) ?? []).length).toBe(1)
  })

  test('the component does not sort or filter -- it renders the NowItem[] it is handed, in order', () => {
    expect(SRC).not.toContain('.sort(')
    expect(SRC).not.toContain('plantRelState(')
    expect(SRC).not.toContain('router.push')
    expect(SRC).not.toContain('useRouter')
    expect(SRC).not.toMatch(/\.put\(|\.add\(|\.delete\(/)
  })

  test('the card reads step minutes from Supabase', () => {
    expect(SRC).toMatch(/useQuery\(/)
    expect(SRC).toContain("from('sop_focus_steps')")
    expect(SRC).not.toContain('networkMode')
  })

  test('the card is in-flow; the worker shell places it (57-08: the plant home is gone)', () => {
    const SHELL = fs.readFileSync(path.join(ROOT, 'src', 'components', 'shell', 'WorkerShell.tsx'), 'utf-8')
    expect(SRC).not.toMatch(/\babsolute\b/)
    expect(SHELL).toContain('<NowCard')
  })
})
