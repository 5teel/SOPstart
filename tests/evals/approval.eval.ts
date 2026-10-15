/**
 * Deployed-site eval -- ADR-0018: the signed-out front door has Sign in and Enquiries, and every
 * new account waits for a SOPstart (platform) admin before it can open a site.
 *
 * Fixtures (made here, removed after): an invited account with a worker membership in the eval
 * site, and a throwaway platform admin (confirmed at creation, so approved; a platform_admins row
 * for the run only). Self-skips without EVAL_BASE_URL.
 */
import { test, expect, type Browser } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_SITE_ORG_NAME, signInAsEmail } from './lib/session'
import { shot } from './lib/plant-fixture'

const SLOW = { timeout: 30_000 }
const RUN = Date.now()
const NEWBIE = `eval-approval-new-${RUN}@sopstart.com`
const PLATFORM = `eval-approval-platform-${RUN}@sopstart.com`

async function open(browser: Browser, email: string, path: string) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: process.env.EVAL_BASE_URL })
  await signInAsEmail(ctx, email)
  const page = await ctx.newPage()
  await page.goto(path)
  return { ctx, page }
}

test.describe.serial('ADR-0018 -- new accounts wait for approval (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient
  let newbieId = ''
  let platformId = ''

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const { data: org } = await db.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).single()
    const site = org!.id as string
    // Invited (generateLink sends no email): waits for approval.
    const inv = await db.auth.admin.generateLink({ type: 'invite', email: NEWBIE, options: { data: { organisation_id: site, invited_role: 'worker' } } })
    if (inv.error) throw new Error(inv.error.message)
    newbieId = inv.data.user.id
    await db.from('organisation_members').insert({ organisation_id: site, user_id: newbieId, role: 'worker' })
    const pa = await db.auth.admin.createUser({ email: PLATFORM, email_confirm: true })
    if (pa.error) throw new Error(pa.error.message)
    platformId = pa.data.user.id
    await db.from('organisation_members').insert({ organisation_id: site, user_id: platformId, role: 'admin' })
    await db.from('platform_admins').insert({ user_id: platformId, notes: 'eval approval run, removed after' })
  })

  test.afterAll(async () => {
    if (!db) return
    if (platformId) await db.from('platform_admins').delete().eq('user_id', platformId)
    for (const id of [newbieId, platformId].filter(Boolean)) {
      await db.from('organisation_members').delete().eq('user_id', id)
      await db.auth.admin.deleteUser(id)
    }
  })

  test('APPR-01 signed out: the welcome page has Sign in and Enquiries; the login page has Enquiries', async ({ page }) => {
    await page.goto('/welcome')
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute('href', '/login', SLOW)
    await expect(page.getByTestId('enquiries')).toHaveAttribute('href', /^mailto:.+@sopstart\.com$/)
    await shot(page, 'approval-01-welcome')
    await page.goto('/login')
    await expect(page.getByTestId('enquiries')).toHaveAttribute('href', /^mailto:/, SLOW)
    await shot(page, 'approval-02-login')
  })

  test('APPR-02 an invited account with a site waits: the home and its data stay shut', async ({ browser }) => {
    const { data: row } = await db.from('user_approvals').select('status').eq('user_id', newbieId).single()
    expect(row?.status).toBe('pending')
    const { ctx, page } = await open(browser, NEWBIE, '/')
    try {
      await expect(page).toHaveURL(/\/pending$/, SLOW)
      await expect(page.getByTestId('pending')).toHaveAttribute('data-status', 'pending')
      await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible()
      await page.goto('/?s=signoffs')
      await expect(page).toHaveURL(/\/pending$/, SLOW)
      await shot(page, 'approval-03-waiting')
    } finally {
      await ctx.close()
    }
    // The data itself: the account's own token reads no SOPs.
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } })
    const { data: link } = await db.auth.admin.generateLink({ type: 'magiclink', email: NEWBIE })
    const { data: v } = await anon.auth.verifyOtp({ token_hash: link.properties!.hashed_token, type: 'magiclink' })
    const claims = JSON.parse(Buffer.from(v.session!.access_token.split('.')[1], 'base64url').toString())
    expect(claims.approval).toBe('pending')
    expect(claims.organisation_id).toBeNull()
    const { data: sops } = await anon.from('sops').select('id').limit(5)
    expect(sops ?? []).toHaveLength(0)
  })

  test('APPR-03 a SOPstart admin approves the account and it gets in', async ({ browser }) => {
    const admin = await open(browser, PLATFORM, '/admin/settings')
    try {
      await expect(admin.page.getByTestId('settings-approvals')).toBeVisible(SLOW)
      await admin.page.getByTestId('settings-approvals').click()
      const row = admin.page.locator(`[data-testid="approval-row"][data-email="${NEWBIE}"]`)
      await expect(row).toBeVisible(SLOW)
      await expect(row).toContainText('Invited to')
      await shot(admin.page, 'approval-04-list')
      await row.getByTestId('approval-approve').click()
      // Approved, it leaves the waiting list (the page re-renders after the action).
      await expect(row).toHaveCount(0, SLOW)
    } finally {
      await admin.ctx.close()
    }
    const { data: row } = await db.from('user_approvals').select('status, decided_by').eq('user_id', newbieId).single()
    expect(row).toEqual({ status: 'approved', decided_by: platformId })
    const { data: dec } = await db.from('decisions').select('kind').eq('subject_kind', 'user').eq('subject_id', newbieId)
    expect(dec?.map((d) => d.kind)).toContain('approve')

    const { ctx, page } = await open(browser, NEWBIE, '/pending')
    try {
      // A fresh sign-in already carries the approval; Check again covers a token from before it.
      await expect(page.getByTestId('home-section-sops').or(page.getByTestId('pending-check'))).toBeVisible(SLOW)
      if (await page.getByTestId('pending-check').count()) await page.getByTestId('pending-check').click()
      await expect(page.getByTestId('home-section-sops')).toBeVisible(SLOW)
      await shot(page, 'approval-05-in')
    } finally {
      await ctx.close()
    }
  })
})
