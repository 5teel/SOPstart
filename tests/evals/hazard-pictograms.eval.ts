/**
 * Deployed-site eval -- a SOP's hazard pictograms read as one hazard row with the signs on it, not one
 * row per label with no pictures (2026-10-20).
 *
 * Fixture: the analogue test SOP HM-EXT-03-027 (Visy org, draft; eval-admin is a Visy admin). Read-only.
 * Self-skips without EVAL_BASE_URL or when that SOP is gone. ponytail: tied to one live SOP;
 * move to a seeded eval-site fixture if it is ever deleted.
 */
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, signInAs } from './lib/session'
import { shot } from './lib/plant-fixture'

const SOP_ID = 'a5447e85-5713-4b71-8524-d82c15677dae'
const SLOW = { timeout: 30_000 }

test.describe('Hazard pictograms (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]] as const) {
    test(`PICTO-01 the pictogram list is one hazard row with 11 signs (${name})`, async ({ browser }) => {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const { data: sop } = await db.from('sops').select('id').eq('id', SOP_ID).maybeSingle()
      test.skip(!sop, 'analogue SOP not present')

      const ctx = await browser.newContext({ viewport, baseURL: process.env.EVAL_BASE_URL })
      await signInAs(ctx, 'admin')
      const page = await ctx.newPage()
      await page.goto(`/sops/${SOP_ID}`)
      const row = page.locator('[data-kind="hazard"]', { hasText: 'Hazard symbols shown' })
      await expect(row).toHaveCount(1, SLOW)
      await expect(row).toContainText('Danger, High Noise Level')
      await expect(row.locator('img')).toHaveCount(11)
      // No hazard row is a bare pictogram label any more.
      await expect(page.locator('[data-kind="hazard"]', { hasText: /^\s*-?\s*Crush Hand\s*$/ })).toHaveCount(0)
      await row.scrollIntoViewIfNeeded()
      await shot(page, `picto-01-${name}`)
      await ctx.close()
    })
  }

  test('PICTO-02 a step caution stays in its section, after the steps before it (ADR-0023)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: process.env.EVAL_BASE_URL })
    await signInAs(ctx, 'admin')
    const page = await ctx.newPage()
    await page.goto(`/sops/${SOP_ID}`)
    const rows = page.getByTestId('focus-browse-step')
    await expect(rows.filter({ hasText: 'die-face guard line' }).first()).toBeVisible(SLOW)
    const texts = await rows.allInnerTexts()
    const caution = texts.findIndex((t) => t.includes('die-face guard line'))
    const install = texts.findIndex((t) => t.includes("manufacturer's software"))
    expect(install).toBeGreaterThan(-1)
    expect(caution).toBeGreaterThan(install)
    await rows.nth(caution).scrollIntoViewIfNeeded()
    await shot(page, 'picto-02-caution-in-step')
    await ctx.close()
  })

  test('PICTO-03 the clear version shows the pictograms with its hazards (ADR-0023)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: process.env.EVAL_BASE_URL })
    await signInAs(ctx, 'admin')
    const page = await ctx.newPage()
    await page.goto(`/?sop=${SOP_ID}`)
    await page.getByTestId('read-version-clear').click(SLOW)
    const signs = page.getByTestId('clear-view').getByTestId('clear-signs').first()
    await expect(signs.locator('img')).toHaveCount(11, SLOW)
    await page.getByTestId('clear-open-items').click()
    await expect(page.getByTestId('clear-open-items')).toContainText('Hazard sign')
    await signs.scrollIntoViewIfNeeded()
    await shot(page, 'picto-03-clear-signs')
    await ctx.close()
  })
})
