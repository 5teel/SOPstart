/**
 * SB-LINE-05 — Sub-trade admin assignment (source-contract + e2e).
 *
 * Wave 4 status: code-complete. Runtime e2e against a live DB requires
 * Simon's `npx supabase db push --include-all` (Wave 1 migration 00030)
 * + Playwright chromium binary. Both are gated on phase UAT.
 *
 * For now this spec runs as LIVE source-contract assertions against the
 * actual TSX files, matching the Plan 15-01/15-02 Rule-3 trade-off
 * (chromium binary not installed locally). The structural assertions catch
 * any future regression in:
 *   - SubTradePicker component shape (multi-select pills, 5 seed slugs)
 *   - admin/team page integration (per-worker SubTradePicker)
 *   - admin/sops/[sopId]/assign page integration (sop-level SubTradePicker)
 *   - server actions surface (listSubTrades, assign{User,Sop}SubTrades)
 *
 * Runtime e2e portions remain as `test.fixme` blocks below documenting
 * the exact UAT script. Phase UAT will flip them.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PICKER = path.join(ROOT, 'src', 'components', 'admin', 'SubTradePicker.tsx')
const TEAM_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'team', 'page.tsx')
const ASSIGN_PAGE = path.join(
  ROOT,
  'src',
  'app',
  '(protected)',
  'admin',
  'sops',
  '[sopId]',
  'assign',
  'page.tsx',
)
const ACTIONS = path.join(ROOT, 'src', 'actions', 'sub-trades.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

/**
 * Strip block comments (`/* ... *\/`) and line comments (`// ...`) so
 * source-contract assertions can check the substantive code body without
 * matching anti-patterns mentioned in docstrings. Same approach used by
 * tests/integration/voice-qa-happy-path.spec.ts (Phase 15-02 Deviation 4).
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

test.describe('SB-LINE-05 — SubTradePicker component contract', () => {
  test('SubTradePicker imports server actions + uses aria-pressed pills', () => {
    const src = read(PICKER)
    expect(src).toContain("'use client'")
    expect(src).toContain("from '@/actions/sub-trades'")
    expect(src).toContain('listSubTrades')
    expect(src).toContain('assignUserSubTrades')
    expect(src).toContain('assignSopSubTrades')
    expect(src).toContain('getUserSubTrades')
    expect(src).toContain('getSopSubTrades')
    expect(src).toContain('aria-pressed')
    // Real <button> (not div) for the pill so aria-pressed is valid.
    // Use multiline/dotall match since JSX attributes wrap across lines.
    expect(src).toMatch(/<button[\s\S]*?aria-pressed/)
  })

  test('SubTradePicker exposes both modes in a discriminated union', () => {
    const src = read(PICKER)
    expect(src).toMatch(/mode:\s*'user'/)
    expect(src).toMatch(/mode:\s*'sop'/)
    expect(src).toContain('userId: string')
    expect(src).toContain('sopId: string')
  })

  test('SubTradePicker reverts optimistic update on server error', () => {
    const src = read(PICKER)
    // Pattern: capture prev, set next, on error rollback to prev
    expect(src).toContain('setSelectedIds(prev)')
    expect(src).toMatch(/error/)
  })

  test('SubTradePicker reads vocab once per target', () => {
    const src = read(PICKER)
    expect(src).toContain('Promise.all')
    expect(src).toContain('listSubTrades()')
    expect(src).toContain('useEffect')
  })
})

test.describe('SB-LINE-05 — admin/team page integration', () => {
  test('team page imports SubTradePicker', () => {
    const src = read(TEAM_PAGE)
    expect(src).toContain("from '@/components/admin/SubTradePicker'")
  })

  test('team page renders SubTradePicker per worker row', () => {
    const src = read(TEAM_PAGE)
    expect(src).toMatch(/<SubTradePicker\s+mode="user"\s+userId=/)
  })

  test('team page preserves existing RoleAssignmentTable', () => {
    const src = read(TEAM_PAGE)
    expect(src).toContain('RoleAssignmentTable')
  })
})

test.describe('SB-LINE-05 — admin/sops/[sopId]/assign page integration', () => {
  test('assign page imports SubTradePicker', () => {
    const src = read(ASSIGN_PAGE)
    expect(src).toContain("from '@/components/admin/SubTradePicker'")
  })

  test('assign page renders SubTradePicker for the SOP', () => {
    const src = read(ASSIGN_PAGE)
    expect(src).toMatch(/<SubTradePicker\s+mode="sop"\s+sopId=/)
  })

  test('assign page keeps existing role + individual sections', () => {
    const src = read(ASSIGN_PAGE)
    expect(src).toContain('Assign by role')
    expect(src).toContain('Assign to individual workers')
  })
})

test.describe('SB-LINE-05 — sub-trades server actions contract', () => {
  test('actions file uses RLS-respecting client (NOT createAdminClient)', () => {
    const src = read(ACTIONS)
    expect(src).toContain("'use server'")
    expect(src).toContain("from '@/lib/supabase/server'")
    // Strip comments before the anti-pattern check — the file's
    // docstring explicitly names createAdminClient as the anti-pattern.
    const codeOnly = stripComments(src)
    expect(codeOnly).not.toContain('createAdminClient')
  })

  test('actions exports the 5 required functions', () => {
    const src = read(ACTIONS)
    expect(src).toMatch(/export async function listSubTrades/)
    expect(src).toMatch(/export async function assignUserSubTrades/)
    expect(src).toMatch(/export async function assignSopSubTrades/)
    expect(src).toMatch(/export async function getUserSubTrades/)
    expect(src).toMatch(/export async function getSopSubTrades/)
  })

  test('write paths gate on requireAdmin()', () => {
    const src = read(ACTIONS)
    // requireAdmin defined + invoked at least twice (once per write path)
    expect(src).toMatch(/async function requireAdmin/)
    const matches = src.match(/await requireAdmin\(\)/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  test('writes use replace-semantics (delete then insert)', () => {
    const src = read(ACTIONS)
    // For users
    expect(src).toMatch(/from\('users_sub_trades'\)\s*\n?\s*\.delete\(\)/)
    expect(src).toMatch(/from\('users_sub_trades'\)\s*\n?\s*\.insert/)
    // For sops
    expect(src).toMatch(/from\('sops_sub_trades'\)\s*\n?\s*\.delete\(\)/)
    expect(src).toMatch(/from\('sops_sub_trades'\)\s*\n?\s*\.insert/)
  })

  test('writes Zod-validate via the assignUserSubTradesSchema / assignSopSubTradesSchema', () => {
    const src = read(ACTIONS)
    expect(src).toContain('assignUserSubTradesSchema')
    expect(src).toContain('assignSopSubTradesSchema')
    expect(src).toContain('.safeParse(')
  })
})

// ---------------------------------------------------------------------------
// Runtime UAT — flipped at phase UAT once chromium + db push are in place.
// ---------------------------------------------------------------------------

test.describe('SB-LINE-05 — runtime admin flow (UAT)', () => {
  test.fixme(
    'admin assigns [fitter, sparky] to worker via team page; persists in users_sub_trades',
    async ({ page }) => {
      // unblocks after `npx supabase db push --include-all` + chromium install:
      // 1. Mint admin session cookie
      // 2. await page.goto('/admin/team')
      // 3. Locate worker row → click Fitter pill, click Sparky pill
      // 4. Reload page → both pills aria-pressed=true
      // 5. Query supabase admin client: users_sub_trades count for worker = 2
      void page
    },
  )

  test.fixme(
    'admin assigns SOP to [fitter] via assign page; persists in sops_sub_trades',
    async ({ page }) => {
      // unblocks after `npx supabase db push --include-all` + chromium install:
      // 1. Mint admin session cookie
      // 2. await page.goto('/admin/sops/<sop-id>/assign')
      // 3. Click Fitter pill in the sub-trade section
      // 4. Reload → pill remains pressed
      // 5. Worker WITH fitter tag: SOP visible. Worker WITHOUT: not visible.
      void page
    },
  )
})
