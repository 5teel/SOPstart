/**
 * Deployed-site eval -- Phase 67 / ADR-0029: in-person sign-in codes.
 *
 * Fixtures (made here, removed after): a throwaway worker W and a throwaway suspended worker S in the
 * eval-site org, never the real SOPstart org. W is the person who is locked out. Using a code signs
 * the person out everywhere, so the persistent eval-worker is never the subject (other evals hold its
 * sessions). eval-site-admin (aal2) gives the codes; eval-site-supervisor proves the supervises rule.
 *
 * Authority refusals are proved on the server: the browser's own "Give a sign-in code" request is
 * rewritten in flight to name someone the caller may not issue for, and the refusal comes back.
 *
 * OTP spend (the shared budget, CLAUDE.md): W once (the old session), the site admin once, the
 * supervisor once, plus one server-side verify per good code (one). Do not loop this file.
 * Screens at desktop 1440 and phone 390. Self-skips without EVAL_BASE_URL.
 */
import { test, expect, type BrowserContext, type Browser, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { EVAL_ENV_READY, EVAL_SITE_ORG_NAME, EVAL_SITE_WORKER2_EMAIL, EVAL_USERS, signInAs, signInAsEmail } from './lib/session'
import { REAL_SOPSTART_ORG_ID, shot } from './lib/plant-fixture'

const SLOW = { timeout: 30_000 }
const RUN = randomUUID().slice(0, 8)
const W_EMAIL = `eval-signin-${RUN}@sopstart.invalid`
const S_EMAIL = `eval-signin-susp-${RUN}@sopstart.invalid`
const NEW_PASSWORD = `Eval-${randomUUID()}`
const REFUSAL = "That code didn't work. Ask your supervisor for a new one."
const ISSUE_REFUSAL = "You can't give this person a sign-in code."
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

/** Rewrite the browser's next server-action call that names `from` so it names `to` instead. */
async function rewriteActionArg(page: Page, from: string, to: string) {
  await page.route('**/*', async (route) => {
    const r = route.request()
    const body = r.postData()
    if (r.method() === 'POST' && r.headers()['next-action'] && body?.includes(from)) {
      return route.continue({ postData: body.split(from).join(to) })
    }
    return route.continue()
  })
}

test.describe.serial('Phase 67 -- in-person sign-in codes (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient
  let orgId = ''
  let wId = ''
  let sId = ''
  let adminId = ''
  let siteWorkerId = ''
  let worker2Id = ''
  let oldRefresh = ''
  let code = ''
  let adminCtx: BrowserContext
  const started = new Date().toISOString()

  async function makeMember(email: string) {
    const made = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { eval_fixture: true } })
    if (made.error || !made.data.user) throw new Error(`create failed: ${made.error?.message}`)
    const m = await db.from('organisation_members').insert({ organisation_id: orgId, user_id: made.data.user.id, role: 'worker' })
    if (m.error) throw new Error(m.error.message)
    return made.data.user.id
  }

  async function openSheet(page: Page, email: string) {
    await page.goto('/?s=people')
    await expect(page.getByTestId('people-tab')).toHaveCount(1, SLOW)
    await page.getByTestId('people-view-authority').click()
    const row = page.getByTestId('people-row').filter({ hasText: email })
    await expect(row).toHaveCount(1, SLOW)
    await row.click()
    const sheet = page.getByTestId('person-sheet')
    await expect(sheet).toBeVisible(SLOW)
    return sheet
  }

  async function giveCode(page: Page) {
    const sheet = await openSheet(page, W_EMAIL)
    await sheet.getByTestId('signin-code-give').click()
    const shown = sheet.getByTestId('signin-code-shown')
    await expect(shown).toBeVisible(SLOW)
    return { sheet, shown, value: (await shown.getByTestId('signin-code-value').textContent())!.trim() }
  }

  async function tryCode(browser: Browser, email: string, value: string) {
    const ctx = await browser.newContext({ viewport: PHONE, baseURL: process.env.EVAL_BASE_URL })
    const page = await ctx.newPage()
    await page.goto('/login')
    await page.getByTestId('signin-code-open').click()
    await page.getByTestId('signin-code-email').fill(email)
    await page.getByTestId('signin-code-code').fill(value)
    await page.getByTestId('signin-code-submit').click()
    return { ctx, page }
  }

  test.beforeAll(async ({ browser }) => {
    if (!EVAL_ENV_READY) return
    db = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const { data: org } = await db.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).single()
    orgId = org!.id as string
    if (orgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')
    wId = await makeMember(W_EMAIL)
    sId = await makeMember(S_EMAIL)
    const susp = await db.from('organisation_members').update({ status: 'suspended' }).eq('organisation_id', orgId).eq('user_id', sId).select('id')
    if (susp.error || !susp.data?.length) throw new Error('could not suspend the fixture')
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
    siteWorkerId = list.users.find((u) => u.email === EVAL_USERS.siteWorker)!.id
    worker2Id = list.users.find((u) => u.email === EVAL_SITE_WORKER2_EMAIL)!.id

    // W's old session: the one a lost phone would still hold.
    const oldCtx = await browser.newContext()
    oldRefresh = (await signInAsEmail(oldCtx, W_EMAIL)).refresh_token
    await oldCtx.close()

    adminCtx = await browser.newContext({ viewport: DESKTOP, baseURL: process.env.EVAL_BASE_URL })
    adminId = (await signInAs(adminCtx, 'siteAdmin')).user.id
  })

  test.afterAll(async () => {
    await adminCtx?.close().catch(() => {})
    if (!db || !orgId || orgId === REAL_SOPSTART_ORG_ID) return
    for (const uid of [wId, sId]) {
      if (!uid) continue
      await db.from('signin_codes').delete().eq('user_id', uid)
      await db.from('organisation_members').delete().eq('organisation_id', orgId).eq('user_id', uid)
      await db.auth.admin.deleteUser(uid).catch(() => {})
    }
  })

  test('SC-01 an admin gives a worker a code: shown once with the name and the time, stored hashed, logged', async () => {
    const page = await adminCtx.newPage()
    const { shown, value } = await giveCode(page)
    code = value
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/)
    await expect(shown).toContainText(`Give this to ${W_EMAIL}. It works once, until`)
    await shot(page, '67-code-shown-desktop')
    const { data: rows } = await db.from('signin_codes').select('code_hash, issued_by, used_at, attempts, expires_at').eq('user_id', wId)
    expect(rows).toHaveLength(1)
    expect(rows![0].issued_by).toBe(adminId)
    expect(rows![0].used_at).toBeNull()
    expect(rows![0].code_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(rows)).not.toContain(code.toLowerCase())
    const mins = (new Date(rows![0].expires_at).getTime() - Date.now()) / 60_000
    expect(mins).toBeGreaterThan(28)
    expect(mins).toBeLessThanOrEqual(30)
    const { data: led } = await db.from('decisions').select('actor_id').eq('kind', 'signin_code_issued').eq('subject_id', wId)
    expect((led ?? []).map((r) => r.actor_id)).toEqual([adminId])
    await shown.getByTestId('signin-code-done').click()
    await expect(page.getByTestId('signin-code-shown')).toHaveCount(0)
    await page.close()
  })

  test('SC-02 the worker uses it: held on Set a new password, sets one, reaches home; the old session is gone; logged', async ({ browser }) => {
    const { ctx, page } = await tryCode(browser, W_EMAIL, code.toLowerCase())
    try {
      await expect(page).toHaveURL(/\/profile\?set-password=1$/, SLOW)
      await expect(page.getByTestId('set-password-section')).toBeVisible(SLOW)
      await shot(page, '67-set-password-phone')
      // The hold: any other page sends them back.
      await page.goto('/')
      await expect(page).toHaveURL(/\/profile\?set-password=1$/, SLOW)
      await page.getByTestId('set-password-new').fill(NEW_PASSWORD)
      await page.getByTestId('set-password-confirm').fill(`${NEW_PASSWORD}x`)
      await page.getByTestId('set-password-submit').click()
      await expect(page.getByTestId('set-password-error')).toContainText("don't match", SLOW)
      await page.getByTestId('set-password-confirm').fill(NEW_PASSWORD)
      await page.getByTestId('set-password-submit').click()
      await expect(page.getByTestId('home')).toBeVisible(SLOW)
      expect(page.url()).toMatch(/\/$|\/\?/)
      await shot(page, '67-home-after-code-phone')
      await page.goto('/admin/settings')
      await expect(page).not.toHaveURL(/set-password/)
    } finally {
      await ctx.close()
    }
    const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const old = await anon.auth.refreshSession({ refresh_token: oldRefresh })
    expect(old.error, 'the old session must be revoked').not.toBeNull()
    const pw = await anon.auth.signInWithPassword({ email: W_EMAIL, password: NEW_PASSWORD })
    expect(pw.error).toBeNull()
    const { data: u } = await db.auth.admin.getUserById(wId)
    expect(u.user?.app_metadata?.must_set_password).toBeUndefined()
    const { data: rows } = await db.from('signin_codes').select('used_at').eq('user_id', wId)
    expect(rows![0].used_at).not.toBeNull()
    const { data: led } = await db.from('decisions').select('actor_id, organisation_id').eq('kind', 'signin_code_used').eq('subject_id', wId)
    expect(led).toHaveLength(1)
    expect(led![0].actor_id).toBe(wId)
    expect(led![0].organisation_id).toBe(orgId)
  })

  test('SC-03 the same code is refused afterwards; an unknown email gets the very same sentence', async ({ browser }) => {
    {
      const { ctx, page } = await tryCode(browser, W_EMAIL, code)
      try {
        await expect(page.getByTestId('signin-code-error')).toHaveText(REFUSAL, SLOW)
        await expect(page).toHaveURL(/\/login/)
        await shot(page, '67-code-refused-phone')
      } finally {
        await ctx.close()
      }
    }
    const { ctx, page } = await tryCode(browser, `nobody-${RUN}@sopstart.invalid`, code)
    try {
      await expect(page.getByTestId('signin-code-error')).toHaveText(REFUSAL, SLOW)
    } finally {
      await ctx.close()
    }
  })

  test('SC-04 five wrong tries void a fresh code: the right one is then refused', async ({ browser }) => {
    const page = await adminCtx.newPage()
    const { value } = await giveCode(page)
    await page.close()
    const wrong = value.startsWith('A') ? 'BBBB-BBBB' : 'AAAA-AAAA'
    const { ctx, page: p } = await tryCode(browser, W_EMAIL, wrong)
    try {
      await expect(p.getByTestId('signin-code-error')).toHaveText(REFUSAL, SLOW)
      for (let i = 2; i <= 5; i++) {
        await p.getByTestId('signin-code-submit').click()
        await expect.poll(async () => (await db.from('signin_codes').select('attempts').eq('user_id', wId).is('used_at', null).gt('expires_at', new Date().toISOString())).data?.[0]?.attempts ?? 5, SLOW).toBe(i)
      }
      await p.getByTestId('signin-code-code').fill(value)
      await p.getByTestId('signin-code-submit').click()
      await expect(p.getByTestId('signin-code-error')).toHaveText(REFUSAL, SLOW)
      await expect(p).toHaveURL(/\/login/)
    } finally {
      await ctx.close()
    }
    const { data: rows } = await db.from('signin_codes').select('attempts, used_at').eq('user_id', wId).order('created_at', { ascending: false }).limit(1)
    expect(rows![0].attempts).toBe(5)
    expect(rows![0].used_at).toBeNull()
  })

  test('SC-05 authority: no button for a suspended person, and the server refuses one anyway', async () => {
    const page = await adminCtx.newPage()
    try {
      const sheet = await openSheet(page, S_EMAIL)
      await expect(sheet.getByTestId('signin-code-give')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await rewriteActionArg(page, wId, sId)
      const w = await openSheet(page, W_EMAIL)
      await w.getByTestId('signin-code-give').click()
      await expect(w.getByTestId('signin-code-refused')).toHaveText(ISSUE_REFUSAL, SLOW)
      await expect(w.getByTestId('signin-code-shown')).toHaveCount(0)
      const { count } = await db.from('signin_codes').select('id', { count: 'exact', head: true }).eq('user_id', sId)
      expect(count ?? 0).toBe(0)
    } finally {
      await page.close()
    }
  })

  test('SC-06 authority: a supervisor gives codes only to the workers they supervise', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: DESKTOP, baseURL: process.env.EVAL_BASE_URL })
    try {
      await signInAs(ctx, 'siteSupervisor')
      const page = await ctx.newPage()
      await rewriteActionArg(page, siteWorkerId, worker2Id)
      await page.goto('/?s=signoffs')
      const list = page.getByTestId('signin-code-workers')
      await expect(list).toBeVisible(SLOW)
      const mine = list.getByTestId('signin-code-worker').filter({ hasText: EVAL_USERS.siteWorker })
      await expect(mine).toHaveCount(1, SLOW)
      await expect(list.getByTestId('signin-code-worker').filter({ hasText: EVAL_SITE_WORKER2_EMAIL })).toHaveCount(0)
      await mine.getByTestId('signin-code-give').click()
      await expect(mine.getByTestId('signin-code-refused')).toHaveText(ISSUE_REFUSAL, SLOW)
      await shot(page, '67-supervisor-refused-desktop')
      const { count } = await db.from('signin_codes').select('id', { count: 'exact', head: true }).eq('user_id', worker2Id).gte('created_at', started)
      expect(count ?? 0).toBe(0)
    } finally {
      await ctx.close()
    }
  })
})
