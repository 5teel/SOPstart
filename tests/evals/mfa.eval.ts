/**
 * Deployed-site eval -- Phase 66 / ADR-0028: admins and safety managers prove a second step.
 *
 * Fixture (made here, removed after): a throwaway admin of the eval-site org, never the real
 * SOPstart org. Its sessions are minted at aal1 (the eval helper would otherwise step them up);
 * the browser does the set-up and the codes, and the test reads the setup key off the page to
 * compute codes (RFC 6238, tests/evals/lib/totp.mjs). eval-site-admin (aal2) does the reset.
 * Screens at desktop 1440 and phone 390. Self-skips without EVAL_BASE_URL.
 */
import { test, expect, type Browser, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { EVAL_ENV_READY, EVAL_SITE_ORG_NAME, signInAs, signInAsEmail } from './lib/session'
import { REAL_SOPSTART_ORG_ID, shot } from './lib/plant-fixture'
import { totp } from './lib/totp.mjs'

const SLOW = { timeout: 30_000 }
const RUN = randomUUID().slice(0, 8)
const EMAIL = `eval-mfa-${RUN}@sopstart.com`
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

const asToken = (token: string) =>
  createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
const aalOf = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).aal

test.describe.serial('Phase 66 -- the second step for admins (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient
  let orgId = ''
  let userId = ''
  let secret = ''
  let savedCode = ''

  async function open(browser: Browser, path: string, viewport = DESKTOP) {
    const ctx = await browser.newContext({ viewport, baseURL: process.env.EVAL_BASE_URL })
    const session = await signInAsEmail(ctx, EMAIL, { aal1: true })
    const page = await ctx.newPage()
    await page.goto(path)
    return { ctx, page, session }
  }

  async function factors() {
    const { data, error } = await db.auth.admin.mfa.listFactors({ userId })
    if (error) throw new Error(error.message)
    return data.factors.filter((f) => f.status === 'verified')
  }

  async function enrolOnPage(page: Page) {
    await expect(page.getByTestId('verify-enrol')).toBeVisible(SLOW)
    await page.getByTestId('verify-start').click()
    await expect(page.getByTestId('verify-qr')).toBeVisible(SLOW)
    secret = (await page.getByTestId('verify-secret').textContent())!.trim()
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/)
    await page.getByTestId('verify-code').fill(totp(secret))
    await page.getByTestId('verify-submit').click()
    await expect(page.getByTestId('verify-codes')).toBeVisible(SLOW)
    const codes = await page.getByTestId('recovery-code').allTextContents()
    expect(codes).toHaveLength(10)
    for (const c of codes) expect(c.trim()).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/)
    return codes.map((c) => c.trim())
  }

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const { data: org } = await db.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).single()
    orgId = org!.id as string
    if (orgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')
    const made = await db.auth.admin.createUser({ email: EMAIL, email_confirm: true, user_metadata: { eval_fixture: true } })
    if (made.error) throw new Error(made.error.message)
    userId = made.data.user.id
    const m = await db.from('organisation_members').insert({ organisation_id: orgId, user_id: userId, role: 'admin' })
    if (m.error) throw new Error(m.error.message)
  })

  test.afterAll(async () => {
    if (!db || !userId) return
    await db.from('organisation_members').delete().eq('user_id', userId)
    await db.auth.admin.deleteUser(userId)
  })

  test('MFA-01 a fresh admin is sent to /verify, sets up, sees ten codes once, and reaches Settings', async ({ browser }) => {
    const { ctx, page } = await open(browser, '/admin/settings')
    try {
      await expect(page).toHaveURL(/\/verify\?next=%2Fadmin%2Fsettings$/, SLOW)
      await expect(page.getByTestId('verify-enrol')).toContainText('Admin work needs a second step')
      await shot(page, '66-verify-enrol-desktop')
      const codes = await enrolOnPage(page)
      savedCode = codes[3]
      await shot(page, '66-verify-codes-desktop')
      await page.getByTestId('verify-continue').click()
      await expect(page).toHaveURL(/\/admin\/settings$/, SLOW)
      expect(await factors()).toHaveLength(1)
      const { data: rows } = await db.from('decisions').select('kind').eq('actor_id', userId)
      const kinds = (rows ?? []).map((r) => r.kind)
      expect(kinds).toContain('mfa_enrolled')
      expect(kinds).toContain('recovery_codes_issued')
    } finally {
      await ctx.close()
    }
  })

  test('MFA-02 a new session is asked for a code: a wrong one is refused, the right one gets in', async ({ browser }) => {
    const { ctx, page } = await open(browser, '/login', PHONE)
    try {
      await expect(page).toHaveURL(/\/verify\?next=%2F$/, SLOW)
      await expect(page.getByTestId('verify-challenge')).toBeVisible(SLOW)
      await page.getByTestId('verify-code').fill('000000')
      await page.getByTestId('verify-submit').click()
      await expect(page.getByTestId('verify-error')).toContainText("That code didn't work", SLOW)
      await shot(page, '66-verify-wrong-code-phone')
      await page.getByTestId('verify-code').fill(totp(secret))
      await page.getByTestId('verify-submit').click()
      await expect(page.getByTestId('home')).toBeVisible(SLOW)
      expect(page.url()).toMatch(/\/$|\/\?/)
      await shot(page, '66-home-after-code-phone')
    } finally {
      await ctx.close()
    }
  })

  test('MFA-03 before the second step the worker side works and admin is one tap away', async ({ browser }) => {
    const { ctx, page } = await open(browser, '/verify', PHONE)
    try {
      await page.getByTestId('verify-not-now').click()
      await expect(page.getByTestId('home')).toBeVisible(SLOW)
      await expect(page.getByTestId('shell-settings')).toHaveCount(0)
      await expect(page.getByTestId('home-section-people')).toHaveCount(0)
      await page.goto('/admin/settings')
      await expect(page).toHaveURL(/\/verify\?next=%2Fadmin%2Fsettings$/, SLOW)
      await page.setViewportSize(DESKTOP)
      await page.goto('/')
      await expect(page.getByTestId('home')).toBeVisible(SLOW)
      await expect(page.getByTestId('shell-second-step').filter({ visible: true })).toHaveCount(1)
      await shot(page, '66-home-aal1-desktop')
    } finally {
      await ctx.close()
    }
  })

  test('MFA-04 an aal1 admin token is refused an elevated write; aal2 passes', async ({ browser }) => {
    const ctx = await browser.newContext()
    try {
      const s1 = await signInAsEmail(ctx, EMAIL, { aal1: true })
      expect(aalOf(s1.access_token)).toBe('aal1')
      const ins = await asToken(s1.access_token).from('departments').insert({ organisation_id: orgId, name: `EVAL mfa aal1 ${RUN}`, code: 'MF1' }).select('id')
      expect(ins.error?.code).toBe('42501')
      const upd = await asToken(s1.access_token).from('sops').update({ updated_at: new Date().toISOString() }).eq('organisation_id', orgId).select('id')
      expect(upd.data ?? []).toHaveLength(0)
      const read = await asToken(s1.access_token).from('sops').select('id', { count: 'exact', head: true }).eq('organisation_id', orgId)
      expect(read.count ?? 0).toBeGreaterThan(0)

      const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
      await c.auth.setSession({ access_token: s1.access_token, refresh_token: s1.refresh_token })
      const fid = (await factors())[0].id
      const v = await c.auth.mfa.challengeAndVerify({ factorId: fid, code: totp(secret) })
      expect(v.error).toBeNull()
      expect(aalOf(v.data!.access_token)).toBe('aal2')
      const ok = await asToken(v.data!.access_token).from('departments').insert({ organisation_id: orgId, name: `EVAL mfa aal2 ${RUN}`, code: 'MF2' }).select('id')
      expect(ok.error).toBeNull()
      await db.from('departments').delete().eq('id', ok.data![0].id)
    } finally {
      await ctx.close()
    }
  })

  test('MFA-05 a recovery code clears the app and forces a new set-up; the old code is then refused', async ({ browser }) => {
    {
      const { ctx, page } = await open(browser, '/verify?next=%2Fprofile', PHONE)
      try {
        await page.getByTestId('verify-use-recovery').click()
        await page.getByTestId('verify-recovery-code').fill(savedCode.toUpperCase())
        await shot(page, '66-verify-recovery-phone')
        await page.getByTestId('verify-recovery-submit').click()
        await expect(page.getByTestId('verify-enrol')).toBeVisible(SLOW)
        expect(await factors()).toHaveLength(0)
        await enrolOnPage(page)
        await page.getByTestId('verify-continue').click()
        await expect(page).toHaveURL(/\/profile$/, SLOW)
        await expect(page.getByTestId('recovery-left')).toContainText('10 of 10 recovery codes left', SLOW)
        await shot(page, '66-profile-second-step-phone')
      } finally {
        await ctx.close()
      }
    }
    const { ctx, page } = await open(browser, '/verify', PHONE)
    try {
      await page.getByTestId('verify-use-recovery').click()
      await page.getByTestId('verify-recovery-code').fill(savedCode)
      await page.getByTestId('verify-recovery-submit').click()
      await expect(page.getByTestId('verify-error')).toContainText("That code didn't work", SLOW)
      expect(await factors()).toHaveLength(1)
      const { data: rows } = await db.from('decisions').select('kind').eq('actor_id', userId).eq('kind', 'recovery_code_used')
      expect(rows ?? []).toHaveLength(1)
    } finally {
      await ctx.close()
    }
  })

  test('MFA-06 another admin resets the sign-in steps from People; logged, admins told', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: DESKTOP, baseURL: process.env.EVAL_BASE_URL })
    try {
      await signInAs(ctx, 'siteAdmin')
      const page = await ctx.newPage()
      await page.goto('/?s=people')
      await expect(page.getByTestId('people-tab')).toHaveCount(1, SLOW)
      await page.getByTestId('people-view-authority').click()
      const row = page.getByTestId('people-row').filter({ hasText: EMAIL })
      await expect(row).toHaveCount(1, SLOW)
      await row.click()
      const sheet = page.getByTestId('person-sheet')
      await expect(sheet).toBeVisible(SLOW)
      await sheet.getByTestId('people-reset-steps').click()
      await expect(sheet.getByTestId('people-reset-ask')).toBeVisible()
      await shot(page, '66-people-reset-ask-desktop')
      await sheet.getByTestId('people-reset-confirm').click()
      await expect.poll(async () => (await factors()).length, SLOW).toBe(0)
      const { data: rows } = await db.from('decisions').select('kind, subject_id').eq('kind', 'mfa_reset').eq('subject_id', userId)
      expect(rows ?? []).toHaveLength(1)
      const { count } = await db.from('mfa_recovery_codes').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      expect(count ?? 0).toBe(0)
      // Every other active admin is told; the reset person is an admin here, so they get one too.
      const { data: told } = await db.from('notifications').select('user_id').eq('kind', 'signin_reset').eq('subject_id', userId)
      expect((told ?? []).map((t) => t.user_id)).toContain(userId)
    } finally {
      await ctx.close()
    }
  })
})
