/**
 * SB-LINE-05 — Sub-trade RLS backward compatibility (source-contract + runtime).
 *
 * Verifies that the migration-00030 RLS extension preserves Phase 1-14
 * worker access patterns:
 *   1. SOPs with NO `sops_sub_trades` rows remain visible to all workers
 *      (`not exists` short-circuit in the policy).
 *   2. SOPs WITH `sops_sub_trades` rows are filtered by the SECURITY
 *      DEFINER `sub_trade_id_intersects()` helper.
 *
 * Wave 4 status: code-complete (migration 00030 + helper functions exist
 * in supabase/migrations/, types extended in database.types.ts). Runtime
 * assertions require Simon's `npx supabase db push --include-all` to
 * activate the policy in the live DB. Until then we run live
 * source-contract assertions against the migration SQL + types.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00030_sub_trades.sql')
const DB_TYPES = path.join(ROOT, 'src', 'types', 'database.types.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SB-LINE-05 — RLS source-contract', () => {
  test('migration 00030 exists with the backward-compat short-circuit', () => {
    const sql = read(MIGRATION)
    // Short-circuit clause: empty sops_sub_trades → visible to everyone
    expect(sql).toMatch(/not exists/i)
    expect(sql).toMatch(/sops_sub_trades/i)
    // The additive policy
    expect(sql).toMatch(/sops_visible_by_sub_trade/i)
  })

  test('migration 00030 defines both SECURITY DEFINER helpers', () => {
    const sql = read(MIGRATION)
    expect(sql).toMatch(/current_user_sub_trades/i)
    expect(sql).toMatch(/sub_trade_id_intersects/i)
    expect(sql.toLowerCase()).toContain('security definer')
  })

  test('migration 00030 seeds the 5-row controlled vocab', () => {
    const sql = read(MIGRATION)
    expect(sql).toMatch(/operator/i)
    expect(sql).toMatch(/fitter/i)
    expect(sql).toMatch(/sparky/i)
    expect(sql).toMatch(/maintainer/i)
    expect(sql).toMatch(/other/i)
    expect(sql.toLowerCase()).toContain('on conflict (slug) do nothing')
  })

  test('database.types.ts exposes the 3 new tables + 2 helper functions', () => {
    const types = read(DB_TYPES)
    expect(types).toContain('sub_trades:')
    expect(types).toContain('users_sub_trades:')
    expect(types).toContain('sops_sub_trades:')
    expect(types).toContain('current_user_sub_trades')
    expect(types).toContain('sub_trade_id_intersects')
  })
})

// ---------------------------------------------------------------------------
// Runtime UAT — flipped after `npx supabase db push --include-all`.
// ---------------------------------------------------------------------------

test.describe('SB-LINE-05 — runtime RLS UAT', () => {
  test.fixme(
    'worker with no sub_trade rows can read SOP with empty sops_sub_trades (backward compat)',
    async ({ page }) => {
      // unblocks after `npx supabase db push --include-all`:
      // 1. Seed: 1 org, 1 SOP (published, NO sops_sub_trades rows),
      //    1 worker user with NO users_sub_trades rows
      // 2. Authenticate as the worker via cookie
      // 3. await page.goto('/sops/<sop-id>')
      // 4. await expect(page.locator('h1')).toContainText('<sop title>')
      // 5. Direct supabase query with worker JWT returns the row
      void page
    },
  )

  test.fixme(
    'worker with fitter tag can read SOP tagged [fitter]; worker without cannot',
    async ({ page }) => {
      // unblocks after `npx supabase db push --include-all`:
      // 1. Seed: 1 org, 1 SOP tagged [fitter] via sops_sub_trades,
      //    workerA with [fitter] in users_sub_trades, workerB no tags
      // 2. workerA → can read SOP
      // 3. workerB → /sops list does NOT show SOP; direct .single() returns null
      void page
    },
  )
})
