/**
 * Deployed-site eval -- Settings → Your site picker (2026-10-15): someone in several sites hides one
 * from their own site picker and brings it back. The site they are in cannot be hidden.
 *
 * Fixture: the eval-site admin is made a worker of a second eval-only site for the run, and taken
 * out of it (and its hidden list cleared) after. Self-skips without EVAL_BASE_URL.
 */
import { test, expect, type Browser } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_USERS, signInAs } from './lib/session'
import { shot } from './lib/plant-fixture'

const SLOW = { timeout: 30_000 }
const SECOND = 'SOPstart Eval Second Site'

async function open(browser: Browser, path: string) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: process.env.EVAL_BASE_URL })
  await signInAs(ctx, 'siteAdmin')
  const page = await ctx.newPage()
  await page.goto(path)
  return { ctx, page }
}

test.describe.serial('Your site picker (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient
  let userId: string
  let secondId: string

  const reset = async () => {
    await db.from('organisation_members').delete().eq('user_id', userId).eq('organisation_id', secondId)
    const { data } = await db.auth.admin.getUserById(userId)
    await db.auth.admin.updateUserById(userId, { user_metadata: { ...data.user?.user_metadata, hidden_site_ids: [] } })
  }

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 })
    userId = users.users.find((u) => u.email === EVAL_USERS.siteAdmin)!.id
    const { data: org } = await db.from('organisations').select('id').eq('name', SECOND).maybeSingle()
    secondId = org?.id ?? (await db.from('organisations').insert({ name: SECOND }).select('id').single()).data!.id
    await reset()
    const { error } = await db.from('organisation_members').insert({ organisation_id: secondId, user_id: userId, role: 'worker' })
    if (error) throw new Error(error.message)
  })

  test.afterAll(async () => {
    if (EVAL_ENV_READY && db && userId && secondId) await reset()
  })

  test('SITES-01 hiding a site in Settings takes it out of the picker; the site you are in cannot be hidden', async ({ browser }) => {
    const { ctx, page } = await open(browser, '/admin/settings')
    try {
      const card = page.getByTestId('site-picker-settings')
      await expect(card).toBeVisible(SLOW)
      await expect(card.getByTestId('site-picker-row')).toHaveCount(2)
      const second = card.locator(`[data-site="${SECOND}"] input`)
      const other = card.locator(`[data-testid="site-picker-row"]:not([data-site="${SECOND}"]) input`)
      await expect(other).toBeDisabled()
      await expect(second).toBeChecked()
      await second.uncheck()
      await expect(second).not.toBeChecked(SLOW)
      await shot(page, 'sites-01-settings-hidden')
      await page.goto('/')
      await expect(page.getByTestId('home-org').first()).toBeAttached(SLOW)
      await expect(page.getByTestId('site-switch')).toHaveCount(0)
    } finally {
      await ctx.close()
    }
  })

  test('SITES-02 ticking it again brings it back to the picker', async ({ browser }) => {
    const { ctx, page } = await open(browser, '/admin/settings')
    try {
      const second = page.getByTestId('site-picker-settings').locator(`[data-site="${SECOND}"] input`)
      await expect(second).not.toBeChecked(SLOW)
      await second.check()
      await expect(second).toBeChecked(SLOW)
      await page.goto('/')
      await expect(page.locator('[data-testid="site-switch"]').first().locator('option')).toHaveCount(2, SLOW)
      await shot(page, 'sites-02-home-picker')
    } finally {
      await ctx.close()
    }
  })
})
