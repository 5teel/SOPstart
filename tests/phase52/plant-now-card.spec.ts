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
  test('the Walk it control links to /sops/<id>?tab=walk for the top queue item', () => {
    expect(SRC).toContain('data-testid="plant-now-walk"')
    expect(SRC).toMatch(/href=\{`\/sops\/\$\{now\.sop\.id\}\?tab=walk`\}/)
    expect(SRC).not.toContain('/walkthrough')
  })

  test("the Show me control calls onShowMe with the top item's machine id, and only renders when a machine exists", () => {
    expect(SRC).toContain('data-testid="plant-now-show"')
    expect(SRC).toMatch(/onClick=\{\(\)\s*=>\s*onShowMe\(now\.machine!?\.id\)\}/)
    expect(SRC).toMatch(/now\.machine\s*&&/)
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
    expect(SRC).toContain("from('sop_sections')")
    expect(SRC).not.toContain('networkMode')
  })

  test('the card is 330px wide (w-82.5)', () => {
    expect(SRC).toMatch(/\bw-82\.5\b/)
  })
})
