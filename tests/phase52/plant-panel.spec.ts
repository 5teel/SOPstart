/**
 * Phase 52 -- HOM-04. Worker-variant machine panel stub for MachinePanel.
 * Plan 52-02 Task 3 flips these to live source-contract assertions.
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PLANT_PANEL_WIDTH } from '@/lib/site/scene'

const ROOT = path.resolve(__dirname, '..', '..')
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'components', 'sop', 'plant', 'MachinePanel.tsx'), 'utf-8')

test.describe('MachinePanel (worker variant)', () => {
  test('the close control calls onClose', () => {
    expect(SRC).toMatch(/data-testid="plant-panel-close"[\s\S]{0,80}onClick=\{onClose\}/)
  })

  test('SOP rows render to-do first, sorted by compareToDoFirst -- the component never re-sorts', () => {
    // Ordering is worker-signal's job (compareToDoFirst / machineSops); the
    // panel renders `sops` in the order it is handed, and must not carry its
    // own .sort() call that could silently disagree with the caller.
    expect(SRC).not.toContain('.sort(')
    expect(SRC).toMatch(/sops\.map\(/)
  })

  test('each to-do row uses the shared RelBadge', () => {
    expect(SRC).toContain("from '@/components/sop/plant/RelBadge'")
    expect(SRC).toMatch(/plantRelState\(/)
    expect(SRC).toMatch(/<RelBadge\s+rel=\{rel\}/)
  })

  test('the Walk › link points to /sops/<id>?tab=walk', () => {
    expect(SRC).toContain('data-testid="plant-panel-walk"')
    expect(SRC).toMatch(/href=\{`\/sops\/\$\{sop\.id\}\?tab=walk`\}/)
    expect(SRC).not.toContain('/walkthrough')
  })

  test('the plain Read link points to /sops/<id>', () => {
    expect(SRC).toMatch(/href=\{`\/sops\/\$\{sop\.id\}`\}/)
  })

  test('a machine with no sprite_path shows "no photo yet"', () => {
    expect(SRC).toContain('no photo yet')
  })

  test('a machine with no linked SOPs shows "No procedures for this machine yet."', () => {
    expect(SRC).toContain('No procedures for this machine yet.')
    expect((SRC.match(/No procedures for this machine yet\./g) ?? []).length).toBe(1)
  })

  test('the panel width matches PLANT_PANEL_WIDTH (380px)', () => {
    expect(PLANT_PANEL_WIDTH).toBe(380)
    expect(PLANT_PANEL_WIDTH / 4).toBe(95)
    expect(SRC).toMatch(/\bw-95\b/)
  })

  test('the panel renders no admin controls (no owner/rev lines, no edit affordance, no route push)', () => {
    for (const banned of ['/walkthrough', 'router.push', 'useRouter', 'Edit', 'owner', 'rev ']) {
      expect(SRC).not.toContain(banned)
    }
  })

  test('the closed panel is not tabbable (inert)', () => {
    expect(SRC).toMatch(/inert=\{!open\}/)
  })
})
